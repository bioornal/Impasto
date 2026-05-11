import { NextResponse } from "next/server";
import { db } from "@/lib/insforge";

export async function GET() {
  const { data, error } = await db.database
    .from("pedidos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
