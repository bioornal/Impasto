import assert from 'node:assert/strict';
import type { AdminOrder } from '../app/admin/components/types';
import { adminPrintJob, sendAdminPrint } from '../lib/admin-print-job';

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

let sent = 0;
const print = async (candidate: typeof job) => {
  sent++;
  assert.equal(candidate.attemptId, `attempt-${sent}`);
  assert.equal(candidate.reprint, sent === 2);
  return 'queued' as const;
};
assert.equal(await sendAdminPrint(base, 'attempt-1', print), 'queued');
assert.equal(await sendAdminPrint(base, 'attempt-2', print, true), 'queued');
assert.equal(sent, 2, 'each explicit print receives a fresh attempt id');
for (const blocked of [
  { ...base, estado: 'cancelado' },
  { ...base, pago: 'mercadopago', pagoEstado: 'pendiente' },
  { ...base, pago: 'mercadopago', pagoEstado: 'rechazado' },
  { ...base, items: [] },
]) {
  await assert.rejects(sendAdminPrint(blocked, 'blocked', print), /bloquead|sin productos/i);
}
assert.equal(sent, 2, 'blocked orders never reach printer');
process.stdout.write('PASA impresión manual Impasto: contenido, pagos, claves y bloqueo\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
