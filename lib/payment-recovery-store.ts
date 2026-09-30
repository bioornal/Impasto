import type {db} from './insforge';
import type {RecoveryPedido} from './payment-recovery';
import {DatabaseOperationError} from './db-result';
import type {MpOrder} from './mercadopago';
import {resumenGuardado, type MovimientoPago, type MovimientoGuardado} from './payment-ledger';
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
  const persistMovimientos=async(order:MpOrder,movimientos:MovimientoPago[]):Promise<void>=>{
    const {data,error}=await client.database.rpc('registrar_movimientos_pago',{p_pedido_id:pedidoId,p_mp_order_id:order.id,p_movimientos:movimientos});
    if(error || !Array.isArray(data) || data.length<movimientos.length)throw new DatabaseOperationError('Falta conciliar los movimientos documentados. No vuelvas a cobrar ni devolver.');
    resumenGuardado(data as MovimientoGuardado[]);
    for(const proof of movimientos) {
      const saved=(data as MovimientoGuardado[]).find(row=>row.clave===proof.clave && row.pedido_id===pedidoId);
      if(!saved || saved.tipo!==proof.tipo || Number(saved.monto_centavos)!==proof.monto_centavos || saved.metodo_pago!==proof.metodo_pago || saved.ocurrido_en!==proof.ocurrido_en || saved.fecha_fuente!==proof.fecha_fuente)throw new DatabaseOperationError('La devolución requiere conciliación de importes; no repitas el movimiento.');
    }
  };
  const reservarDevolucion=async(orderId:string,solicitud:{total:true}|{transaction_id:string;amount_centavos:number}):Promise<string>=>{
    const {data,error}=await client.database.rpc('reservar_devolucion_pago',{p_pedido_id:pedidoId,p_mp_order_id:orderId,p_solicitud:solicitud});
    if(error || typeof data!=='string' || !data.startsWith(`refund-${orderId}-`))throw new DatabaseOperationError('No se pudo reservar una devolución segura. Los pedidos anteriores requieren revisión manual en Mercado Pago; podés consultar para conciliar devoluciones existentes.');
    return data;
  };
  return {reread,cas,persistMovimientos,reservarDevolucion};
}
