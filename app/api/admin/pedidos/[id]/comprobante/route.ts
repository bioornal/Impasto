import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-auth";
import { idValido } from "@/lib/foto-subida";
import { bajarComprobante } from "@/lib/comprobantes-bucket";

export const dynamic = "force-dynamic";

/** Entrega el comprobante a quien administra: el bucket es privado y esta es la única puerta. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ ok: false, error: "Pedido inválido" }, { status: 400 });

  const { data, error } = await db.database
    .from("pedidos")
    .select("comprobante_clave, comprobante_tipo")
    .eq("id", id)
    .eq("proyecto_id", "impasto")
    .eq("sucursal_id", SUCURSAL_ID)
    .limit(1);
  if (error) return NextResponse.json({ ok: false, error: "No se pudo leer el pedido" }, { status: 500 });
  const pedido = Array.isArray(data) ? data[0] : null;
  if (!pedido?.comprobante_clave) return NextResponse.json({ ok: false, error: "Este pedido no tiene comprobante" }, { status: 404 });

  const archivo = await bajarComprobante(String(pedido.comprobante_clave));
  if (!archivo.ok || !archivo.body) return NextResponse.json({ ok: false, error: "No se pudo abrir el comprobante" }, { status: 502 });

  return new NextResponse(archivo.body, {
    headers: {
      "Content-Type": String(pedido.comprobante_tipo || "application/octet-stream"),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
