import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { invalidarCatalogo } from "@/lib/catalog-cache";
import { masasDesdeTexto, type FilaMasas } from "@/lib/masas-noche";
import { diaDeNegocio } from "@/lib/resumen-diario";

// Masas de la noche (24/10/2026). La noche la decide el servidor: de 06:00 a 05:59, hora de Argentina.
const PROYECTO = "impasto";

/** `{ noche, data }`: data null = todavía no se vendió ninguna pizza ni se cargó nada (sin límite). */
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const noche = diaDeNegocio(new Date().toISOString());
  const { data, error } = await db.database.from("masas_noche")
    .select("cupo,vendidas").eq("proyecto_id", PROYECTO).eq("noche", noche).limit(1);
  if (error) return NextResponse.json({ ok: false, error: "No se pudieron leer las masas" }, { status: 500 });
  const fila = Array.isArray(data) ? (data[0] as FilaMasas | undefined) ?? null : null;
  return NextResponse.json({ ok: true, noche, data: fila });
}

/**
 * Fija cuántas masas quedan AHORA: `{ quedan }` (entero; null = sin límite). Se puede cargar en
 * cualquier momento de la noche: la base suma lo ya vendido en un solo paso (`fijar_masas_restantes`).
 */
export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = await req.json().catch(() => ({}));
  const quedan = masasDesdeTexto(body?.quedan);
  if (quedan === undefined) return NextResponse.json({ ok: false, error: "Poné un número entero de masas, de 0 a 2000" }, { status: 400 });
  const { data, error } = await db.database.rpc("fijar_masas_restantes", { p_proyecto: PROYECTO, p_quedan: quedan });
  if (error) return NextResponse.json({ ok: false, error: "No se pudo guardar" }, { status: 500 });
  invalidarCatalogo();
  return NextResponse.json({ ok: true, data });
}
