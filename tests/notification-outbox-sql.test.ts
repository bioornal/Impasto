import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const ID = '11111111-1111-4111-8111-111111111111';
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE project_admin;
    CREATE TABLE pedidos(id uuid PRIMARY KEY, proyecto_id text, external_reference text, proveedor_pago text, estado_pago text, status text, email_cliente text);
    CREATE TABLE notificaciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pedido_id uuid NOT NULL,canal text NOT NULL,tipo text NOT NULL,destino text NOT NULL,estado text NOT NULL DEFAULT 'pendiente',detalle jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX notificaciones_unicas_idx ON notificaciones(pedido_id,tipo,canal);
    GRANT SELECT,INSERT,UPDATE ON pedidos,notificaciones TO project_admin;`);
  await db.exec(readFileSync(new URL('../migrations/20260930220253_cola-avisos.sql',import.meta.url),'utf8'));
  return db;
}
async function insert(db: PGlite, provider='manual', state='pendiente', ref='IM-test') {
  await db.query('INSERT INTO pedidos VALUES ($1,\'impasto\',$2,$3,$4,\'nuevo\',\'test@example.invalid\')',[ID,ref,provider,state]);
}
async function claim(db: PGlite,id:string,retry=false,confirm=false) {
  return (await db.query<{r:any}>('SELECT reclamar_notificacion($1::uuid,$2::jsonb,$3,$4) r',[id,JSON.stringify({body:'frozen'}),retry,confirm])).rows[0].r;
}
test('manual enqueues both channels atomically; rollback removes parent and queue',async()=>{
  const db=await fixture();try{await db.exec('BEGIN');await insert(db);assert.equal((await db.query('SELECT * FROM notificaciones')).rows.length,2);await db.exec('ROLLBACK');assert.equal((await db.query('SELECT * FROM notificaciones')).rows.length,0);}finally{await db.close();}
});
test('POS and unapproved online excluded; approval enqueues once',async()=>{
  for(const ref of ['POS-test','IM-test']){const db=await fixture();try{await insert(db,'mercadopago','pendiente',ref);assert.equal((await db.query('SELECT * FROM notificaciones')).rows.length,0);await db.exec("UPDATE pedidos SET estado_pago='aprobado'");assert.equal((await db.query('SELECT * FROM notificaciones')).rows.length,ref==='IM-test'?2:0);await db.exec("UPDATE pedidos SET estado_pago='aprobado'");assert.equal((await db.query('SELECT * FROM notificaciones')).rows.length,ref==='IM-test'?2:0);}finally{await db.close();}}
});
test('claim excludes second consumer, finish token guarded and sent terminal',async()=>{
  const db=await fixture();try{await insert(db);const id=(await db.query<{id:string}>('SELECT id FROM notificaciones LIMIT 1')).rows[0].id;const c=await claim(db,id);assert.equal(c.estado,'procesando');assert.equal(c.intentos,1);assert.equal(await claim(db,id),null);assert.equal((await db.query<{r:any}>("SELECT finalizar_notificacion($1::uuid,$2::uuid,'enviado','{}') r",[id,ID])).rows[0].r,null);const done=(await db.query<{r:any}>("SELECT finalizar_notificacion($1::uuid,$2::uuid,'enviado','{}') r",[id,c.claim_id])).rows[0].r;assert.equal(done.estado,'enviado');assert.equal(await claim(db,id,true,true),null);}finally{await db.close();}
});
test('expired processing needs explicit duplicate confirmation and preserves message',async()=>{
  const db=await fixture();try{await insert(db);const id=(await db.query<{id:string}>('SELECT id FROM notificaciones LIMIT 1')).rows[0].id;const first=await claim(db,id);await db.exec("UPDATE notificaciones SET claimed_at=now()-interval '20 minutes'");assert.equal(await claim(db,id,true),null);assert.equal((await db.query<{estado:string}>('SELECT estado FROM notificaciones WHERE id=$1',[id])).rows[0].estado,'incierto');const next=await claim(db,id,true,true);assert.notEqual(next.claim_id,first.claim_id);assert.deepEqual(next.mensaje,first.mensaje);}finally{await db.close();}
});
test('failed and omitted require explicit retry, canceled pedido cannot deliver',async()=>{
  const db=await fixture();try{await insert(db);const id=(await db.query<{id:string}>('SELECT id FROM notificaciones LIMIT 1')).rows[0].id;await db.query("UPDATE notificaciones SET estado='fallido' WHERE id=$1",[id]);assert.equal(await claim(db,id),null);assert.ok(await claim(db,id,true));await db.exec("UPDATE pedidos SET status='cancelado'; UPDATE notificaciones SET estado='pendiente'");assert.equal(await claim(db,id),null);}finally{await db.close();}
});
test('legacy payload never auto replays; explicit confirmation captures current snapshot',async()=>{
  const db=await fixture();try{await insert(db);const id=(await db.query<{id:string}>('SELECT id FROM notificaciones LIMIT 1')).rows[0].id;await db.query('UPDATE notificaciones SET payload=NULL WHERE id=$1',[id]);assert.equal(await claim(db,id),null);const c=await claim(db,id,true,true);assert.equal(c.payload.id,ID);}finally{await db.close();}
});
test('RPC execute restricted to project_admin and invoker security',async()=>{
  const db=await fixture();try{await insert(db);const id=(await db.query<{id:string}>('SELECT id FROM notificaciones LIMIT 1')).rows[0].id;for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);await assert.rejects(claim(db,id),/permission denied/);await db.exec('RESET ROLE');}await db.exec('SET ROLE project_admin');assert.ok(await claim(db,id));await db.exec('RESET ROLE');const flags=await db.query<{prosecdef:boolean}>("SELECT prosecdef FROM pg_proc WHERE proname IN ('reclamar_notificacion','finalizar_notificacion')");assert.ok(flags.rows.every(r=>!r.prosecdef));}finally{await db.close();}
});
test('omitted refreshes transport message only on explicit retry and email uses actual column',async()=>{
  const db=await fixture();try{await insert(db);const row=(await db.query<{id:string,destino:string}>("SELECT id,destino FROM notificaciones WHERE canal='email'")).rows[0];assert.equal(row.destino,'test@example.invalid');const first=await claim(db,row.id);await db.query("SELECT finalizar_notificacion($1::uuid,$2::uuid,'omitido','{}')",[row.id,first.claim_id]);assert.equal(await claim(db,row.id),null);const refreshed=(await db.query<{r:any}>("SELECT reclamar_notificacion($1::uuid,'{\"configured\":true}',true,false) r",[row.id])).rows[0].r;assert.deepEqual(refreshed.mensaje,{configured:true});}finally{await db.close();}
});
test('foreign project and invalid payment state cannot queue or claim',async()=>{
  const db=await fixture();try{await insert(db);const id=(await db.query<{id:string}>('SELECT id FROM notificaciones LIMIT 1')).rows[0].id;await db.exec("UPDATE pedidos SET proyecto_id='carro';");assert.equal(await claim(db,id,true,true),null);await db.exec("UPDATE pedidos SET proyecto_id='impasto',estado_pago='reembolsado'");assert.equal(await claim(db,id,true,true),null);}finally{await db.close();}
});
test('null claim timestamp is expired and persists uncertainty without automatic claim',async()=>{
  const db=await fixture();try{await insert(db);const id=(await db.query<{id:string}>('SELECT id FROM notificaciones LIMIT 1')).rows[0].id;await claim(db,id);await db.query('UPDATE notificaciones SET claimed_at=NULL WHERE id=$1',[id]);assert.equal(await claim(db,id),null);const row=(await db.query<{estado:string,intentos:number}>('SELECT estado,intentos FROM notificaciones WHERE id=$1',[id])).rows[0];assert.equal(row.estado,'incierto');assert.equal(row.intentos,1);}finally{await db.close();}
});
test('claim does not lock parent after notification (supplemental lock-order check)',async()=>{
  const db=await fixture();try{const body=(await db.query<{body:string}>("SELECT pg_get_functiondef('reclamar_notificacion(uuid,jsonb,boolean,boolean)'::regprocedure) body")).rows[0].body;assert.doesNotMatch(body,/WHERE p\.id=n\.pedido_id FOR SHARE/i);}finally{await db.close();}
});
