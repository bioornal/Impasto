import {NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/admin-auth';
import {db} from '@/lib/insforge';
import {SUCURSAL_ID} from '@/lib/business';
import {leerMovimientosPedido} from '@/lib/payment-ledger';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}) {
 const unauthorized=await requireAdmin();if(unauthorized)return unauthorized;
 const {id}=await params;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return NextResponse.json({ok:false,error:'Pedido inválido'},{status:400});
 try {
  const lookup=await db.database.from('pedidos').select('id').eq('id',id).eq('proyecto_id','impasto').eq('sucursal_id',SUCURSAL_ID).limit(1);
  if(lookup.error || !Array.isArray(lookup.data))throw new Error('lookup');
  if(lookup.data.length!==1)return NextResponse.json({ok:false,error:'Pedido no disponible'},{status:404});
  const result=await leerMovimientosPedido(offset=>db.database.from('pedido_movimientos').select('id,pedido_id,clave,tipo,monto_centavos,metodo_pago,ocurrido_en,fecha_fuente')
   .eq('pedido_id',id).eq('proyecto_id','impasto').eq('sucursal_id',SUCURSAL_ID).order('id',{ascending:true}).range(offset,offset+499));
  return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'no-store'}});
 } catch {return NextResponse.json({ok:false,error:'Movimientos no disponibles; no se pueden afirmar importes conciliados.'},{status:503});}
}
