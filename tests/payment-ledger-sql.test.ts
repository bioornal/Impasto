import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const id='00000000-0000-4000-8000-000000000001';
const migration=readFileSync(new URL('../migrations/20260930222815_movimientos-pago.sql',import.meta.url),'utf8');
async function fixture(){const db=new PGlite();await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE project_admin;
CREATE FUNCTION public.es_usuario_recetario() RETURNS boolean LANGUAGE sql AS 'SELECT true';
CREATE TABLE public.pedidos(id uuid PRIMARY KEY,total numeric NOT NULL,estado_pago text DEFAULT 'pendiente',metodo_pago text DEFAULT 'efectivo',proveedor_pago text DEFAULT 'manual',parcial_mp numeric,status text DEFAULT 'normal',proyecto_id text DEFAULT 'impasto',sucursal_id text DEFAULT 'iguazu',mp_order_id text DEFAULT '',external_reference text DEFAULT 'IM-test');
GRANT ALL ON public.pedidos TO project_admin,authenticated;
`);await db.exec(migration);return db;}
const proof=[{clave:'mp-cobro:ORD1',tipo:'cobro',monto_centavos:100000,metodo_pago:'mercadopago',ocurrido_en:null,fecha_fuente:'desconocida'}, {clave:'mp-devolucion:REF1',tipo:'devolucion',monto_centavos:20000,metodo_pago:'mercadopago',ocurrido_en:null,fecha_fuente:'desconocida'}];
async function online(db:PGlite){await db.exec(`INSERT INTO public.pedidos(id,total,proveedor_pago,metodo_pago,mp_order_id,estado_pago) VALUES('${id}',1000,'mercadopago','mercadopago','ORD1','aprobado');`);}
async function register(db:PGlite,rows=proof){return db.query('SELECT public.registrar_movimientos_pago($1::uuid,$2::text,$3::jsonb) AS data',[id,'ORD1',JSON.stringify(rows)]);}
test('ledger stores original charge and partial once; conflicting retry rolls back',async()=>{const db=await fixture();try{await online(db);await register(db);await register(db);assert.equal((await db.query('SELECT * FROM pedido_movimientos')).rows.length,2);await assert.rejects(register(db,[{...proof[1],monto_centavos:30000}]),/conflict|distint|incompatible/i);assert.equal((await db.query('SELECT * FROM pedido_movimientos')).rows.length,2);}finally{await db.close();}});
test('over refund and inconsistent order proof roll back the whole batch',async()=>{const db=await fixture();try{await online(db);await assert.rejects(register(db,[proof[0],{...proof[1],monto_centavos:100001}]),/monto|super|total/i);assert.equal((await db.query('SELECT * FROM pedido_movimientos')).rows.length,0);await assert.rejects(db.query('SELECT registrar_movimientos_pago($1::uuid,$2::text,$3::jsonb)',[id,'WRONG',JSON.stringify(proof)]),/orden|order/i);}finally{await db.close();}});
test('manual partial then balance produces correct channel totals and cancellation keeps money',async()=>{const db=await fixture();try{await db.exec(`INSERT INTO pedidos(id,total,parcial_mp) VALUES('${id}',1000,400); UPDATE pedidos SET estado_pago='aprobado' WHERE id='${id}'; UPDATE pedidos SET status='cancelado' WHERE id='${id}';`);const rows=(await db.query<{metodo_pago:string;sum:string}>('SELECT metodo_pago,sum(monto_centavos)::text FROM pedido_movimientos GROUP BY metodo_pago')).rows;assert.deepEqual(Object.fromEntries(rows.map(r=>[r.metodo_pago,r.sum])),{mercadopago:'40000',efectivo:'60000'});await db.exec(`UPDATE pedidos SET status='entregado',total=2000 WHERE id='${id}';`);assert.equal((await db.query<{sum:string}>('SELECT sum(monto_centavos)::text FROM pedido_movimientos')).rows[0].sum,'100000');}finally{await db.close();}});
test('legacy partial baseline has unknown date and new balance has declaration date',async()=>{const db=new PGlite();try{await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE project_admin; CREATE FUNCTION es_usuario_recetario() RETURNS boolean LANGUAGE sql AS 'SELECT true'; CREATE TABLE pedidos(id uuid PRIMARY KEY,total numeric,estado_pago text,metodo_pago text,proveedor_pago text,parcial_mp numeric,status text,proyecto_id text,sucursal_id text,mp_order_id text,external_reference text); INSERT INTO pedidos VALUES('${id}',1000,'pendiente','efectivo','manual',400,'normal','impasto','iguazu','','POS-test');`);await db.exec(migration);await db.exec(`UPDATE pedidos SET estado_pago='aprobado' WHERE id='${id}';`);const rows=(await db.query<{monto_centavos:number;ocurrido_en:string|null;fecha_fuente:string}>('SELECT monto_centavos,ocurrido_en,fecha_fuente FROM pedido_movimientos ORDER BY monto_centavos')).rows;assert.equal(rows.length,2);assert.equal(rows[0].ocurrido_en,null);assert.equal(rows[0].fecha_fuente,'desconocida');assert.equal(rows[1].fecha_fuente,'registro');assert.ok(rows[1].ocurrido_en);}finally{await db.close();}});
test('journal is immutable, owner read only, RPC admin only',async()=>{const db=await fixture();try{await online(db);await register(db);await assert.rejects(db.exec('UPDATE pedido_movimientos SET monto_centavos=1'),/inmut|append/i);await assert.rejects(db.exec('DELETE FROM pedido_movimientos'),/inmut|append/i);const result=(await db.query<{anon:boolean;auth:boolean;admin:boolean}>(`SELECT has_function_privilege('anon','registrar_movimientos_pago(uuid,text,jsonb)','EXECUTE') AS anon,has_function_privilege('authenticated','registrar_movimientos_pago(uuid,text,jsonb)','EXECUTE') AS auth,has_function_privilege('project_admin','registrar_movimientos_pago(uuid,text,jsonb)','EXECUTE') AS admin`)).rows[0];assert.deepEqual(result,{anon:false,auth:false,admin:true});await db.exec('SET ROLE authenticated');assert.equal((await db.query('SELECT * FROM pedido_movimientos')).rows.length,2);await assert.rejects(db.exec(`INSERT INTO pedido_movimientos(pedido_id,proyecto_id,sucursal_id,clave,tipo,monto_centavos,metodo_pago,fecha_fuente) VALUES('${id}','impasto','iguazu','x','cobro',1,'efectivo','desconocida')`),/permission denied/i);}finally{await db.close();}});
test('refund state is derived atomically; stale incomplete snapshot cannot erase a full refund',async()=>{const db=await fixture();try{
  await online(db);await register(db);assert.equal((await db.query<{estado_pago:string}>('SELECT estado_pago FROM pedidos')).rows[0].estado_pago,'parcialmente_reembolsado');
  await register(db,[...proof,{...proof[1],clave:'mp-devolucion:REF2',monto_centavos:80000}]);
  assert.equal((await db.query<{estado_pago:string}>('SELECT estado_pago FROM pedidos')).rows[0].estado_pago,'reembolsado');
  await assert.rejects(register(db),/incomplet|atrasad/i);
  assert.equal((await db.query<{estado_pago:string}>('SELECT estado_pago FROM pedidos')).rows[0].estado_pago,'reembolsado');
}finally{await db.close();}});

