import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/insforge';
import { SUCURSAL_ID } from '@/lib/business';
import { NOTIFICATION_COLUMNS, recoverNotification } from '@/lib/notification-server';
import type { NotificationJob } from '@/lib/notification-outbox';

export async function POST(req: NextRequest, context: {params:Promise<{id:string}>}) {
  const unauthorized = await requireAdmin(); if (unauthorized) return unauthorized;
  const {id} = await context.params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ok:false,error:'Aviso inválido'},{status:400});
  let body: unknown; try {body=await req.json();} catch {return NextResponse.json({ok:false,error:'JSON inválido'},{status:400});}
  if(!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ok:false,error:'JSON inválido'},{status:400});
  const confirm = (body as Record<string,unknown>).confirmarDuplicado === true;
  try {
    const {data,error} = await db.database.from('notificaciones').select(NOTIFICATION_COLUMNS).eq('id',id).limit(1);
    if(error) throw new Error('No se pudo cargar el aviso');
    if(!Array.isArray(data) || data.length !== 1) return NextResponse.json({ok:false,error:'Aviso no encontrado'},{status:404});
    const job = data[0] as NotificationJob;
    const pedido = await db.database.from('pedidos').select('id').eq('id',job.pedido_id).eq('proyecto_id','impasto').eq('sucursal_id',SUCURSAL_ID).limit(1);
    if(pedido.error) throw new Error('No se pudo validar el pedido');
    if(!Array.isArray(pedido.data) || pedido.data.length !== 1) return NextResponse.json({ok:false,error:'Aviso no encontrado'},{status:404});
    const result = await recoverNotification(job,true,confirm);
    if(!result) return NextResponse.json({ok:false,error:'El aviso no está disponible: puede estar en proceso, ya enviado, requerir confirmar posible duplicado o pertenecer a un pedido cancelado'},{status:409});
    return NextResponse.json({ok:true,estado:result.estado});
  } catch { return NextResponse.json({ok:false,error:'No se pudo confirmar la recuperación. Actualizá la lista antes de volver a intentarlo.'},{status:503}); }
}
