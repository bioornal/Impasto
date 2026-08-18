import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { data, error } = await db.database.from("productos").select("*").in("categoria", ["pizzas", "empanadas", "bebidas"]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { nombre, precio, disponible, tipo, categoria, desc, tags, popular } = await req.json();
  if (!nombre || precio == null)
    return NextResponse.json({ ok: false, error: "nombre y precio requeridos" }, { status: 400 });
  const { data, error } = await db.database
    .from("productos")
    .insert({
      nombre,
      precio: parseInt(precio),
      disponible: !!disponible,
      tipo: tipo || "pizza",
      categoria: categoria || "pizzas",
      desc: desc || "",
      tags: Array.isArray(tags) ? tags : [],
      popular: !!popular,
    });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
