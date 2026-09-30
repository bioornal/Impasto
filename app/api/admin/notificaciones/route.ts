import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/insforge';
import { SUCURSAL_ID } from '@/lib/business';

export async function GET(req: Request) {
  const unauthorized = await requireAdmin(); if (unauthorized) return unauthorized;
  const rawOffset = new URL(req.url).searchParams.get('offset') || '0';
  if(!/^\d{1,7}$/.test(rawOffset)) return NextResponse.json({ok:false,error:'Página inválida'},{status:400});
  const offset = Number(rawOffset);
  // No payload ni HTML del cliente en esta lista. El servidor verifica nuevamente cada pedido al recuperar.
  const {data,error} = await db.database.from('notificaciones')
    .select('id,pedido_id,canal,tipo,estado,intentos,claimed_at,created_at,detalle,payload')
    .neq('estado','enviado').order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+99);
  if(error || !Array.isArray(data)) return NextResponse.json({ok:false,error:'No se pudieron cargar los avisos'},{status:503});
  const ids = [...new Set(data.map(row=>String(row.pedido_id)))];
  if(!ids.length) return NextResponse.json({ok:true,data:[],nextOffset:null});
  const pedidos = await db.database.from('pedidos').select('id,external_reference,status,estado_pago')
    .eq('proyecto_id','impasto').eq('sucursal_id',SUCURSAL_ID).in('id',ids);
  if(pedidos.error || !Array.isArray(pedidos.data)) return NextResponse.json({ok:false,error:'No se pudieron cargar los pedidos de los avisos'},{status:503});
  const allowed = new Map(pedidos.data.map(row=>[String(row.id),row]));
  return NextResponse.json({ok:true,data:data.filter(row=>allowed.has(String(row.pedido_id))).map(row=>({
    ...row,payload:undefined,referencia:allowed.get(String(row.pedido_id))?.external_reference,
    motivo: typeof row.detalle?.motivo === 'string' ? row.detalle.motivo : '',detalle:undefined,
    estado:row.payload === null || row.estado === 'procesando' && (!row.claimed_at || Date.parse(row.claimed_at) <= Date.now()-300_000) ? 'incierto' : row.estado,
  })),nextOffset:data.length===100 ? offset+100 : null});
}
