import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { invalidarCatalogo } from "@/lib/catalog-cache";
import { mitadesDesdePizzas } from "@/lib/cupos";
import { diaDeNegocio } from "@/lib/resumen-diario";

// Cupos de la noche (18/10/2026). La noche la decide el servidor: de 06:00 a 05:59, hora de Argentina.
const PROYECTO = "impasto";
const nocheActual = () => diaDeNegocio(new Date().toISOString());
const esUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const noche = nocheActual();
  const { data, error } = await db.database.from("cupos_noche")
    .select("producto_id,cupo_mitades,vendidas_mitades").eq("proyecto_id", PROYECTO).eq("noche", noche);
  if (error) return NextResponse.json({ ok: false, error: "No se pudieron leer los cupos" }, { status: 500 });
  return NextResponse.json({ ok: true, noche, data: Array.isArray(data) ? data : [] });
}

/** Carga o cambia el cupo de una pizza para esta noche: `{ producto_id, pizzas }` (de a media). */
export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = await req.json().catch(() => ({}));
  const mitades = mitadesDesdePizzas(body?.pizzas);
  if (!esUuid(body?.producto_id)) return NextResponse.json({ ok: false, error: "Producto inválido" }, { status: 400 });
  if (mitades === null) return NextResponse.json({ ok: false, error: "El cupo va de a media pizza: 0, 0,5, 1, 1,5…" }, { status: 400 });

  const { data: producto } = await db.database.from("productos").select("id,categoria")
    .eq("id", body.producto_id).eq("proyecto_id", PROYECTO).limit(1);
  const fila = Array.isArray(producto) ? producto[0] as { categoria?: string } | undefined : undefined;
  if (!fila || !/pizz/i.test(String(fila.categoria ?? ""))) {
    return NextResponse.json({ ok: false, error: "El cupo es solo para pizzas" }, { status: 400 });
  }

  const noche = nocheActual();
  const clave = { proyecto_id: PROYECTO, noche, producto_id: body.producto_id };
  const actualizado = await db.database.from("cupos_noche")
    .update({ cupo_mitades: mitades, actualizado_en: new Date().toISOString() })
    .eq("proyecto_id", PROYECTO).eq("noche", noche).eq("producto_id", body.producto_id).select();
  if (actualizado.error) return NextResponse.json({ ok: false, error: "No se pudo guardar el cupo" }, { status: 500 });
  if (!Array.isArray(actualizado.data) || actualizado.data.length === 0) {
    const creado = await db.database.from("cupos_noche").insert([{ ...clave, cupo_mitades: mitades }]).select();
    if (creado.error) return NextResponse.json({ ok: false, error: "No se pudo guardar el cupo" }, { status: 500 });
  }
  invalidarCatalogo();
  return NextResponse.json({ ok: true });
}

/** Quita el límite de una pizza para esta noche: `?producto_id=`. */
export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const productoId = req.nextUrl.searchParams.get("producto_id");
  if (!esUuid(productoId)) return NextResponse.json({ ok: false, error: "Producto inválido" }, { status: 400 });
  const { error } = await db.database.from("cupos_noche").delete()
    .eq("proyecto_id", PROYECTO).eq("noche", nocheActual()).eq("producto_id", productoId);
  if (error) return NextResponse.json({ ok: false, error: "No se pudo quitar el cupo" }, { status: 500 });
  invalidarCatalogo();
  return NextResponse.json({ ok: true });
}