test('legacy downgrade preserves full documented receipt, including a zero new target',async()=>{
  for(const partial of [400,0]){const db=await fixture();try{
    await db.exec('DROP TRIGGER pedidos_cobro_declarado ON pedidos');
    await db.exec(`INSERT INTO pedidos(id,total,estado_pago) VALUES('${id}',1000,'aprobado')`);
    await db.exec('CREATE TRIGGER pedidos_cobro_declarado AFTER INSERT OR UPDATE OF estado_pago,parcial_mp,status ON pedidos FOR EACH ROW EXECUTE FUNCTION registrar_cobro_declarado()');
    await db.exec(`UPDATE pedidos SET estado_pago='pendiente',parcial_mp=${partial}`);
    const rows=(await db.query<{sum:string;dates:number}>('SELECT sum(monto_centavos)::text AS sum,count(ocurrido_en)::int AS dates FROM pedido_movimientos')).rows;
    assert.deepEqual(rows,[{sum:'100000',dates:0}]);
  }finally{await db.close();}}
});
test('admin registration uses definer RPC; direct insert forbidden and fractional declarations reject',async()=>{const db=await fixture();try{
  await online(db);await db.exec('SET ROLE project_admin');await register(db);
  await assert.rejects(db.exec(`INSERT INTO pedido_movimientos(pedido_id,proyecto_id,sucursal_id,clave,tipo,monto_centavos,metodo_pago,fecha_fuente) VALUES('${id}','impasto','iguazu','bad','devolucion',1,'efectivo','desconocida')`),/permission denied/i);
  await db.exec('RESET ROLE');await assert.rejects(db.exec("INSERT INTO pedidos(id,total,parcial_mp) VALUES('00000000-0000-4000-8000-000000000002',1000,.005)"),/centavos exactos/i);
}finally{await db.close();}});
test('refund reservation freezes the first request and preserves historical transport key',async()=>{const db=await fixture();try{
  await online(db);await db.exec('SET ROLE project_admin');
  const reserve=(request:unknown)=>db.query<{key:string}>('SELECT reservar_devolucion_pago($1::uuid,$2::text,$3::jsonb) AS key',[id,'ORD1',JSON.stringify(request)]);
  const request={transaction_id:'PAY1',amount_centavos:3010};
  assert.equal((await reserve(request)).rows[0].key,'refund-ORD1-30.1');
  assert.equal((await reserve(request)).rows[0].key,'refund-ORD1-30.1');
  await assert.rejects(reserve({...request,amount_centavos:4000}),/otra intención/i);
  await assert.rejects(reserve({total:true}),/otra intención/i);
  await db.exec('RESET ROLE');await db.exec('DELETE FROM pedido_devolucion_intentos');
  await assert.rejects(reserve(request),/anterior al registro/i);
  const grants=(await db.query<{anon:boolean;auth:boolean}>("SELECT has_function_privilege('anon','reservar_devolucion_pago(uuid,text,jsonb)','EXECUTE') AS anon,has_function_privilege('authenticated','reservar_devolucion_pago(uuid,text,jsonb)','EXECUTE') AS auth")).rows[0];assert.deepEqual(grants,{anon:false,auth:false});
}finally{await db.close();}});
test('malformed legacy partial does not block kitchen changes without a new money declaration',async()=>{const db=await fixture();try{
  await db.exec('DROP TRIGGER pedidos_cobro_declarado ON pedidos');
  await db.exec(`INSERT INTO pedidos(id,total,parcial_mp) VALUES('${id}',1000,.005)`);
  await db.exec('CREATE TRIGGER pedidos_cobro_declarado AFTER INSERT OR UPDATE OF estado_pago,parcial_mp,status ON pedidos FOR EACH ROW EXECUTE FUNCTION registrar_cobro_declarado()');
  await db.exec("UPDATE pedidos SET status='preparando'; UPDATE pedidos SET status='cancelado'");
  assert.equal((await db.query('SELECT * FROM pedido_movimientos')).rows.length,0);
}finally{await db.close();}});
test('payment ledger and existing notification trigger commit together without re-enqueuing refunds',async()=>{const db=await fixture();try{
  await db.exec(`ALTER TABLE pedidos ADD COLUMN email_cliente text;
    CREATE TABLE notificaciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pedido_id uuid NOT NULL,canal text NOT NULL,tipo text NOT NULL,destino text NOT NULL,estado text NOT NULL DEFAULT 'pendiente',detalle jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX notificaciones_unicas_idx ON notificaciones(pedido_id,tipo,canal);
    GRANT SELECT,INSERT,UPDATE ON notificaciones TO project_admin;`);
  await db.exec(readFileSync(new URL('../migrations/20260930220253_cola-avisos.sql',import.meta.url),'utf8'));
  await db.exec('SET ROLE project_admin');await online(db);await register(db);
  assert.equal((await db.query('SELECT * FROM notificaciones')).rows.length,2);
  assert.equal((await db.query('SELECT * FROM pedido_movimientos')).rows.length,2);
  assert.equal((await db.query<{estado_pago:string}>('SELECT estado_pago FROM pedidos')).rows[0].estado_pago,'parcialmente_reembolsado');
}finally{await db.close();}});
