import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const pid='00000000-0000-4000-8000-000000000001',op1='00000000-0000-4000-8000-000000000011',op2='00000000-0000-4000-8000-000000000012';
const request={transaction_id:'PAY',amount_centavos:30000};
const charge={clave:'mp-cobro:ORD',tipo:'cobro',monto_centavos:100000,metodo_pago:'mercadopago',ocurrido_en:null,fecha_fuente:'desconocida'};
const refund=(id:string,amount=30000)=>({...charge,clave:`mp-devolucion:${id}`,tipo:'devolucion',monto_centavos:amount});
async function fixture(){const db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE project_admin;
CREATE FUNCTION public.es_usuario_recetario() RETURNS boolean LANGUAGE sql AS 'SELECT true';
CREATE TABLE public.pedidos(id uuid PRIMARY KEY,total numeric NOT NULL,estado_pago text DEFAULT 'pendiente',metodo_pago text DEFAULT 'efectivo',proveedor_pago text DEFAULT 'manual',parcial_mp numeric,status text DEFAULT 'normal',proyecto_id text DEFAULT 'impasto',sucursal_id text DEFAULT 'iguazu',mp_order_id text DEFAULT '',id_pago text DEFAULT '',external_reference text DEFAULT 'IM-test');
GRANT ALL ON public.pedidos TO project_admin,authenticated;`);
for(const file of ['20260930222815_movimientos-pago.sql','20261001160000_devoluciones-operaciones.sql'])await db.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
await db.exec(`INSERT INTO pedidos(id,total,metodo_pago,proveedor_pago,mp_order_id,id_pago,estado_pago) VALUES('${pid}',1000,'mercadopago','mercadopago','ORD','PAY','aprobado'); SET ROLE project_admin;`);
await db.query('SELECT registrar_movimientos_pago($1::uuid,$2::text,$3::jsonb)',[pid,'ORD',JSON.stringify([charge])]);return db;}
const reserve=(db:PGlite,id=op1,body:unknown=request)=>db.query<{data:any}>('SELECT reservar_devolucion_operacion($1::uuid,$2::text,$3::uuid,$4::jsonb) AS data',[pid,'ORD',id,JSON.stringify(body)]);
const confirm=(db:PGlite,id=op1,rows:unknown[]=[charge,refund('R1')])=>db.query<{data:any}>('SELECT confirmar_devolucion_operacion($1::uuid,$2::text,$3::uuid,$4::jsonb) AS data',[pid,'ORD',id,JSON.stringify(rows)]);
test('two equal partial refunds have distinct frozen UUID keys; retries and full remainder recover',async()=>{const db=await fixture();try{
 const first=(await reserve(db)).rows[0].data;assert.equal(first.key,`refund-operation-${op1}`);assert.equal(first.request.amount_centavos,30000);
 assert.deepEqual((await reserve(db)).rows[0].data,first);
 await confirm(db);await confirm(db);
 const second=(await reserve(db,op2)).rows[0].data;assert.notEqual(second.key,first.key);assert.deepEqual(second.baseline,[{clave:'mp-devolucion:R1',monto_centavos:30000}]);
 await confirm(db,op2,[charge,refund('R1'),refund('R2')]);
 const third='00000000-0000-4000-8000-000000000013';const full=(await reserve(db,third,{total:true})).rows[0].data;assert.equal(full.request.amount_centavos,40000);
 await confirm(db,third,[charge,refund('R1'),refund('R2'),refund('R3',40000)]);
 assert.equal((await db.query<{estado_pago:string}>('SELECT estado_pago FROM pedidos')).rows[0].estado_pago,'reembolsado');
 assert.equal((await reserve(db,third,{total:true})).rows[0].data.confirmedRefund,'mp-devolucion:R3');
 await assert.rejects(reserve(db,'00000000-0000-4000-8000-000000000014'),/saldo|aprobado/);
}finally{await db.close();}});
test('active conflict, changed retry body, excess and unexpected delta preserve active intent',async()=>{const db=await fixture();try{
 await assert.rejects(reserve(db,op1,{...request,amount_centavos:100001}),/saldo/);await reserve(db);
 await assert.rejects(reserve(db,op2),/activa/);await assert.rejects(reserve(db,op1,{...request,amount_centavos:40000}),/cuerpo/);
 await assert.rejects(confirm(db,op1,[charge,refund('external',20000)]),/coincide/);
 await assert.rejects(confirm(db,op1,[charge,refund('R1',10000),refund('R2',20000)]),/Delta/);
 assert.equal((await db.query('SELECT * FROM pedido_movimientos')).rows.length,1);
 assert.equal((await reserve(db)).rows[0].data.confirmedRefund,null);
 await confirm(db);await assert.rejects(reserve(db,op2,{...request,amount_centavos:70001}),/saldo/);
}finally{await db.close();}});
test('legacy uncertainty and foreign project block; ACL denies direct writes and public RPC',async()=>{const db=await fixture();try{
 await db.exec('RESET ROLE');await db.exec(`UPDATE pedido_devolucion_intentos SET solicitud='{"total":true}',clave='old',reservado_en=now();`);
 await assert.rejects(reserve(db),/legacy|anterior/);
 await db.exec('DELETE FROM pedido_devolucion_intentos');await assert.rejects(reserve(db),/legacy/);
 await db.exec(`INSERT INTO pedido_devolucion_intentos(pedido_id) VALUES('${pid}');UPDATE pedidos SET proyecto_id='otro';`);await assert.rejects(reserve(db),/incompatible/);
 for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);await assert.rejects(reserve(db),/permission denied/);await assert.rejects(confirm(db),/permission denied/);await db.exec('RESET ROLE');}
 await db.exec('SET ROLE project_admin');await assert.rejects(db.exec('DELETE FROM pedido_devolucion_operaciones'),/permission denied/);
}finally{await db.close();}});
test('SQL reservation rejects malformed order money/state/identity and non-provider ledger',async()=>{const db=await fixture();try{
 await db.exec('RESET ROLE');await db.exec('ALTER TABLE pedidos ALTER COLUMN total DROP NOT NULL');
 for(const change of ["total=NULL","total=0","total=-1","total=1000.001","total=90071992547409.92","estado_pago=NULL","estado_pago='pendiente'","external_reference=NULL","external_reference='OTHER'"]){
  await db.exec(`UPDATE pedidos SET ${change}`);await assert.rejects(reserve(db),/incompatible|aprobado/);
  await db.exec("UPDATE pedidos SET total=1000,estado_pago='aprobado',external_reference='IM-test'");
 }
 await db.exec('ALTER TABLE pedido_movimientos DISABLE TRIGGER ALL');await db.exec("UPDATE pedido_movimientos SET metodo_pago='efectivo'");await db.exec('ALTER TABLE pedido_movimientos ENABLE TRIGGER ALL');
 await assert.rejects(reserve(db),/evidencia/);
 assert.equal((await db.query('SELECT * FROM pedido_devolucion_operaciones')).rows.length,0);
}finally{await db.close();}});
