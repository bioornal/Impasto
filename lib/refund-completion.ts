import { mapOrderStatus, type MpOrder } from './mercadopago';

/** Read the provider first so a retry after a DB failure cannot initiate another refund. */
export async function completeRefund(actions: {
  current: () => Promise<MpOrder>;
  refund: () => Promise<MpOrder>;
  persist: (order: MpOrder) => Promise<void>;
}) {
  const current = await actions.current();
  const recovered = current.status === 'refunded'
    || (current.status === 'processed' && current.status_detail === 'partially_refunded');
  if (!recovered && mapOrderStatus(current.status, current.status_detail) !== 'aprobado') {
    throw new Error('Mercado Pago no informa un pago aprobado para devolver.');
  }
  const order = recovered ? current : await actions.refund();
  const refundCompleted = order.status === 'refunded'
    || (order.status === 'processed' && order.status_detail === 'partially_refunded');
  if (!refundCompleted) throw new Error('Mercado Pago aún no confirmó la devolución. Revisá el pago antes de reintentar.');
  let persistencePending = false;
  try { await actions.persist(order); } catch { persistencePending = true; }
  return { order, recovered, refundCompleted, persistencePending, estadoPago: mapOrderStatus(order.status, order.status_detail) };
}
