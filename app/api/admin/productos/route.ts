import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";

export async function GET() {
  const { data, error } = await db.database.from("productos").select("*");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const { nombre, precio, disponible } = await req.json();
  if (!nombre || precio == null)
    return NextResponse.json({ ok: false, error: "nombre y precio requeridos" }, { status: 400 });
  const { data, error } = await db.database
    .from("productos")
    .insert({ nombre, precio: parseInt(precio), disponible: !!disponible });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
