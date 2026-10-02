import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const id='00000000-0000-4000-8000-000000000001';const op='00000000-0000-4000-8000-000000000002';
const ledger=readFileSync(new URL('../migrations/20260930222815_movimientos-pago.sql',import.meta.url),'utf8');
const migration=readFileSync(new URL('../migrations/20261001150000_devoluciones-manuales.sql',import.meta.url),'utf8');
async function fixture(){const db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE project_admin;
 CREATE FUNCTION es_usuario_recetario() RETURNS boolean LANGUAGE sql AS 'SELECT true';
 CREATE TABLE pedidos(id uuid PRIMARY KEY,total numeric,estado_pago text DEFAULT 'pendiente',metodo_pago text DEFAULT 'efectivo',proveedor_pago text DEFAULT 'manual',parcial_mp numeric,status text DEFAULT 'normal',proyecto_id text DEFAULT 'impasto',sucursal_id text DEFAULT 'iguazu',mp_order_id text DEFAULT '',id_pago text,external_reference text DEFAULT 'POS-test');
 GRANT ALL ON pedidos TO project_admin;`);await db.exec(ledger);await db.exec(migration);return db;}
const refund=(db:PGlite,amount=10000,method='efectivo',operation=op,reason='Devolución ya realizada')=>db.query<{result:{recovered:boolean;estado_pago:string}}>('SELECT registrar_devolucion_manual($1::uuid,$2::text,$3::uuid,$4::bigint,$5::text,$6::text) AS result',[id,'iguazu',operation,amount,method,reason]);
test('mixed channels bounded independently, retry exact once, partial/full state and immutable reason',async()=>{const db=await fixture();try{
 await db.exec(`INSERT INTO pedidos(id,total,parcial_mp) VALUES('${id}',1000,400);UPDATE pedidos SET estado_pago='aprobado' WHERE id='${id}';SET ROLE project_admin;`);
 await assert.rejects(refund(db,60001),/saldo/i);
 assert.equal((await refund(db,20000)).rows[0].result.estado_pago,'parcialmente_reembolsado');
 assert.equal((await refund(db,20000)).rows[0].result.recovered,true);
 await assert.rejects(refund(db,20001),/incompatible/i);await assert.rejects(refund(db,20000,'efectivo',op,'Cambio del motivo'),/incompatible/i);
 await refund(db,40000,'mercadopago','00000000-0000-4000-8000-000000000003');
 assert.equal((await refund(db,40000,'efectivo','00000000-0000-4000-8000-000000000004')).rows[0].result.estado_pago,'reembolsado');
 await assert.rejects(refund(db,1,'efectivo','00000000-0000-4000-8000-000000000005'),/saldo/i);
 const rows=(await db.query<{ocurrido_en:string;fecha_fuente:string;motivo_manual:string}>('SELECT * FROM pedido_movimientos WHERE tipo=\'devolucion\'')).rows;
 assert.equal(rows.length,3);assert.ok(rows.every(r=>r.fecha_fuente==='registro' && r.ocurrido_en && r.motivo_manual));
 await db.exec('RESET ROLE');await assert.rejects(db.exec("UPDATE pedido_movimientos SET motivo_manual='changed'"),/inmutable/i);
 }finally{await db.close();}});
test('historical unknown, provider and foreign branch rejected; no side effects',async()=>{const db=await fixture();try{
 await db.exec(`INSERT INTO pedidos(id,total) VALUES('${id}',1000);`);await assert.rejects(refund(db),/saldo/i);
 await db.exec(`UPDATE pedidos SET estado_pago='aprobado' WHERE id='${id}';UPDATE pedidos SET proveedor_pago='mercadopago' WHERE id='${id}';`);await assert.rejects(refund(db),/incompatible/i);
 await db.exec(`UPDATE pedidos SET proveedor_pago='manual',estado_pago='parcialmente_reembolsado' WHERE id='${id}';`);await assert.rejects(refund(db),/histórico/i);
 await db.exec(`UPDATE pedidos SET estado_pago='aprobado',sucursal_id='other' WHERE id='${id}';`);await assert.rejects(refund(db),/incompatible/i);
 assert.equal((await db.query("SELECT * FROM pedido_movimientos WHERE tipo='devolucion'")).rows.length,0);
 }finally{await db.close();}});
test('RPC admin-only and direct append forbidden',async()=>{const db=await fixture();try{
 await assert.rejects(db.exec(`INSERT INTO pedido_movimientos(pedido_id,proyecto_id,sucursal_id,clave,tipo,monto_centavos,metodo_pago,ocurrido_en,fecha_fuente,operacion_manual_id,motivo_manual) VALUES('${id}','impasto','iguazu','bad-null','devolucion',1,'efectivo',now(),'registro','${op}',NULL)`),/constraint/i);
 const access=(await db.query<{anon:boolean;auth:boolean;admin:boolean}>(`SELECT has_function_privilege('anon','registrar_devolucion_manual(uuid,text,uuid,bigint,text,text)','EXECUTE') anon,has_function_privilege('authenticated','registrar_devolucion_manual(uuid,text,uuid,bigint,text,text)','EXECUTE') auth,has_function_privilege('project_admin','registrar_devolucion_manual(uuid,text,uuid,bigint,text,text)','EXECUTE') admin`)).rows[0];assert.deepEqual(access,{anon:false,auth:false,admin:true});
 await db.exec('SET ROLE project_admin');await assert.rejects(db.exec(`INSERT INTO pedido_movimientos(pedido_id,proyecto_id,sucursal_id,clave,tipo,monto_centavos,metodo_pago,fecha_fuente) VALUES('${id}','impasto','iguazu','x','devolucion',1,'efectivo','desconocida')`),/permission/i);
 }finally{await db.close();}});
