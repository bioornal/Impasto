import type {EstadoPago,MpOrder} from './mercadopago';
import {providerMovimientos, type MovimientoPago} from './payment-ledger';
export interface RecoveryPedido extends Record<string,unknown> {
  id:string; external_reference:string; total:number; estado_pago:string;
  mp_order_id?:string|null; id_pago?:string|null; created_at?:string;
}
export class PaymentRecoveryError extends Error {}
export function canReconcilePayment(value:Record<string,unknown>):boolean {
  return value.proveedor_pago==='mercadopago' && value.metodo_pago==='mercadopago' && ['pendiente','aprobado','parcialmente_reembolsado','reembolsado'].includes(String(value.estado_pago))
    && typeof value.external_reference==='string' && value.external_reference.startsWith('IM-');
}
const fail = () => { throw new PaymentRecoveryError('No se pudo verificar el pago de este pedido. No vuelvas a pagar; requiere revisión.'); };
export function selectRecoveryOrder(page:unknown, reference:string): MpOrder|null {
  const p=page as {data?:MpOrder[];paging?:{total?:unknown;offset?:unknown;total_pages?:unknown}}|null;
  if(!p || !Array.isArray(p.data) || !p.paging || p.paging.total===undefined || p.paging.offset===undefined) return fail();
  const total=Number(p.paging.total),offset=Number(p.paging.offset);
  if(!Number.isInteger(total) || total<0 || offset!==0 || total!==p.data.length || total>1 || (p.paging.total_pages!==undefined && Number(p.paging.total_pages)>1)) return fail();
  if(total===0) return null;
  if(p.data[0].external_reference!==reference) return fail();
  return p.data[0];
}
export function paymentRecoveryValues(pedido:RecoveryPedido,order:MpOrder): {estado_pago:EstadoPago;mp_order_id:string;id_pago:string} {
  let state=providerMovimientos(pedido,order).estadoPago;
  // A stale approval cannot erase a documented refund. Correct old full -> partial only with amounts.
  if(pedido.estado_pago==='reembolsado' && state!=='parcialmente_reembolsado') state='reembolsado';
  else if(pedido.estado_pago==='parcialmente_reembolsado' && !['parcialmente_reembolsado','reembolsado'].includes(state)) state='parcialmente_reembolsado';
  else if(pedido.estado_pago==='aprobado' && !['parcialmente_reembolsado','reembolsado'].includes(state)) state='aprobado';
  else if(pedido.estado_pago==='rechazado' && state==='pendiente') state='rechazado';
  const payments=order.transactions?.payments ?? [];
  if(!Array.isArray(payments)) return fail();
  if(pedido.id_pago && payments.length && !payments.some(p=>String(p.id)===pedido.id_pago)) return fail();
  const idPago=pedido.id_pago || (payments.length===1 ? String(payments[0].id || '') : '');
  return {estado_pago:state,mp_order_id:order.id,id_pago:idPago};
}
export function recoverySearchWindow(createdAt:unknown,now=new Date()):{begin_date:string;end_date:string} {
  if(typeof createdAt!=='string' || !/^\d{4}-\d{2}-\d{2}T/.test(createdAt)) return fail();
  const time=Date.parse(createdAt),end=now.getTime();
  if(!Number.isFinite(time) || !Number.isFinite(end) || time>end+60000) return fail();
  return {begin_date:new Date(time-60000).toISOString(),end_date:new Date(Math.max(end,time)+60000).toISOString()};
}
export interface RecoveryDeps {
  getOrder:(id:string)=>Promise<MpOrder>;
  searchOrders:(reference:string,window:{begin_date:string;end_date:string})=>Promise<unknown>;
  cas:(before:RecoveryPedido,values:Record<string,unknown>)=>Promise<RecoveryPedido|null>;
  reread:()=>Promise<RecoveryPedido>;
  persistMovimientos:(order:MpOrder,movimientos:MovimientoPago[])=>Promise<void>;
}
/** Provider lookups never create/charge an order. Null means absence, not rejection. */
export async function recoverPayment(pedido:RecoveryPedido,deps:RecoveryDeps,providerOrder?:MpOrder) {
  const order=providerOrder ?? (pedido.mp_order_id ? await deps.getOrder(pedido.mp_order_id)
    : selectRecoveryOrder(await deps.searchOrders(pedido.external_reference,recoverySearchWindow(pedido.created_at)),pedido.external_reference));
  if(!order) return {order:await deps.reread(),changed:false,found:false};
  const values=paymentRecoveryValues(pedido,order);
  const proof=providerMovimientos(pedido,order);
  if(proof.totales.devoluciones>0) {
    // The RPC locks the order, rejects incomplete refund snapshots, and derives refund state atomically.
    // Establish provider identifiers first if absent; never CAS a refund state outside that transaction.
    if(values.mp_order_id!==(pedido.mp_order_id ?? '') || values.id_pago!==(pedido.id_pago ?? '')) {
      await deps.cas(pedido,{mp_order_id:values.mp_order_id,id_pago:values.id_pago});
    }
    await deps.persistMovimientos(order,proof.movimientos);
    const current=await deps.reread();
    return {order:current,changed:current.estado_pago!==pedido.estado_pago || current.mp_order_id!==pedido.mp_order_id || current.id_pago!==pedido.id_pago,found:true};
  }
  if(values.estado_pago===pedido.estado_pago && values.mp_order_id===(pedido.mp_order_id ?? '') && values.id_pago===(pedido.id_pago ?? ''))
  {
    if(proof.movimientos.length)await deps.persistMovimientos(order,proof.movimientos);
    return {order:await deps.reread(),changed:false,found:true};
  }
  const updated=await deps.cas(pedido,{...values,...(values.estado_pago==='aprobado' && pedido.estado_pago!=='aprobado' ? {pagado_en:new Date().toISOString()} : {})});
  if(proof.movimientos.length)await deps.persistMovimientos(order,proof.movimientos);
  const current=proof.movimientos.length ? await deps.reread() : updated ?? await deps.reread();
  return {order:current,changed:updated!==null,found:true};
}
