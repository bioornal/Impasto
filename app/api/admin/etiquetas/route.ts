import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { SUCURSAL_ID } from "@/lib/business";
import { esColorValido, esMostrarValido, slugificar } from "@/lib/etiquetas";
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";

/** Cuántos productos de Impasto usan cada slug. */
async function conteoDeUso(): Promise<Record<string, number>> {
  const { data } = await db.database
    .from("productos")
    .select("tags")
    .in("categoria", [...CATEGORIAS_IMPASTO]);
  const conteo: Record<string, number> = {};
  for (const fila of Array.isArray(data) ? data : []) {
    const tags = Array.isArray((fila as { tags?: unknown }).tags) ? (fila as { tags: unknown[] }).tags : [];
    for (const t of tags) conteo[String(t)] = (conteo[String(t)] || 0) + 1;
  }
  return conteo;
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, error } = await db.database
    .from("etiquetas").select("*").eq("sucursal_id", SUCURSAL_ID).order("orden");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const conteo = await conteoDeUso();
  const conUso = (Array.isArray(data) ? data : []).map((e) => ({
    ...(e as Record<string, unknown>),
    usos: conteo[String((e as { slug: string }).slug)] || 0,
  }));
  return NextResponse.json({ ok: true, data: conUso });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { label, color, orden, mostrar_badge } = await req.json().catch(() => ({}));
  if (typeof label !== "string" || !label.trim())
    return NextResponse.json({ ok: false, error: "El nombre es obligatorio" }, { status: 400 });

  const slug = slugificar(label);
  if (!slug)
    return NextResponse.json({ ok: false, error: "El nombre necesita al menos una letra o número" }, { status: 400 });
  if (color !== undefined && !esColorValido(color))
    return NextResponse.json({ ok: false, error: `Color inválido: "${color}"` }, { status: 400 });
  if (mostrar_badge !== undefined && !esMostrarValido(mostrar_badge))
    return NextResponse.json({ ok: false, error: `Valor inválido para mostrar_badge: "${mostrar_badge}"` }, { status: 400 });

  const { data: existentes } = await db.database
    .from("etiquetas").select("slug").eq("sucursal_id", SUCURSAL_ID).eq("slug", slug);
  if (Array.isArray(existentes) && existentes.length > 0)
    return NextResponse.json({ ok: false, error: `Ya existe una etiqueta con el nombre "${label}"` }, { status: 400 });

  const { data, error } = await db.database.from("etiquetas").insert([{
    slug,
    label: label.trim(),
    color: color || "gris",
    orden: Number.isInteger(orden) ? orden : 100,
    mostrar_badge: mostrar_badge || "ambos",
    sistema: false,
    sucursal_id: SUCURSAL_ID,
  }]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
