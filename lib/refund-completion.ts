import type {MpOrder} from './mercadopago';
import {providerMovimientos, type LedgerPedido} from './payment-ledger';
/** Read before posting, and read again afterwards: POST may omit the gross payment/refunds. */
export async function completeRefund(actions: {
  pedido: LedgerPedido & { estado_pago?: string };
  current: () => Promise<MpOrder>;
  reserve: () => Promise<string>;
  refund: (reservedKey:string) => Promise<MpOrder>;
  persist: (order: MpOrder) => Promise<void>;
}) {
  const current = await actions.current();
  const before = providerMovimientos(actions.pedido,current);
  const recovered = before.totales.devoluciones>0;
  if (!recovered && before.estadoPago!=='aprobado') throw new Error('Mercado Pago no informa un pago aprobado para devolver.');
  if(!recovered && ['parcialmente_reembolsado','reembolsado'].includes(actions.pedido.estado_pago ?? ''))throw new Error('Ya existe una devolución local sin importes conciliados. Consultá Mercado Pago; no se inició otra devolución.');
  if(!recovered) {
    // Freeze the first intention before any provider mutation. Legacy orders cannot reserve automatically.
    const reservedKey=await actions.reserve();
    if(typeof reservedKey!=='string' || !reservedKey)throw new Error('No se pudo reservar una devolución segura. Revisá Mercado Pago manualmente.');
    await actions.refund(reservedKey);
  }
  const order = recovered ? current : await actions.current();
  const proof = providerMovimientos(actions.pedido,order);
  if(proof.totales.devoluciones<=0)throw new Error('Mercado Pago aún no confirmó importes de devolución. Consultá el pago; no inicies otra devolución.');
  let persistencePending = false;
  try { await actions.persist(order); } catch { persistencePending = true; }
  return { order, recovered, refundCompleted:true, persistencePending, estadoPago:proof.estadoPago, totales:proof.totales };
}
