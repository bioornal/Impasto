import { NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";

export async function GET() {
  const { data, error } = await db.database.from("testimonios").select("*").eq("sucursal_id", SUCURSAL_ID).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
