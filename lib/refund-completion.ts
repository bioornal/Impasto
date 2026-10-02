import type {MpOrder} from './mercadopago';
import {providerMovimientos, type LedgerPedido} from './payment-ledger';
export interface RefundOperation {
  operationId:string; key:string; request:{transaction_id:string;amount_centavos:number};
  gross:number; baseline:Array<{clave:string;monto_centavos:number}>; confirmedRefund:string|null;
}
export function refundAuditAmount(result:{recovered:boolean;amountCentavos?:number}) {
  return result.recovered || result.amountCentavos===undefined ? {} : {monto:result.amountCentavos/100,monto_centavos:result.amountCentavos};
}
/** A new intention is separate from old refunds; only a matching fresh GET delta confirms it. */
export async function completeRefundOperation(actions:{
  pedido:LedgerPedido; current:()=>Promise<MpOrder>; persist:(order:MpOrder)=>Promise<void>;
  reserve:()=>Promise<RefundOperation>; refund:(intent:RefundOperation)=>Promise<unknown>;
  confirm:(intent:RefundOperation,order:MpOrder)=>Promise<void>;
}) {
  let order=await actions.current();
  let proof=providerMovimientos(actions.pedido,order);
  // Persist the provider baseline before reserving under the pedido row lock.
  await actions.persist(order);
  const intent=await actions.reserve();
  const delta=()=>{
    if(proof.totales.cobros!==intent.gross)throw new Error('Cobro incompatible con la intención');
    const refunds=proof.movimientos.filter(m=>m.tipo==='devolucion');
    for(const old of intent.baseline)if(!refunds.some(m=>m.clave===old.clave && m.monto_centavos===old.monto_centavos))throw new Error('Devoluciones anteriores requieren conciliación');
    const fresh=refunds.filter(m=>!intent.baseline.some(old=>old.clave===m.clave));
    if(intent.confirmedRefund){
      if(!refunds.some(m=>m.clave===intent.confirmedRefund && m.monto_centavos===intent.request.amount_centavos))throw new Error('Falta la devolución confirmada');
      return true;
    }
    if(!fresh.length)return false;
    if(fresh.length!==1 || fresh[0].monto_centavos!==intent.request.amount_centavos)throw new Error('La devolución nueva no coincide con la intención; requiere conciliación manual');
    return true;
  };
  const recovered=delta();
  if(!recovered){
    if(proof.totales.neto<intent.request.amount_centavos)throw new Error('Monto superior al saldo disponible');
    await actions.refund(intent);
    order=await actions.current();proof=providerMovimientos(actions.pedido,order);
    if(!delta())throw new Error('Mercado Pago aún no confirmó la devolución nueva; conservá el intento');
  }
  let persistencePending=false;
  try{await actions.confirm(intent,order);}catch{persistencePending=true;}
  return {order,recovered,refundCompleted:true,persistencePending,estadoPago:proof.estadoPago,totales:proof.totales,amountCentavos:intent.request.amount_centavos};
}

/** Requests without a durable operation UUID may reconcile, but cannot initiate money movement. */
export async function reconcileRefundOnly(actions:{pedido:LedgerPedido;current:()=>Promise<MpOrder>;persist:(order:MpOrder)=>Promise<void>}) {
  const order=await actions.current(),proof=providerMovimientos(actions.pedido,order);
  if(proof.totales.devoluciones<=0)throw new Error('No hay devoluciones confirmadas para conciliar. Iniciá una operación identificada.');
  let persistencePending=false;try{await actions.persist(order);}catch{persistencePending=true;}
  return {order,recovered:true,refundCompleted:true,persistencePending,estadoPago:proof.estadoPago,totales:proof.totales};
}
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
