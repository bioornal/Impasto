import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const fields: Record<string, unknown> = {};
  if (body.nombre !== undefined) fields.nombre = body.nombre;
  if (body.precio !== undefined) fields.precio = parseInt(body.precio);
  if (body.disponible !== undefined) fields.disponible = !!body.disponible;
  const { data, error } = await db.database.from("productos").update(fields).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await db.database.from("productos").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
