import { NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { data, error } = await db.database
    .from("pedidos")
    .select("*")
    .eq("proyecto_id", "impasto")
    .eq("sucursal_id", SUCURSAL_ID)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
