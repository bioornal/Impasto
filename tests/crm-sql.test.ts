import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../migrations/20261001130000_crm-compras.sql',import.meta.url),'utf8');
async function fixture(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE project_admin;
 CREATE FUNCTION es_usuario_recetario() RETURNS boolean LANGUAGE sql AS 'SELECT true';
 CREATE TABLE clientes(telefono text NOT NULL UNIQUE,nombre text,direccion text NOT NULL,detalles text,cant_compras integer DEFAULT 0,email text NOT NULL DEFAULT '');
 CREATE TABLE pedidos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),total numeric NOT NULL,estado_pago text DEFAULT 'pendiente',metodo_pago text DEFAULT 'efectivo',proveedor_pago text DEFAULT 'manual',parcial_mp numeric,status text DEFAULT 'normal',proyecto_id text DEFAULT 'impasto',sucursal_id text DEFAULT 'iguazu',mp_order_id text DEFAULT '',external_reference text DEFAULT 'IM-test',telefono_cliente text,nombre_cliente text,email_cliente text,direccion text,modalidad text DEFAULT 'delivery',fecha text,created_at timestamptz DEFAULT now());
 GRANT SELECT,INSERT,UPDATE ON pedidos TO project_admin;`);
 await db.exec(readFileSync(new URL('../migrations/20260930222815_movimientos-pago.sql',import.meta.url),'utf8'));
 await db.exec(sql);return db;
}
const perfil={telefono:'+54 (9) 12345678',nombre:'Ana',direccion:'Casa',email:'ana@example.test'};
const save=(db:PGlite,p:unknown=perfil)=>db.query('SELECT guardar_perfil_cliente($1::jsonb)',[JSON.stringify(p)]);
const read=async(db:PGlite,tel:string|null=null,offset=0,size=500)=>(await db.query<{data:Array<Record<string,unknown>>}>('SELECT leer_clientes_crm($1::text,$2::text,$3::int,$4::int) AS data',['impasto',tel,offset,size])).rows[0].data;
test('contact save and retry do not count purchases; empty fields preserve profile',async()=>{const db=await fixture();try{
 await db.exec('SET ROLE project_admin');await save(db);await save(db,{telefono:perfil.telefono,nombre:'',direccion:'',email:''});
 const row=(await read(db))[0];assert.equal(row.cant_compras,0);assert.equal(row.nombre,'Ana');assert.equal(row.direccion,'Casa');assert.equal(row.email,perfil.email);
 await assert.rejects(save(db,{...perfil,cant_compras:999}),/permitid/i);
}finally{await db.close();}});
test('unique sales are derived, pending does not count and same names/suffixes do not mix',async()=>{const db=await fixture();try{
 await save(db);await save(db,{telefono:'+54 9912345678',nombre:'Ana'});
 await db.exec(`INSERT INTO pedidos(total,telefono_cliente,nombre_cliente,direccion,estado_pago) VALUES(100,'54912345678','Ana','Casa','aprobado'),(200,'54912345678','Ana','Casa','aprobado'),(999,'54912345678','Ana','Casa','pendiente');`);
 const ana=(await read(db,perfil.telefono))[0];assert.equal(ana.cant_compras,2);assert.equal(ana.total_cobrado,300);
 assert.equal((await read(db,'+54 9912345678'))[0].cant_compras,0);
 await db.exec('UPDATE clientes SET cant_compras=999');assert.equal((await read(db,perfil.telefono))[0].cant_compras,2);
}finally{await db.close();}});
test('ledger net wins, total refund removes purchase and partial counts once',async()=>{const db=await fixture();try{
 await save(db);const id='00000000-0000-4000-8000-000000000001';
 await db.exec(`INSERT INTO pedidos(id,total,telefono_cliente,estado_pago,metodo_pago,proveedor_pago,mp_order_id) VALUES('${id}',1000,'54912345678','aprobado','mercadopago','mercadopago','ORD1');`);
 const gross={clave:'mp-cobro:ORD1',tipo:'cobro',monto_centavos:100000,metodo_pago:'mercadopago',ocurrido_en:null,fecha_fuente:'desconocida'};
 const refund={clave:'mp-devolucion:R1',tipo:'devolucion',monto_centavos:20000,metodo_pago:'mercadopago',ocurrido_en:null,fecha_fuente:'desconocida'};
 const proof=(rows:unknown[])=>db.query('SELECT registrar_movimientos_pago($1::uuid,$2::text,$3::jsonb)',[id,'ORD1',JSON.stringify(rows)]);
 await proof([gross,refund]);assert.equal((await read(db))[0].cant_compras,1);assert.equal((await read(db))[0].total_cobrado,800);
 await proof([gross,refund,{...refund,clave:'mp-devolucion:R2',monto_centavos:80000}]);assert.equal((await read(db))[0].cant_compras,0);assert.equal((await read(db))[0].total_cobrado,0);
}finally{await db.close();}});
test('order contact is atomic, rollback removes it and old counters remain untouched',async()=>{const db=await fixture();try{
 await db.exec(`BEGIN;INSERT INTO pedidos(total,telefono_cliente,nombre_cliente,direccion,estado_pago) VALUES(100,'77777777','Nuevo','Casa','aprobado');ROLLBACK;`);
 assert.equal((await read(db,'77777777')).length,0);
 await db.exec(`INSERT INTO pedidos(total,telefono_cliente,nombre_cliente,direccion) VALUES(100,'77777777','Nuevo','Casa');`);
 assert.equal((await read(db,'77777777'))[0].cant_compras,0);
}finally{await db.close();}});
test('legacy unknown refund is visible and pagination/ACL are bounded',async()=>{const db=await fixture();try{
 await save(db);await db.exec('DROP TRIGGER pedidos_cobro_declarado ON pedidos');
 await db.exec(`INSERT INTO pedidos(total,telefono_cliente,estado_pago,metodo_pago) VALUES(100,'54912345678','parcialmente_reembolsado','mercadopago');`);
 assert.equal((await read(db))[0].compras_sin_importe,1);assert.equal((await read(db))[0].cant_compras,0);
 assert.equal((await read(db,null,1)).length,0);await assert.rejects(read(db,null,-1));await assert.rejects(read(db,null,0,0));
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);await assert.rejects(read(db),/permission denied/i);await assert.rejects(save(db),/permission denied/i);await db.exec('RESET ROLE');}
}finally{await db.close();}});

test('legacy formatted duplicate profiles stay explicit for the complete-reader ambiguity guard',async()=>{const db=await fixture();try{
 await save(db);
 // Legacy rows can predate the normalized advisory-lock upsert. No destructive merge.
 await db.exec(`INSERT INTO clientes(telefono,nombre,direccion) VALUES('54912345678','Duplicado legado','Otra casa');
 INSERT INTO pedidos(total,telefono_cliente,estado_pago) VALUES(100,'54912345678','aprobado');`);
 const rows=await read(db,perfil.telefono);
 assert.equal(rows.length,2);
 assert.deepEqual(new Set(rows.map(row=>String(row.telefono).replace(/\D/g,''))),new Set(['54912345678']));
 for(const row of rows){assert.equal(row.cant_compras,1);assert.equal(row.total_cobrado,100);}
 // A further profile retry updates an existing row but does not add a third alias.
 await save(db,{telefono:'54-9-12345678',nombre:''});
 assert.equal((await read(db,perfil.telefono)).length,2);
}finally{await db.close();}});

test('costed sale atomically includes CRM profile, ledger and outbox; failed snapshot or duplicate commits none',async()=>{const db=await fixture();try{
 await db.exec(`ALTER TABLE pedidos ADD COLUMN numero_pedido integer NOT NULL DEFAULT 1;
 ALTER TABLE pedidos ADD COLUMN productos jsonb NOT NULL DEFAULT '[]';
 CREATE UNIQUE INDEX pedidos_reference_test ON pedidos(external_reference);
 CREATE TABLE notificaciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pedido_id uuid NOT NULL,canal text NOT NULL,tipo text NOT NULL,destino text NOT NULL,estado text NOT NULL DEFAULT 'pendiente',detalle jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
 CREATE UNIQUE INDEX notificaciones_unicas_idx ON notificaciones(pedido_id,tipo,canal);
 GRANT SELECT,INSERT,UPDATE ON notificaciones TO project_admin;`);
 await db.exec(readFileSync(new URL('../migrations/20260930220253_cola-avisos.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/20261001003000_pedido-costeos.sql',import.meta.url),'utf8'));
 await db.exec(`CREATE FUNCTION fail_costeo_crm() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'costeo failure'; END $$;
 CREATE TRIGGER fail_costeo_crm BEFORE INSERT ON pedido_costeos FOR EACH ROW EXECUTE FUNCTION fail_costeo_crm();`);
 const order={numero_pedido:1,total:100,productos:[{name:'Pizza',qty:1,price:100}],telefono_cliente:'12345678',nombre_cliente:'Nueva',email_cliente:'nueva@example.test',direccion:'Casa',estado_pago:'aprobado',external_reference:'IM-MAN-crm-test'};
 const create=()=>db.query('SELECT crear_pedido_costeado($1::jsonb,$2::jsonb)',[JSON.stringify(order),JSON.stringify({costo_produccion_centavos:2500,comision_pct:7.99})]);
 await db.exec('SET ROLE project_admin');await assert.rejects(create(),/costeo failure/);await db.exec('RESET ROLE');
 for(const table of ['pedidos','clientes','pedido_costeos','pedido_movimientos','notificaciones'])assert.equal((await db.query('SELECT * FROM '+table)).rows.length,0,table+' must roll back');
 await db.exec('DROP TRIGGER fail_costeo_crm ON pedido_costeos; SET ROLE project_admin');await create();await assert.rejects(create(),/duplicate key/);await db.exec('RESET ROLE');
 for(const table of ['pedidos','clientes','pedido_costeos','pedido_movimientos'])assert.equal((await db.query('SELECT * FROM '+table)).rows.length,1,table+' must not duplicate');
 assert.equal((await db.query('SELECT * FROM notificaciones')).rows.length,2);
 const customer=(await read(db,'12345678'))[0];assert.equal(customer.cant_compras,1);assert.equal(customer.total_cobrado,100);
 assert.equal((await db.query<{cant_compras:number}>('SELECT cant_compras FROM clientes')).rows[0].cant_compras,0,'legacy counter remains untouched');
}finally{await db.close();}});
