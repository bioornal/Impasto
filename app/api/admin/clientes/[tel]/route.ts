import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tel: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { tel } = await params;
  const body = await req.json();
  const fields: Record<string, unknown> = {};
  if (body.nombre !== undefined) fields.nombre = body.nombre;
  if (body.direccion !== undefined) fields.direccion = body.direccion;
  if (body.detalles !== undefined) fields.detalles = body.detalles;
  const { data, error } = await db.database.from("clientes").update(fields).eq("telefono", tel);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ tel: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { tel } = await params;
  const { error } = await db.database.from("clientes").delete().eq("telefono", tel);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
