import {NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/admin-auth';
import {db} from '@/lib/insforge';
import {PAYMENT_COLUMNS} from '@/lib/payment-recovery-store';
import type {RecoveryPedido} from '@/lib/payment-recovery';
import {SUCURSAL_ID} from '@/lib/business';
import {reconcilePayment} from '@/lib/payment-recovery-server';
import {notificarPedido,avisoDesdePedido} from '@/lib/notifications';
import {registrarEvento} from '@/lib/orders';
import {adaptOrder} from '@/lib/adapt-order';
export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}) {
  const unauthorized=await requireAdmin();if(unauthorized) return unauthorized;
  const {id}=await params;
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return NextResponse.json({ok:false,error:'Pedido inválido'},{status:400});
  try {
    const {data,error}=await db.database.from('pedidos').select(PAYMENT_COLUMNS).eq('id',id)
      .eq('proyecto_id','impasto').eq('sucursal_id',SUCURSAL_ID).like('external_reference','IM-%').limit(1);
    if(error || !Array.isArray(data)) throw new Error('No se pudo verificar el pedido');
    if(data.length!==1) return NextResponse.json({ok:false,error:'Pedido no disponible'},{status:404});
    const pedido=data[0] as RecoveryPedido;
    if(pedido.proveedor_pago!=='mercadopago' || pedido.metodo_pago!=='mercadopago') return NextResponse.json({ok:false,error:'Este pedido no tiene un pago online de Mercado Pago'},{status:409});
    const result=await reconcilePayment(pedido);
    if(result.changed) await registrarEvento({pedidoId:id,tipo:'pago',valor:result.order.estado_pago,origen:'panel',detalle:{accion:'consulta_mercadopago'}});
    if(result.order.estado_pago==='aprobado') {
      try { await notificarPedido(avisoDesdePedido(result.order),'pago_aprobado'); } catch { /* Durable retry remains eligible. */ }
    }
    return NextResponse.json({ok:true,found:result.found,changed:result.changed,order:adaptOrder(result.order)});
  } catch {
    return NextResponse.json({ok:false,error:'No se pudo confirmar el pago. Conservá este intento y volvé a consultar.'},{status:503});
  }
}
