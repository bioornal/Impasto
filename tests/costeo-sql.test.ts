import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../migrations/20261001003000_pedido-costeos.sql',import.meta.url),'utf8');
async function fixture(){const db=new PGlite();await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE project_admin;
 CREATE FUNCTION es_usuario_recetario() RETURNS boolean LANGUAGE sql AS 'SELECT true';
 CREATE TABLE pedidos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),numero_pedido integer NOT NULL,created_at timestamptz DEFAULT now(),direccion text NOT NULL,productos jsonb NOT NULL,total numeric NOT NULL,estado_pago text DEFAULT 'pendiente',metodo_pago text DEFAULT 'efectivo',proveedor_pago text DEFAULT 'manual',parcial_mp numeric,status text DEFAULT 'normal',proyecto_id text DEFAULT 'impasto',sucursal_id text DEFAULT 'iguazu',mp_order_id text DEFAULT '',external_reference text DEFAULT 'IM-test',email_cliente text DEFAULT '');
 CREATE TABLE notificaciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pedido_id uuid NOT NULL,canal text NOT NULL,tipo text NOT NULL,destino text NOT NULL,estado text NOT NULL DEFAULT 'pendiente',detalle jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
 CREATE UNIQUE INDEX notificaciones_unicas_idx ON notificaciones(pedido_id,tipo,canal);
 GRANT SELECT,INSERT,UPDATE ON notificaciones TO project_admin;
`);await db.exec(readFileSync(new URL('../migrations/20260930222815_movimientos-pago.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../migrations/20260930220253_cola-avisos.sql',import.meta.url),'utf8'));await db.exec(migration);return db;}
const pedido={numero_pedido:1,direccion:'Retiro',productos:[{nombre:'Pizza',cantidad:1,precio:100}],total:100,estado_pago:'aprobado',email_cliente:'test@example.test'};
const costeo={costo_produccion_centavos:4200,comision_pct:7.99};
const create=(db:PGlite,p=pedido,c:unknown=costeo)=>db.query<{data:Record<string,unknown>}>('SELECT crear_pedido_costeado($1::jsonb,$2::jsonb) AS data',[JSON.stringify(p),JSON.stringify(c)]);
test('atomic creation keeps defaults and original products; actual ledger/outbox triggers run',async()=>{const db=await fixture();try{
 await db.exec('SET ROLE project_admin');const row=(await create(db)).rows[0].data;assert.ok(row.id);assert.ok(row.created_at);assert.equal(row.status,'normal');assert.equal(row.sucursal_id,'iguazu');
 const snapshot=(await db.query<{productos:unknown;costo_produccion_centavos:number}>('SELECT * FROM pedido_costeos')).rows[0];assert.deepEqual(snapshot.productos,pedido.productos);assert.equal(snapshot.costo_produccion_centavos,4200);
 await db.exec('RESET ROLE');assert.equal((await db.query('SELECT * FROM pedido_movimientos')).rows.length,1);assert.equal((await db.query('SELECT * FROM notificaciones')).rows.length,2);
}finally{await db.close();}});
test('snapshot failure rolls back parent and actual ledger/outbox side effects',async()=>{const db=await fixture();try{
 await db.exec(`CREATE FUNCTION fail_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'snapshot failure'; END $$; CREATE TRIGGER fail_snapshot BEFORE INSERT ON pedido_costeos FOR EACH ROW EXECUTE FUNCTION fail_snapshot();`);
 await assert.rejects(create(db),/snapshot failure/);
 for(const table of ['pedidos','pedido_costeos','pedido_movimientos','notificaciones'])assert.equal((await db.query('SELECT * FROM '+table)).rows.length,0);
}finally{await db.close();}});
test('cost/fee malformed values and unauthorized columns are rejected without sale',async()=>{const db=await fixture();try{
 for(const c of [{comision_pct:0},{...costeo,costo_produccion_centavos:0.5},{...costeo,costo_produccion_centavos:'12'},{...costeo,comision_pct:100},{...costeo,comision_pct:null}])await assert.rejects(create(db,pedido,c));
 await assert.rejects(create(db,{...pedido,id:'00000000-0000-4000-8000-000000000001'} as typeof pedido),/no permitida/);
 assert.equal((await db.query('SELECT * FROM pedidos')).rows.length,0);
 await create(db,pedido,{...costeo,costo_produccion_centavos:null});assert.equal((await db.query<{costo_produccion_centavos:unknown}>('SELECT costo_produccion_centavos FROM pedido_costeos')).rows[0].costo_produccion_centavos,null);
}finally{await db.close();}});
test('immutable retained history and role ACL',async()=>{const db=await fixture();try{
 await create(db);await assert.rejects(db.exec('UPDATE pedido_costeos SET comision_pct=0'),/inmutable/);await assert.rejects(db.exec('DELETE FROM pedido_costeos'),/inmutable/);
 await db.exec('DELETE FROM pedidos');assert.equal((await db.query('SELECT * FROM pedido_costeos')).rows.length,1);
 const grants=(await db.query(`SELECT has_function_privilege('anon','crear_pedido_costeado(jsonb,jsonb)','EXECUTE') anon,has_function_privilege('authenticated','crear_pedido_costeado(jsonb,jsonb)','EXECUTE') auth,has_function_privilege('project_admin','crear_pedido_costeado(jsonb,jsonb)','EXECUTE') admin`)).rows[0];assert.deepEqual(grants,{anon:false,auth:false,admin:true});
 for(const role of ['authenticated','project_admin']){await db.exec('SET ROLE '+role);assert.equal((await db.query('SELECT * FROM pedido_costeos')).rows.length,1);await assert.rejects(db.exec("INSERT INTO pedido_costeos(pedido_id,productos,comision_pct) VALUES(gen_random_uuid(),'[]',0)"),/permission denied/);await db.exec('RESET ROLE');}
 assert.equal((await db.query<{allowed:boolean}>("SELECT has_table_privilege('project_admin','pedido_costeos','TRUNCATE') AS allowed")).rows[0].allowed,false);
 await db.exec('CREATE OR REPLACE FUNCTION es_usuario_recetario() RETURNS boolean LANGUAGE sql AS \'SELECT false\'; SET ROLE authenticated');
 assert.equal((await db.query('SELECT * FROM pedido_costeos')).rows.length,0);
 await db.exec('RESET ROLE');
 await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM pedido_costeos'),/permission denied/);
 await db.exec("RESET ROLE; CREATE OR REPLACE FUNCTION es_usuario_recetario() RETURNS boolean LANGUAGE sql AS 'SELECT false'; SET ROLE authenticated");assert.equal((await db.query('SELECT * FROM pedido_costeos')).rows.length,0);
}finally{await db.close();}});
