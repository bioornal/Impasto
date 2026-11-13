import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/insforge';
import { invalidarCatalogo } from '@/lib/catalog-cache';
import { leerStockBebidas } from '@/lib/stock-bebidas-server';
import { stockDesdeTexto } from '@/lib/stock-bebidas';

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const data = await leerStockBebidas();
  if (data === null) return NextResponse.json({ok:false,error:'No se pudo leer el stock. Reintentá.'},{status:500});
  return NextResponse.json({ok:true,data}, {headers:{'Cache-Control':'no-store'}});
}

/** Fijar unidades actuales, sumar una compra de forma atómica o NULL explícito = sin control. */
export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.producto_id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.producto_id)) {
    return NextResponse.json({ok:false,error:'Elegí una bebida.'},{status:400});
  }
  const compra = Object.hasOwn(body,'compra');
  const ajuste = Object.hasOwn(body,'ajuste');
  const campos = ['compra','ajuste','unidades'].filter(c => Object.hasOwn(body,c));
  const n = ajuste ? (typeof body.ajuste === 'number' && Number.isInteger(body.ajuste) && Math.abs(body.ajuste) <= 2147483647 ? body.ajuste as number : undefined) : stockDesdeTexto(compra ? body.compra : body.unidades);
  if (campos.length !== 1 || n === undefined || ((compra || ajuste) && (n === null || n === 0))) {
    return NextResponse.json({ok:false,error:compra ? 'Poné cuántas bebidas entraron, en unidades enteras mayores a cero.' : 'Poné unidades enteras desde cero o elegí Sin control.'},{status:400});
  }
  // La RPC valida producto/proyecto y bloquea la fila para que una compra no pise una venta.
  const {data,error} = compra || ajuste
    ? await db.database.rpc('cargar_stock_bebida',{p_producto:body.producto_id,p_delta:n,p_motivo:compra ? 'carga' : 'ajuste'})
    : await db.database.rpc('fijar_stock_bebida',{p_producto:body.producto_id,p_unidades:n});
  if (error) return NextResponse.json({ok:false,error:'No se pudo guardar el stock. Revisá la bebida y reintentá.'},{status:400});
  invalidarCatalogo();
  return NextResponse.json({ok:true,data});
}
