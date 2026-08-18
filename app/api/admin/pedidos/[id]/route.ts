import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, string> = {};
  if (body.status !== undefined) {
    if (!["normal", "nuevo", "preparando", "en-camino", "entregado", "cancelado"].includes(body.status)) return NextResponse.json({ ok: false, error: "status inválido" }, { status: 400 });
    updates.status = body.status;
  }
  if (body.estado_pago !== undefined) {
    if (!["pendiente", "aprobado", "rechazado", "reembolsado"].includes(body.estado_pago)) return NextResponse.json({ ok: false, error: "estado de pago inválido" }, { status: 400 });
    updates.estado_pago = body.estado_pago;
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: false, error: "actualización vacía" }, { status: 400 });
  const { error } = await db.database.from("pedidos").update(updates).eq("id", id).eq("sucursal_id", SUCURSAL_ID);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const { error } = await db.database.from("pedidos").delete().eq("id", id).eq("sucursal_id", SUCURSAL_ID);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
