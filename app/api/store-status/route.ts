import { NextResponse } from "next/server";
import { getBusinessConfig } from "@/lib/business-server";
import { estadoTienda } from "@/lib/hours";

/** La home se cachea con ISR; el estado de venta tiene que ser siempre fresco. */
export const dynamic = "force-dynamic";

export async function GET() {
  const business = await getBusinessConfig();
  const estado = estadoTienda(business);
  return NextResponse.json(
    { ok: true, ...estado, horario: business.hours },
    { headers: { "Cache-Control": "no-store" } },
  );
}
