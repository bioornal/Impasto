import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-auth";
import { validarCambioTestimonio } from "@/lib/opiniones";

/** Moderar: el estado y, antes de publicar, el nombre que se ve y sobre qué opinó. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const validado = validarCambioTestimonio(body);
  if (!validado.ok) return NextResponse.json({ ok: false, error: validado.error }, { status: 400 });
  const { error } = await db.database.from("testimonios").update({ ...validado.cambio, updated_at: new Date().toISOString() }).eq("id", id).eq("sucursal_id", SUCURSAL_ID);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const { error } = await db.database.from("testimonios").delete().eq("id", id).eq("sucursal_id", SUCURSAL_ID);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
