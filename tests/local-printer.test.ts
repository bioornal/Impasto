import assert from 'node:assert/strict';
import { AgenteSinCopiaCliente, configurePrinter, getPrinterSelection, imprimirCopias, mensajeCopias, newAttemptId, printCopy, printLocal, printerHealth, printerVersion, selectPrinter, type PrintJob } from '../lib/local-printer';

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
const selectionCalls: Array<{ url: string; init: RequestInit }> = [];
const selectionFetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
  selectionCalls.push({ url: String(url), init: init! });
  return reply(200, init?.method === 'POST'
    ? { selected: '3nstar' }
    : { selected: 'epson', epsonAvailable: true, threeNStarAvailable: true });
};
assert.deepEqual(await getPrinterSelection(selectionFetcher), { selected: 'epson', epsonAvailable: true, threeNStarAvailable: true });
assert.deepEqual(await selectPrinter('3nstar', selectionFetcher), { selected: '3nstar' });
assert.equal(selectionCalls[0].url, 'http://127.0.0.1:8765/printers');
assert.equal(selectionCalls[1].init.method, 'POST');
assert.equal(JSON.parse(selectionCalls[1].init.body as string).printer, '3nstar');
await assert.rejects(selectPrinter('3nstar', async () => reply(409, { error: 'printer_unavailable' })), /disponible/i);

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
const fake = (handler: (url: string) => Response | Promise<Response>) => (async (url: RequestInfo | URL) => handler(String(url))) as typeof fetch;
assert.equal(await printerVersion(fake(() => reply(200, { status: 'available', version: '3', paired: true }))), 3);
assert.equal(await printerVersion(fake(() => reply(200, { status: 'available', version: '2', paired: true }))), 2);
assert.equal(await printerVersion(fake(() => { throw new TypeError('offline'); })), null);
const cocinaJob: PrintJob = job;
const clienteJob: PrintJob = { ...job, attemptId: 'stable-1:cliente', copy: 'cliente', receipt: { ...job.receipt, subtotal: 1000, shipping: 0 } };
const viejoCalls: string[] = [];
await assert.rejects(printCopy(clienteJob, fake(url => { viejoCalls.push(url); return reply(200, { status: 'available', version: '2', paired: true }); })), AgenteSinCopiaCliente);
assert.deepEqual(viejoCalls, ['http://127.0.0.1:8765/health'], 'un agente viejo nunca recibe la copia del cliente');
await assert.rejects(printCopy(clienteJob, fake(() => { throw new TypeError('offline'); })), /agente no disponible/i);
const nuevoCalls: string[] = [];
assert.equal(await printCopy(clienteJob, fake(url => { nuevoCalls.push(url); return url.endsWith('/health') ? reply(200, { version: '3', paired: true }) : reply(200, { status: 'queued', duplicate: false }); })), 'queued');
assert.deepEqual(nuevoCalls, ['http://127.0.0.1:8765/health', 'http://127.0.0.1:8765/print']);
const cocinaCalls: string[] = [];
assert.equal(await printCopy(cocinaJob, fake(url => { cocinaCalls.push(url); return reply(200, { status: 'queued' }); })), 'queued');
assert.deepEqual(cocinaCalls, ['http://127.0.0.1:8765/print'], 'la cocina no consulta la versión');
const orden: string[] = [];
const todo = await imprimirCopias([cocinaJob, clienteJob], async j => { orden.push(j.copy ?? 'cocina'); return 'queued'; });
assert.deepEqual(orden, ['cocina', 'cliente'], 'cocina primero');
assert.deepEqual(todo.pendientes, []);
assert.deepEqual(mensajeCopias([cocinaJob, clienteJob], todo), { ok: true, texto: 'Comanda de cocina y copia del cliente enviadas a la cola.' });
const sinCocina = await imprimirCopias([cocinaJob, clienteJob], async () => { throw new Error('Agente no disponible; el pedido sigue guardado.'); });
assert.deepEqual(sinCocina.pendientes.map(j => j.attemptId), ['stable-1', 'stable-1:cliente'], 'si falla la cocina no se intenta la del cliente');
assert.deepEqual(mensajeCopias([cocinaJob, clienteJob], sinCocina), { ok: false, texto: 'Agente no disponible; el pedido sigue guardado.' });
const sinCliente = await imprimirCopias([cocinaJob, clienteJob], async j => { if (j.copy === 'cliente') throw new Error('Sin papel.'); return 'queued'; });
assert.deepEqual(sinCliente.pendientes.map(j => j.attemptId), ['stable-1:cliente'], 'el reintento manda solo la que faltó');
assert.deepEqual(mensajeCopias([cocinaJob, clienteJob], sinCliente), { ok: false, texto: 'Comanda de cocina enviada; copia del cliente no enviada. Sin papel.' });
const viejo = await imprimirCopias([cocinaJob, clienteJob], async j => { if (j.copy === 'cliente') throw new AgenteSinCopiaCliente(); return 'queued'; });
assert.deepEqual(viejo.pendientes, [], 'con agente viejo no queda nada para reintentar');
assert.equal(viejo.agenteViejo, true);
assert.deepEqual(mensajeCopias([cocinaJob, clienteJob], viejo), { ok: false, texto: 'Comanda de cocina enviada a la cola. Actualizá el agente de impresión para imprimir la copia del cliente.' });
assert.deepEqual(mensajeCopias([clienteJob], await imprimirCopias([clienteJob], async () => 'queued')), { ok: true, texto: 'Copia del cliente enviada a la cola.' });
assert.deepEqual(mensajeCopias([cocinaJob], await imprimirCopias([cocinaJob], async () => 'queued')), { ok: true, texto: 'Comanda de cocina enviada a la cola.' });
process.stdout.write('PASA cliente local: emparejamiento, CORS, duplicado, timeout y datos privados\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
