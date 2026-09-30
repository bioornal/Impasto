import type {db} from './insforge';
import type {RecoveryPedido} from './payment-recovery';
import {DatabaseOperationError} from './db-result';
export const PAYMENT_COLUMNS='id,sucursal_id,estado_pago,mp_order_id,id_pago,pagado_en,created_at,proveedor_pago,metodo_pago,status,numero_pedido,external_reference,nombre_cliente,telefono_cliente,email_cliente,direccion,modalidad,productos,subtotal,envio,total,cuenta_transferencia,notas';
export function paymentRecoveryStore(client:Pick<typeof db,'database'>,pedidoId:string) {
  const reread=async():Promise<RecoveryPedido>=>{
    const {data,error}=await client.database.from('pedidos').select(PAYMENT_COLUMNS).eq('id',pedidoId).eq('proyecto_id','impasto').limit(1);
    if(error || !Array.isArray(data) || data.length!==1) throw new DatabaseOperationError('No se pudo recargar el pedido confirmado');
    return data[0] as RecoveryPedido;
  };
  const cas=async(before:RecoveryPedido,values:Record<string,unknown>):Promise<RecoveryPedido|null>=>{
    let query=client.database.from('pedidos').update(values).eq('id',before.id).eq('proyecto_id','impasto').eq('estado_pago',before.estado_pago);
    query=before.mp_order_id===null ? query.is('mp_order_id',null) : query.eq('mp_order_id',before.mp_order_id ?? '');
    query=before.id_pago===null ? query.is('id_pago',null) : query.eq('id_pago',before.id_pago ?? '');
    const {data,error}=await query.select(PAYMENT_COLUMNS);
    if(error || !Array.isArray(data) || data.length>1) throw new DatabaseOperationError('No se pudo confirmar el estado del pago');
    return (data[0] as RecoveryPedido | undefined) ?? null;
  };
  return {reread,cas};
}
