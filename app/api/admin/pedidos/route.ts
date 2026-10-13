import { readPages } from "@/lib/read-pages";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-auth";

// Sin `desde`: todo el historial (carga inicial y reconciliación cada 10 min).
// Con `desde`: solo lo que cambió desde esa hora (el sondeo de cada 15 s).
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const desde = req.nextUrl.searchParams.get("desde");
  if (desde !== null && !Number.isFinite(Date.parse(desde))) {
    return NextResponse.json({ ok: false, error: "Parámetro desde inválido" }, { status: 400 });
  }
  const { data, error } = await readPages((start, end) => {
    let query = db.database
      .from("pedidos")
      .select("*")
      .eq("proyecto_id", "impasto")
      .eq("sucursal_id", SUCURSAL_ID);
    if (desde !== null) query = query.gte("updated_at", new Date(desde).toISOString());
    return query.order("created_at", { ascending: false }).order("id", { ascending: true }).range(start, end);
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
