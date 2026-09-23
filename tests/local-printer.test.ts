import assert from 'node:assert/strict';
import { configurePrinter, newAttemptId, printLocal, printerHealth } from '../lib/local-printer';

async function main() {
const memory = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
} };
const job = { attemptId: 'stable-1', source: 'impasto', orderId: 'order-42', reprint: false,
  receipt: { kind: 'retiro', date: '23/09/2026 20:30', number: '42', customer: 'Ana', phone: '', address: '', notes: '',
    items: [{ name: 'Pizza', quantity: 1, detail: 'Sin sal', unitPrice: 1000 }], total: 1000, paymentMethod: 'efectivo', paymentStatus: 'pendiente' } } as const;
const token = 'unit-test-only-token-123456789012345';
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

await assert.rejects(printLocal(job), /emparej/i);
assert.equal(await printerHealth(() => { throw new TypeError('offline'); }), false);
await assert.rejects(configurePrinter(token, async () => reply(403, { error: 'pairing_required' })), /emparej/i);
assert.equal(memory.size, 0, 'invalid token not stored');
let healthUrl = '';
await configurePrinter(token, async (url, init) => {
  healthUrl = String(url);
  assert.equal((init?.headers as Record<string, string>)['X-Printer-Token'], token);
  return reply(200, { status: 'available', paired: true });
});
assert.equal(healthUrl, 'http://127.0.0.1:8765/health');
assert.equal(memory.size, 1, 'token stored only after pairing');
assert.equal(await printerHealth(async () => reply(200, { paired: true })), true);
assert.equal(await printerHealth(async () => reply(200, { paired: false })), false);

const sent: Array<{ url: string; init: RequestInit }> = [];
const queued = async (url: RequestInfo | URL, init?: RequestInit) => {
  sent.push({ url: String(url), init: init! });
  return reply(200, { status: 'queued', duplicate: sent.length > 1 });
};
const originalLog = console.log;
console.log = () => { throw new Error('PII logged'); };
try {
  assert.equal(await printLocal(job, queued), 'queued');
  assert.equal(await printLocal(job, queued), 'duplicate');
} finally { console.log = originalLog; }
assert.equal(sent[0].url, 'http://127.0.0.1:8765/print');
assert.equal(sent[0].init.method, 'POST');
assert.equal((sent[0].init.headers as Record<string, string>)['X-Printer-Token'], token);
assert.equal(JSON.parse(sent[0].init.body as string).attemptId, 'stable-1');
assert.deepEqual(sent.map(call => JSON.parse(call.init.body as string)), [job, job], 'retry keeps same key');
assert.ok(sent[0].init.signal instanceof AbortSignal);
await assert.rejects(printLocal(job, async () => reply(403, { error: 'pairing_required' })), /emparej/i);
await assert.rejects(printLocal(job, async () => { throw new TypeError('Failed to fetch'); }), /agente no disponible/i);
assert.match(newAttemptId(), /^[0-9a-f-]{36}$/i);
assert.notEqual(newAttemptId(), newAttemptId());
process.stdout.write('PASA cliente local: emparejamiento, CORS, duplicado, timeout y datos privados\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
