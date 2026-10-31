import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { invalidarCatalogo } from "@/lib/catalog-cache";
import { esMasa, masasDesdeTexto, type FilaMasas } from "@/lib/masas-noche";
import { diaDeNegocio } from "@/lib/resumen-diario";

// Masas de la noche por tipo (31/10/2026). La noche la decide el servidor: de 06:00 a 05:59, hora de Argentina.
const PROYECTO = "impasto";

/** `{ noche, data }`: una fila por masa; vacío = todavía no se vendió ninguna pizza ni se cargó nada (sin límite). */
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const noche = diaDeNegocio(new Date().toISOString());
  const { data, error } = await db.database.from("masas_noche")
    .select("masa,cupo,vendidas").eq("proyecto_id", PROYECTO).eq("noche", noche);
  if (error) return NextResponse.json({ ok: false, error: "No se pudieron leer las masas" }, { status: 500 });
  return NextResponse.json({ ok: true, noche, data: Array.isArray(data) ? data as FilaMasas[] : [] });
}

/**
 * `{ masa, quedan }` fija cuántas quedan AHORA de esa masa (entero). Se puede cargar en cualquier
 * momento de la noche: la base suma lo ya vendido en un solo paso (`fijar_masas_restantes`).
 * `{ quedan: null }` quita el límite de las dos.
 */
export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = await req.json().catch(() => ({}));
  const quedan = masasDesdeTexto(body?.quedan);
  if (quedan === undefined) return NextResponse.json({ ok: false, error: "Poné un número entero de masas, de 0 a 2000" }, { status: 400 });
  if (quedan !== null && !esMasa(body?.masa)) return NextResponse.json({ ok: false, error: "Elegí una masa" }, { status: 400 });
  const { data, error } = quedan === null
    ? await db.database.rpc("quitar_limite_masas", { p_proyecto: PROYECTO })
    : await db.database.rpc("fijar_masas_restantes", { p_proyecto: PROYECTO, p_masa: body.masa, p_quedan: quedan });
  if (error) return NextResponse.json({ ok: false, error: "No se pudo guardar" }, { status: 500 });
  invalidarCatalogo();
  return NextResponse.json({ ok: true, data });
}
