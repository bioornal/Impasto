import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { CATEGORIAS_IMPASTO, esCategoriaImpasto } from "@/lib/categorias";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body = await req.json();
  const fields: Record<string, unknown> = {};
  if (body.nombre !== undefined) fields.nombre = body.nombre;
  if (body.precio !== undefined) fields.precio = parseInt(body.precio);
  if (body.disponible !== undefined) fields.disponible = !!body.disponible;
  if (body.tipo !== undefined) fields.tipo = body.tipo;
  if (body.categoria !== undefined) {
    if (!esCategoriaImpasto(body.categoria)) {
      return NextResponse.json(
        { ok: false, error: `categoria inválida: "${body.categoria}". Solo se admiten ${CATEGORIAS_IMPASTO.join(", ")}.` },
        { status: 400 },
      );
    }
    fields.categoria = body.categoria;
  }
  if (body.desc !== undefined) fields.desc = body.desc;
  if (body.tags !== undefined) fields.tags = Array.isArray(body.tags) ? body.tags : [];
  if (body.popular !== undefined) fields.popular = !!body.popular;
  const { data, error } = await db.database.from("productos").update(fields).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const { error } = await db.database.from("productos").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
