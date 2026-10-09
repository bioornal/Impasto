import assert from 'node:assert/strict';
import type { AdminOrder } from '../app/admin/components/types';
import { adminPrintJob, adminPrintJobs } from '../lib/admin-print-job';

async function main() {
const base: AdminOrder = {
  _dbId: 'db-42', id: 'IM-0042', cliente: 'Ana', tel: '123', mode: 'delivery',
  dir: 'Calle 1', zona: '', items: [
    { name: 'Caja empanadas', qty: 1, price: 12000, detail: 'Jamón y queso × 6, carne × 6' },
    { name: 'Pizza mitad y mitad', qty: 1, price: 15000, detail: 'Mitad muzzarella, mitad napolitana' },
  ], subtotal: 27000, shipping: 1000, total: 28000, pago: 'efectivo',
  pagoEstado: 'pendiente', cambio: '', referencia: 'Portón azul', cuando: 'asap',
  estado: 'nuevo', fecha: '2026-09-23T23:30:00.000Z', notas: 'Sin cebolla',
};

const job = adminPrintJob(base, 'attempt-1', true);
assert.equal(job.source, 'impasto');
assert.equal(job.orderId, 'db-42');
assert.equal(job.reprint, true);
assert.equal(job.receipt.kind, 'delivery');
assert.match(job.receipt.address ?? '', /Calle 1.*Portón azul/);
assert.equal(job.receipt.items[0].detail, 'Jamón y queso × 6, carne × 6');
assert.equal(job.receipt.items[1].detail, 'Mitad muzzarella, mitad napolitana');
assert.match(job.receipt.notes ?? '', /Sin cebolla/);
assert.equal(job.receipt.paymentStatus, 'pendiente');

const retiro = adminPrintJob({ ...base, mode: 'takeaway', dir: '', referencia: '' }, 'attempt-2', false);
assert.equal(retiro.receipt.kind, 'retiro');
assert.equal(retiro.receipt.address, '');
assert.equal(retiro.reprint, false);

assert.equal(adminPrintJob({ ...base, numero: '718688' }, 'attempt-8', false).receipt.number, '718688', 'la comanda imprime el número corto, no la referencia');
assert.equal(adminPrintJob(base, 'attempt-8', false).receipt.number, 'IM-0042', 'sin número corto usa la referencia');
const cocina = adminPrintJob(base, 'attempt-9', false);
assert.equal(cocina.copy, undefined, 'la comanda de cocina no cambia');
assert.equal('subtotal' in cocina.receipt, false);
assert.equal('lineTotal' in cocina.receipt.items[0], false);
const cliente = adminPrintJob({ ...base, items: [...base.items, { name: 'Pizza POS', qty: 2, price: 10000, extra: 500 }] }, 'attempt-9', false, 'cliente');
assert.equal(cliente.copy, 'cliente');
assert.equal(cliente.attemptId, 'attempt-9:cliente');
assert.equal(cliente.receipt.subtotal, 27000);
assert.equal(cliente.receipt.shipping, 1000);
assert.deepEqual(cliente.receipt.items.map(i => i.lineTotal), [12000, 15000, 20500], 'importe con extra');
assert.deepEqual(adminPrintJobs(base, 'k', false).map(j => j.attemptId), ['k', 'k:cliente']);
assert.deepEqual(adminPrintJobs(base, 'k', true, ['cliente']).map(j => j.copy), ['cliente']);
for (const blocked of [
  { ...base, estado: 'cancelado' },
  { ...base, pago: 'mercadopago', pagoEstado: 'pendiente' },
  { ...base, pago: 'mercadopago', pagoEstado: 'rechazado' },
  { ...base, items: [] },
]) {
  assert.throws(() => adminPrintJobs(blocked, 'blocked', false), /bloquead|sin productos/i);
}
process.stdout.write('PASA impresión manual Impasto: contenido, pagos, claves y bloqueo\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
