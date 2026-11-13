import { NextResponse } from "next/server";
import { getBusinessConfig } from "@/lib/business-server";
import { estadoTienda } from "@/lib/hours";
import { leerStockBebidas } from '@/lib/stock-bebidas-server';
import { stockPorId } from '@/lib/stock-bebidas';

/** La home se cachea con ISR; el estado de venta tiene que ser siempre fresco. */
export const dynamic = "force-dynamic";

export async function GET() {
  const [business, filas] = await Promise.all([getBusinessConfig(), leerStockBebidas()]);
  const estado = estadoTienda(business);
  return NextResponse.json(
    { ok: true, ...estado, masasNoche: business.masasNoche ?? null, horario: business.hours, ...(filas === null ? {} : { stockBebidas: stockPorId(filas) }) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
