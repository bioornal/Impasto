import { NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";

export async function GET() {
  const { data, error } = await db.database
    .from("productos")
    .select("*")
    .in("categoria", [...CATEGORIAS_IMPASTO]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
