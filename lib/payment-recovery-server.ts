import {db} from './insforge';
import {getOrder,searchOrders,type MpOrder} from './mercadopago';
import {recoverPayment,type RecoveryPedido} from './payment-recovery';
import {paymentRecoveryStore} from './payment-recovery-store';
export async function reconcilePayment(pedido:RecoveryPedido,providerOrder?:MpOrder) {
  if(pedido.proveedor_pago!=='mercadopago' || pedido.metodo_pago!=='mercadopago') throw new Error('Este pedido no tiene un pago online de Mercado Pago');
  return recoverPayment(pedido,{getOrder,searchOrders,...paymentRecoveryStore(db,pedido.id)},providerOrder);
}
