import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliverEmail, deliverTelegram } from '../lib/notification-delivery';

const mail = { provider: 'resend' as const, from: 'local@example.com', to: 'cliente@example.com', subject: 'Pedido', html: '<p>Uno</p>' };
test('Resend retains the notification key and frozen body', async () => {
  let sent: RequestInit | undefined;
  const result = await deliverEmail(mail, 'notice-1', 'secret', async (_, init) => { sent = init; return Response.json({ id: 'receipt' }); });
  assert.equal(result.estado, 'enviado');
  assert.equal((sent?.headers as Record<string,string>)['Idempotency-Key'], 'notice-1');
  assert.deepEqual(JSON.parse(String(sent?.body)), { from: mail.from, to: mail.to, subject: mail.subject, html: mail.html });
});
test('email network errors, server errors and missing receipts are uncertain', async () => {
  for (const fetcher of [async () => { throw new Error('timeout'); }, async () => Response.json({}, { status: 503 }), async () => Response.json({})]) {
    assert.equal((await deliverEmail(mail, 'one', 'secret', fetcher)).estado, 'incierto');
  }
  assert.equal((await deliverEmail(mail, 'one', 'secret', async () => Response.json({}, { status: 422 }))).estado, 'fallido');
});
test('Telegram keeps partial receipts and only retries missing recipients', async () => {
  const first = await deliverTelegram({ chatIds: ['a', 'b'], text: '<cliente>' }, {}, 'secret', async (_, init) => {
    const body = JSON.parse(String(init?.body)); assert.equal(body.parse_mode, undefined);
    return body.chat_id === 'a' ? Response.json({ ok: true, result: { message_id: 12 } }) : Response.json({ ok: false }, { status: 403 });
  });
  assert.equal(first.estado, 'fallido'); assert.deepEqual(first.recibos, { a: '12' });
  const called: string[] = [];
  const second = await deliverTelegram({ chatIds: ['a', 'b'], text: '<cliente>' }, first.recibos, 'secret', async (_, init) => {
    called.push(JSON.parse(String(init?.body)).chat_id); return Response.json({ ok: true, result: { message_id: 15 } });
  });
  assert.equal(second.estado, 'enviado'); assert.deepEqual(called, ['b']); assert.deepEqual(second.recibos, { a: '12', b: '15' });
});
test('Telegram timeout and malformed success are uncertain; unconfigured does no IO', async () => {
  const message = { chatIds: ['a'], text: 'Pedido' };
  for (const fetcher of [async () => { throw new Error('timeout'); }, async () => Response.json({ ok: true })]) {
    assert.equal((await deliverTelegram(message, {}, 'secret', fetcher)).estado, 'incierto');
  }
  const result = await deliverTelegram(message, {}, '', async () => { throw new Error('must not send'); });
  assert.equal(result.estado, 'omitido');
});
