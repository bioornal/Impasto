import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { registrarEvento } from '@/lib/orders';
import { notificarPedido,avisoDesdePedido } from '@/lib/notifications';
import { getOrder,getPayment,verifyWebhookSignature,type MpOrder } from '@/lib/mercadopago';
import { reconcilePayment } from '@/lib/payment-recovery-server';
import { PAYMENT_COLUMNS } from '@/lib/payment-recovery-store';
import type {RecoveryPedido} from '@/lib/payment-recovery';

export async function POST(req:NextRequest) {
  const signedId=req.nextUrl.searchParams.get('data.id') || req.nextUrl.searchParams.get('id');
  if(!verifyWebhookSignature({signatureHeader:req.headers.get('x-signature'),requestId:req.headers.get('x-request-id'),dataId:signedId}))
    return NextResponse.json({ok:false,error:'Firma inválida'},{status:401});
  let payload:Record<string,unknown>={};
  try { payload=await req.json(); } catch { /* Query-only webhook is supported. */ }
  const type=String(payload.type || req.nextUrl.searchParams.get('type') || '');
  const bodyId=(payload.data as {id?:unknown}|undefined)?.id;
  // Never resolve a resource different from the one covered by the signature.
  if(bodyId!==undefined && String(bodyId).toLowerCase()!==String(signedId).toLowerCase()) return NextResponse.json({ok:false,error:'Recurso no firmado'},{status:401});
  if(!signedId || (!type.startsWith('payment') && !type.startsWith('order'))) return NextResponse.json({ok:true,ignored:true});
  try {
    let providerOrder:MpOrder|undefined;
    let reference:string;
    if(type.startsWith('payment')) {
      const payment=await getPayment(signedId);
      if(String(payment?.id)!==signedId) throw new Error('El recurso de Mercado Pago no coincide');
      reference=String(payment?.external_reference || '');
      // payment.order.id can refer to a legacy merchant order. Do not treat it
      // as an Orders API id or approve from a payment payload alone.
    } else {
      providerOrder=await getOrder(signedId);
      if(providerOrder.id.toLowerCase()!==signedId.toLowerCase()) throw new Error('La orden de Mercado Pago no coincide');
      reference=String(providerOrder.external_reference || '');
    }
    if(!reference) return NextResponse.json({ok:true,ignored:true});
    const {data,error}=await db.database.from('pedidos').select(PAYMENT_COLUMNS).eq('external_reference',reference).eq('proyecto_id','impasto').limit(1);
    if(error || !Array.isArray(data)) throw new Error('No se pudo leer el pedido del webhook');
    const pedido=data[0] as RecoveryPedido|undefined;
    if(!pedido || pedido.proveedor_pago!=='mercadopago' || pedido.metodo_pago!=='mercadopago') return NextResponse.json({ok:true,ignored:true});
    const result=await reconcilePayment(pedido,providerOrder);
    if(result.changed) await registrarEvento({pedidoId:pedido.id,tipo:'pago',valor:result.order.estado_pago,origen:'webhook',detalle:{notificacion:type,recurso:signedId}});
    // Even unchanged approval can have a durable notification still pending.
    // Use the confirmed row, including a reread after a lost CAS.
    if(result.order.estado_pago==='aprobado') {
      try { await notificarPedido(avisoDesdePedido(result.order),'pago_aprobado'); } catch { /* The notification queue retains failures. */ }
    }
    return NextResponse.json({ok:true,unchanged:!result.changed});
  } catch {
    return NextResponse.json({ok:false,error:'No se pudo verificar el pago; se reintentará la notificación'},{status:500});
  }
}
