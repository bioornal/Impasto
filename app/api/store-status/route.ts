import { NextResponse } from "next/server";
import { getBusinessConfig } from "@/lib/business-server";
import { estadoTienda } from "@/lib/hours";
import { db } from "@/lib/insforge";
import { quedanMasas, type FilaMasas } from "@/lib/masas-noche";
import { diaDeNegocio } from "@/lib/resumen-diario";

/** Masas que quedan esta noche (null = sin límite). Si falla la lectura, sin límite: la base igual controla al guardar. */
async function masasNoche(): Promise<number | null> {
  try {
    const { data, error } = await db.database.from("masas_noche").select("cupo,vendidas")
      .eq("proyecto_id", "impasto").eq("noche", diaDeNegocio(new Date().toISOString())).limit(1);
    if (error) return null;
    return quedanMasas(Array.isArray(data) ? data[0] as FilaMasas | undefined : undefined);
  } catch { return null; }
}

/** La home se cachea con ISR; el estado de venta tiene que ser siempre fresco. */
export const dynamic = "force-dynamic";

export async function GET() {
  const [business, masas] = await Promise.all([getBusinessConfig(), masasNoche()]);
  const estado = estadoTienda(business);
  return NextResponse.json(
    { ok: true, ...estado, masasNoche: masas, horario: business.hours },
    { headers: { "Cache-Control": "no-store" } },
  );
}
