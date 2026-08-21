import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { SUCURSAL_ID } from "@/lib/business";
import { esColorValido, esMostrarValido } from "@/lib/etiquetas";
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const fields: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) fields.label = body.label.trim();
  if (body.color !== undefined) {
    if (!esColorValido(body.color))
      return NextResponse.json({ ok: false, error: `Color inválido: "${body.color}"` }, { status: 400 });
    fields.color = body.color;
  }
  if (body.mostrar_badge !== undefined) {
    if (!esMostrarValido(body.mostrar_badge))
      return NextResponse.json({ ok: false, error: `Valor inválido: "${body.mostrar_badge}"` }, { status: 400 });
    fields.mostrar_badge = body.mostrar_badge;
  }
  if (Number.isInteger(body.orden)) fields.orden = body.orden;

  // El slug es inmutable: productos.tags lo guarda y renombrarlo huerfanaría las marcas.
  if (body.slug !== undefined)
    return NextResponse.json({ ok: false, error: "El slug no se puede cambiar" }, { status: 400 });
  if (Object.keys(fields).length === 0)
    return NextResponse.json({ ok: false, error: "Nada para actualizar" }, { status: 400 });

  fields.updated_at = new Date().toISOString();
  const { data, error } = await db.database
    .from("etiquetas").update(fields).eq("id", id).eq("sucursal_id", SUCURSAL_ID);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;

  const { data: filas } = await db.database
    .from("etiquetas").select("slug").eq("id", id).eq("sucursal_id", SUCURSAL_ID);
  const slug = Array.isArray(filas) && filas[0] ? String((filas[0] as { slug: string }).slug) : null;
  if (!slug) return NextResponse.json({ ok: false, error: "La etiqueta no existe" }, { status: 404 });

  // Quitar el slug de los productos que lo tengan: dejarlo huérfano lo volvería
  // invisible e imposible de rastrear desde el panel.
  const { data: productos } = await db.database
    .from("productos").select("id,tags").in("categoria", [...CATEGORIAS_IMPASTO]);
  let limpiados = 0;
  for (const p of Array.isArray(productos) ? productos : []) {
    const fila = p as { id: string; tags?: unknown };
    const tags = Array.isArray(fila.tags) ? fila.tags.map(String) : [];
    if (!tags.includes(slug)) continue;
    await db.database.from("productos").update({ tags: tags.filter((t) => t !== slug) }).eq("id", fila.id);
    limpiados++;
  }

  const { error } = await db.database
    .from("etiquetas").delete().eq("id", id).eq("sucursal_id", SUCURSAL_ID);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, limpiados });
}
