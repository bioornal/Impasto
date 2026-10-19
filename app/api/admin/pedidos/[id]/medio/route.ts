import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { errorDeMedio, esMedioPago } from "@/lib/medio-pago";

/**
 * Corrige el medio de pago de un pedido (Resumen diario, 18/10/2026). Todo lo hace la base en un paso
 * (`corregir_medio_pago`): cambia el medio, pasa el cobro ya registrado al medio nuevo, da por cobrado
 * si pasa a Mercado Pago y deja el evento. Devuelve el pedido actualizado.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "Pedido inválido" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  if (!esMedioPago(body?.metodo)) return NextResponse.json({ ok: false, error: "Medio de pago inválido" }, { status: 400 });

  const { data, error } = await db.database.rpc("corregir_medio_pago", { p_pedido: id, p_metodo: body.metodo });
  if (error || !data || typeof data !== "object") {
    const fallo = errorDeMedio(error);
    if (fallo.status === 500) console.error("[medio-pago]", error);
    return NextResponse.json({ ok: false, error: fallo.error }, { status: fallo.status });
  }
  return NextResponse.json({ ok: true, pedido: data });
}
