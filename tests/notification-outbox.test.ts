import assert from 'node:assert/strict';
import { test } from 'node:test';
import { processNotification, type NotificationJob, type OutboxPort } from '../lib/notification-outbox';
const message = { chatIds: ['one'], text: 'Pedido' };
const job: NotificationJob = { id:'n',pedido_id:'p',tipo:'pedido_creado',canal:'telegram',destino:'',estado:'pendiente',payload:{id:'p'},mensaje:null,claim_id:null,claimed_at:null,detalle:{},intentos:0 };
test('claim failure prevents provider IO', async () => {
  let sent = 0;
  const port: OutboxPort = { claim: async () => { throw new Error('DB down'); }, deliver: async () => {sent++; return {estado:'enviado'};}, finish: async () => null };
  await assert.rejects(processNotification(job,message,port),/DB down/); assert.equal(sent,0);
});
test('lost claim and terminal jobs never send', async () => {
  let sent = 0;
  const port: OutboxPort = {claim:async()=>null,deliver:async()=>{sent++;return {estado:'enviado'};},finish:async()=>null};
  assert.equal(await processNotification(job,message,port),null); assert.equal(sent,0);
});
test('claimed snapshot and token are used; missing finish confirmation is an error', async () => {
  const claimed = {...job,estado:'procesando',claim_id:'token',mensaje:message};
  const port: OutboxPort = {claim:async()=>claimed,deliver:async(row)=>{assert.equal(row.claim_id,'token');assert.deepEqual(row.mensaje,message);return {estado:'enviado',recibos:{one:'12'}};},finish:async()=>null};
  await assert.rejects(processNotification(job,message,port),/confirmar.*registro/i);
});
test('unexpected transport exception is recorded uncertain without automatic resend', async () => {
  let sent = 0;
  const claimed = {...job,estado:'procesando',claim_id:'token',mensaje:message};
  const port: OutboxPort = {claim:async()=>claimed,deliver:async()=>{sent++;throw new Error('lost');},finish:async(row,result)=>{assert.equal(result.estado,'incierto');return {...row,estado:result.estado};}};
  assert.equal((await processNotification(job,message,port))?.estado,'incierto'); assert.equal(sent,1);
});
test('a later transport exception retains earlier Telegram receipts', async () => {
  const claimed = {...job,estado:'procesando',claim_id:'token',mensaje:message,detalle:{recibos:{one:'12'}}};
  const port: OutboxPort = {claim:async()=>claimed,deliver:async()=>{throw new Error('lost');},finish:async(row,result)=>{
    assert.deepEqual(result.recibos,{one:'12'});return {...row,estado:result.estado};
  }};
  await processNotification(job,message,port,true,true);
});
