import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const path = new URL('../migrations/20261113200000_stock-bebidas.sql', import.meta.url);
const bebida='00000000-0000-4000-8000-000000000001';
const otra='00000000-0000-4000-8000-000000000002';
const pizza='00000000-0000-4000-8000-000000000003';
const leer=(file:string)=>readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8');
async function fixture(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE project_admin;
 GRANT ALL ON SCHEMA public TO project_admin; SET ROLE project_admin;
 CREATE TABLE productos(id uuid PRIMARY KEY,nombre text,tipo text,categoria text,proyecto_id text DEFAULT 'impasto',archivado boolean DEFAULT false);
 CREATE TABLE pedidos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),numero_pedido integer,productos jsonb,proyecto_id text DEFAULT 'impasto',status text DEFAULT 'normal',estado_pago text DEFAULT 'pendiente');
 CREATE TABLE pedido_costeos(pedido_id uuid,productos jsonb,costo_produccion_centavos bigint,comision_pct numeric);
 INSERT INTO productos(id,nombre,tipo,categoria) VALUES('${bebida}','Coca','bebida','otras'),('${otra}','Agua','otro','Bebidas'),('${pizza}','Muzza','pizza','Pizzas');
 INSERT INTO productos(id,nombre,tipo,categoria,proyecto_id) VALUES('00000000-0000-4000-8000-000000000004','Coca','bebida','Bebidas','otro');`);
 for(const file of ['20261018202351_cupos-noche.sql','20261025000845_masas-noche.sql','20261031122631_masas-por-tipo.sql'])await db.exec(leer(file));
 if(existsSync(path))await db.exec(readFileSync(path,'utf8'));
 return db;
}
const web=(id=bebida,qty=1)=>({key:id,type:'bebida',qty});
async function crear(db:PGlite,productos:unknown[],extra={}){
 return (await db.query<{pedido:{id:string;stock_consumo:unknown}}>('SELECT crear_pedido_costeado($1::jsonb,$2::jsonb) pedido',[JSON.stringify({productos,...extra}),JSON.stringify({costo_produccion_centavos:123,comision_pct:2})])).rows[0].pedido;
}
async function stock(db:PGlite,id=bebida){return (await db.query<{unidades:number|null}>('SELECT unidades FROM stock_bebidas WHERE producto_id=$1',[id])).rows[0]?.unidades;}
async function fijar(db:PGlite,n:number|null,id=bebida){await db.query('SELECT fijar_stock_bebida($1,$2)',[id,n]);}

test('venta web agrupa ids; POS reconoce nombre y categoría bebida; otros proyectos y tipos no consumen',async()=>{
 const db=await fixture();try{
 await fijar(db,10);await fijar(db,5,otra);
 const row=await crear(db,[web(bebida,2),web(bebida,1),{nombre:'Agua',cantidad:2}]);
 assert.deepEqual(row.stock_consumo,[{producto_id:bebida,unidades:3},{producto_id:otra,unidades:2}]);
 assert.equal(await stock(db),7);assert.equal(await stock(db,otra),3);
 await db.exec(`INSERT INTO productos VALUES('00000000-0000-4000-8000-000000000005','Coca','bebida','Bebidas','impasto',true);`);
 await fijar(db,5,'00000000-0000-4000-8000-000000000005');
 await crear(db,[{nombre:'Coca',cantidad:1},{nombre:'Coca',cantidad:1}]);
 assert.equal(await stock(db),5);assert.equal(await stock(db,'00000000-0000-4000-8000-000000000005'),5);
 await fijar(db,7);
 await crear(db,[web()],{proyecto_id:'otro'});assert.equal(await stock(db),7);
 const consumo=(await db.query<{c:unknown}>(`SELECT stock_consumo($1::jsonb) c`,[JSON.stringify([{type:'pizza',key:bebida},{type:'pizza-half',key:bebida},{type:'empanadas',key:bebida},{nombre:'Muzza',cantidad:2}])])).rows[0].c;
 assert.deepEqual(consumo,[]);
 const history=(await db.query<{delta:number;motivo:string;pedido_id:string;actor:string}>("SELECT * FROM stock_movimientos WHERE motivo='venta' AND pedido_id=$1 ORDER BY producto_id",[row.id])).rows;
 assert.deepEqual(history.map(x=>x.delta),[-3,-2]);assert.ok(history.every(x=>x.pedido_id===row.id&&x.actor==='project_admin'));
 }finally{await db.close();}
});
test('stock insuficiente revierte pedido, costeo, otras bebidas, cupos y masas',async()=>{
 const db=await fixture();try{
 await fijar(db,5);await fijar(db,0,otra);
 await db.exec(`INSERT INTO cupos_noche VALUES('impasto',noche_de_negocio(now()),'${pizza}',10,0,now()); SELECT fijar_masas_restantes('impasto','napoletana',5);`);
 await assert.rejects(crear(db,[{type:'pizza',key:pizza,qty:1},web(),web(otra)]),/STOCK_AGOTADO\|Agua\|0/);
 assert.equal(await stock(db),5);
 assert.equal((await db.query('SELECT * FROM pedidos')).rows.length,0);assert.equal((await db.query('SELECT * FROM pedido_costeos')).rows.length,0);
 assert.equal((await db.query<{n:number}>('SELECT vendidas_mitades n FROM cupos_noche')).rows[0].n,0);
 assert.ok((await db.query<{n:number}>('SELECT vendidas n FROM masas_noche')).rows.every(x=>x.n===0));
 assert.equal((await db.query("SELECT * FROM stock_movimientos WHERE motivo='venta'")).rows.length,0);
 }finally{await db.close();}
});
test('cancelación, reactivación atómica, rechazo de pago y eliminación devuelven una sola vez',async()=>{
 const db=await fixture();try{
 await fijar(db,4);const row=await crear(db,[web(bebida,3)]);
 await db.query("UPDATE pedidos SET status='cancelado' WHERE id=$1",[row.id]);assert.equal(await stock(db),4);
 await db.query("UPDATE pedidos SET status='cancelado' WHERE id=$1",[row.id]);assert.equal(await stock(db),4);
 await fijar(db,2);await assert.rejects(db.query("UPDATE pedidos SET status='normal' WHERE id=$1",[row.id]),/STOCK_AGOTADO\|Coca\|2/);
 assert.deepEqual((await db.query('SELECT status,stock_liberado FROM pedidos')).rows[0],{status:'cancelado',stock_liberado:true});assert.equal(await stock(db),2);
 await fijar(db,5);await db.query("UPDATE pedidos SET status='normal' WHERE id=$1",[row.id]);assert.equal(await stock(db),2);
 await db.query("UPDATE pedidos SET estado_pago='rechazado' WHERE id=$1",[row.id]);assert.equal(await stock(db),5);
 await db.query('DELETE FROM pedidos WHERE id=$1',[row.id]);assert.equal(await stock(db),5);
 const second=await crear(db,[web()]);await db.query('DELETE FROM pedidos WHERE id=$1',[second.id]);assert.equal(await stock(db),5);
 assert.equal((await db.query("SELECT * FROM stock_movimientos WHERE motivo='devolucion'")).rows.length,3);
 }finally{await db.close();}
});
test('sin fila o NULL se vende sin control; activar control no devuelve ventas previas',async()=>{
 const db=await fixture();try{
 const first=await crear(db,[web(bebida,100)]);assert.equal(await stock(db),undefined);
 await fijar(db,null);const second=await crear(db,[web(bebida,100)]);assert.equal(await stock(db),null);
 await fijar(db,3);await db.exec('DELETE FROM pedidos');assert.equal(await stock(db),3);assert.ok(first.id&&second.id);
 }finally{await db.close();}
});
test('reactivación insuficiente revierte otras bebidas y los cupos/masas que ya había restaurado',async()=>{
 const db=await fixture();try{
 await fijar(db,4);await fijar(db,4,otra);
 await db.exec(`INSERT INTO cupos_noche VALUES('impasto',noche_de_negocio(now()),'${pizza}',10,0,now()); SELECT fijar_masas_restantes('impasto','napoletana',5);`);
 const row=await crear(db,[web(),web(otra),{key:pizza,type:'pizza',qty:1}]);
 await db.query("UPDATE pedidos SET status='cancelado' WHERE id=$1",[row.id]);await fijar(db,0,otra);
 const before=(await db.query('SELECT * FROM stock_movimientos')).rows.length;
 await assert.rejects(db.query("UPDATE pedidos SET status='normal' WHERE id=$1",[row.id]),/STOCK_AGOTADO\|Agua\|0/);
 assert.equal(await stock(db),4);assert.equal(await stock(db,otra),0);
 assert.equal((await db.query('SELECT * FROM stock_movimientos')).rows.length,before);
 assert.equal((await db.query<{n:number}>('SELECT vendidas_mitades n FROM cupos_noche')).rows[0].n,0);
 assert.ok((await db.query<{n:number}>('SELECT vendidas n FROM masas_noche')).rows.every(x=>x.n===0));
 assert.deepEqual((await db.query('SELECT cupo_liberado,stock_liberado,status FROM pedidos')).rows[0],{cupo_liberado:true,stock_liberado:true,status:'cancelado'});
 }finally{await db.close();}
});
test('fallo del costeo revierte reserva y movimientos; cantidades sin cargo igualmente consumen',async()=>{
 const db=await fixture();try{
 await fijar(db,4);
 await db.exec(`CREATE FUNCTION fail_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'snapshot failure'; END $$; CREATE TRIGGER fail_snapshot BEFORE INSERT ON pedido_costeos FOR EACH ROW EXECUTE FUNCTION fail_snapshot();`);
 await assert.rejects(crear(db,[{...web(),precio:0}]),/snapshot failure/);assert.equal(await stock(db),4);
 assert.equal((await db.query("SELECT * FROM stock_movimientos WHERE motivo='venta'")).rows.length,0);
 await db.exec('DROP TRIGGER fail_snapshot ON pedido_costeos');await crear(db,[{...web(),precio:0}]);assert.equal(await stock(db),3);
 }finally{await db.close();}
});
test('carga suma al stock actual, ajuste y quitar control registran historial y rechazan inválidos',async()=>{
 const db=await fixture();try{
 await db.query("SELECT cargar_stock_bebida($1,5,'carga')",[bebida]);await crear(db,[web()]);
 await db.query("SELECT cargar_stock_bebida($1,3,'carga')",[bebida]);assert.equal(await stock(db),7);
 await fijar(db,2);await fijar(db,null);assert.equal(await stock(db),null);
 const rows=(await db.query<{delta:number;motivo:string;actor:string}>("SELECT * FROM stock_movimientos WHERE motivo<>'venta' ORDER BY creado_en,id")).rows;
 assert.equal(rows.length,4);assert.ok(rows.every(x=>x.actor==='project_admin'));assert.equal(rows.filter(x=>x.motivo==='carga').reduce((s,x)=>s+x.delta,0),8);
 await assert.rejects(fijar(db,-1));await assert.rejects(fijar(db,2,pizza));
 await assert.rejects(db.query("SELECT cargar_stock_bebida($1,-9,'ajuste')",[bebida]));
 await assert.rejects(db.query("SELECT cargar_stock_bebida($1,1,'venta')",[bebida]));
 }finally{await db.close();}
});
test('pizzas conservan cupos, masas por tipo y costeo; ACL limita tablas y RPCs',async()=>{
 const db=await fixture();try{
 await fijar(db,4);await db.exec(`INSERT INTO cupos_noche VALUES('impasto',noche_de_negocio(now()),'${pizza}',10,0,now()); SELECT fijar_masas_restantes('impasto','molde',3);`);
 const row=await crear(db,[{key:pizza,type:'pizza',qty:2,masa:'molde'}]);assert.equal(await stock(db),4);
 assert.equal((await db.query<{n:number}>('SELECT vendidas_mitades n FROM cupos_noche')).rows[0].n,4);
 assert.equal((await db.query<{n:number}>("SELECT vendidas n FROM masas_noche WHERE masa='molde'")).rows[0].n,2);
 assert.deepEqual((await db.query('SELECT costo_produccion_centavos,comision_pct FROM pedido_costeos')).rows[0],{costo_produccion_centavos:123,comision_pct:'2'});
 await db.query("UPDATE pedidos SET status='cancelado' WHERE id=$1",[row.id]);assert.equal((await db.query<{n:number}>('SELECT vendidas_mitades n FROM cupos_noche')).rows[0].n,0);
 await db.exec('RESET ROLE');
 for(const signature of ['stock_consumo(jsonb)','cargar_stock_bebida(uuid,integer,text)','fijar_stock_bebida(uuid,integer)','crear_pedido_costeado(jsonb,jsonb)']){
 const acl=(await db.query('SELECT has_function_privilege(\'anon\',$1,\'EXECUTE\') anon,has_function_privilege(\'authenticated\',$1,\'EXECUTE\') auth,has_function_privilege(\'project_admin\',$1,\'EXECUTE\') admin',[signature])).rows[0];assert.deepEqual(acl,{anon:false,auth:false,admin:true});
 }
 assert.ok((await db.query<{relrowsecurity:boolean}>("SELECT relrowsecurity FROM pg_class WHERE relname IN ('stock_bebidas','stock_movimientos')")).rows.every(x=>x.relrowsecurity));
 assert.equal((await db.query("SELECT * FROM pg_policies WHERE tablename IN ('stock_bebidas','stock_movimientos')")).rows.length,0);
 await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM stock_bebidas'),/permission denied/);
 }finally{await db.close();}
});
test('guion BEGIN/ROLLBACK para base real es SQL ejecutable y no deja cambios',async()=>{
 const db=await fixture();try{
 await db.exec(`ALTER TABLE pedidos ADD COLUMN fecha date, ADD COLUMN sucursal_id text,ADD COLUMN modalidad text,ADD COLUMN direccion text,ADD COLUMN subtotal numeric,ADD COLUMN envio numeric,ADD COLUMN total numeric,ADD COLUMN metodo_pago text,ADD COLUMN proveedor_pago text,ADD COLUMN cuando text,ADD COLUMN external_reference text;`);
 await db.exec(readFileSync(new URL('./fixtures/stock-bebidas-casos.sql',import.meta.url),'utf8'));
 assert.equal((await db.query('SELECT * FROM pedidos')).rows.length,0);
 assert.equal((await db.query('SELECT * FROM stock_bebidas')).rows.length,0);
 assert.equal((await db.query('SELECT * FROM stock_movimientos')).rows.length,0);
 }finally{await db.close();}
});
