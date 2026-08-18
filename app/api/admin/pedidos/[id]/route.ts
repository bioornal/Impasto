import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const { status } = await req.json();
  if (!status) return NextResponse.json({ ok: false, error: "status requerido" }, { status: 400 });
  const { error } = await db.database.from("pedidos").update({ status }).eq("id", id).eq("sucursal_id", SUCURSAL_ID);
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
