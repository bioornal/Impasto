import type {EstadoPago, MpOrder} from './mercadopago';
import {mapOrderStatus} from './payment-status';
export class PaymentLedgerError extends Error {}
export interface LedgerPedido { estado_pago?:string; external_reference: string; total: unknown; mp_order_id?: string | null; id_pago?: string | null }
export interface MovimientoPago {
 clave:string; tipo:'cobro'|'devolucion'; monto_centavos:number; metodo_pago:'mercadopago'; ocurrido_en:null; fecha_fuente:'desconocida';
}
const fail=():never=>{throw new PaymentLedgerError('Mercado Pago no suministró importes completos y verificables. Conservá el intento y consultá para conciliar.');};
/** Decimal strings are parsed exactly, without floating point multiplication. */
export function pesosACentavos(value:unknown):number {
 if((typeof value!=='string' && typeof value!=='number') || !/^\d+(\.\d{1,2})?$/.test(String(value))) return fail();
 const [whole,decimal='']=String(value).split('.');
 const n=BigInt(whole)*BigInt(100)+BigInt(decimal.padEnd(2,'0'));
 if(n<=BigInt(0) || n>BigInt(Number.MAX_SAFE_INTEGER))return fail();
 return Number(n);
}
/** Order creation timestamps are not dates of collection/refund. Unknown stays NULL, stable on replay. */
export function providerMovimientos(pedido:LedgerPedido,order:MpOrder) {
 if(!order || typeof order.id!=='string' || !order.id || order.external_reference!==pedido.external_reference
  || (pedido.mp_order_id && pedido.mp_order_id!==order.id) || pesosACentavos(order.total_amount)!==pesosACentavos(pedido.total))return fail();
 if(order.currency!==undefined ? order.currency!=='ARS' : order.country_code!=='AR')return fail();
 if(order.country_code!==undefined && order.country_code!=='AR')return fail();
 const refunds=order.transactions?.refunds ?? [];
 if(!Array.isArray(refunds))return fail();
 const providerState=mapOrderStatus(order.status,order.status_detail);
 const hasRefundSignal=['reembolsado','parcialmente_reembolsado'].includes(providerState);
 const hasMoney=providerState==='aprobado' || hasRefundSignal || refunds.length>0;
 if(!hasMoney)return {movimientos:[] as MovimientoPago[],estadoPago:providerState,totales:{cobros:0,devoluciones:0,neto:0}};
 const gross=pesosACentavos(order.total_paid_amount);
 if(gross!==pesosACentavos(pedido.total))return fail();
 const movimientos:MovimientoPago[]=[{clave:`mp-cobro:${order.id}`,tipo:'cobro',monto_centavos:gross,metodo_pago:'mercadopago',ocurrido_en:null,fecha_fuente:'desconocida'}];
 const ids=new Set<string>();let returned=0;
 for(const refund of refunds) {
  if(!refund || typeof refund.id!=='string' || !refund.id || ids.has(refund.id) || refund.status!=='processed')return fail();
  ids.add(refund.id);
  const amount=pesosACentavos(refund.amount);
  if(refund.transaction_id && !order.transactions?.payments?.some(p=>p.id===refund.transaction_id))return fail();
  returned+=amount;if(!Number.isSafeInteger(returned) || returned>gross)return fail();
  movimientos.push({clave:`mp-devolucion:${refund.id}`,tipo:'devolucion',monto_centavos:amount,metodo_pago:'mercadopago',ocurrido_en:null,fecha_fuente:'desconocida'});
 }
 if((hasRefundSignal || ['parcialmente_reembolsado','reembolsado'].includes(pedido.estado_pago ?? '')) && returned===0)return fail();
 if(order.status==='refunded' && returned!==gross)return fail();
 const estadoPago:EstadoPago=returned===gross?'reembolsado':returned>0?'parcialmente_reembolsado':'aprobado';
 return {movimientos,estadoPago,totales:{cobros:gross,devoluciones:returned,neto:gross-returned}};
}
export interface MovimientoGuardado { id:string; pedido_id:string; clave:string; tipo:string; monto_centavos:unknown; metodo_pago:string; ocurrido_en:string|null; fecha_fuente:string }
export function resumenGuardado(rows:MovimientoGuardado[]) {
 let cobros=0,devoluciones=0;const ids=new Set<string>(),keys=new Set<string>();
 for(const row of rows) {
  if(!row.id || ids.has(row.id) || !row.clave || keys.has(row.clave) || !['cobro','devolucion'].includes(row.tipo))return fail();
  ids.add(row.id);keys.add(row.clave);
  if(typeof row.monto_centavos!=='number' && !(typeof row.monto_centavos==='string' && /^\d+$/.test(row.monto_centavos)))return fail();
  const amount=Number(row.monto_centavos);if(!Number.isSafeInteger(amount) || amount<=0)return fail();
  if(row.tipo==='cobro')cobros+=amount;else devoluciones+=amount;
  if(!Number.isSafeInteger(cobros) || !Number.isSafeInteger(devoluciones))return fail();
 }
 if(devoluciones>cobros)return fail();
 return {cobros,devoluciones,neto:cobros-devoluciones,cantidad:rows.length,sinFecha:rows.filter(row=>row.ocurrido_en===null).length};
}
export async function leerMovimientosPedido(read:(offset:number)=>PromiseLike<{data?:MovimientoGuardado[]|null;error?:unknown}>) {
 const rows:MovimientoGuardado[]=[];const seen=new Set<string>();
 while(true) {
  const {data,error}=await read(rows.length);
  if(error || !Array.isArray(data))throw new PaymentLedgerError('No se pudieron cargar los movimientos de este pedido');
  if(!data.length)break;
  for(const row of data) {if(!row.id || seen.has(row.id))return fail();seen.add(row.id);rows.push(row);}
 }
 return {movimientos:rows,totales:resumenGuardado(rows)};
}
