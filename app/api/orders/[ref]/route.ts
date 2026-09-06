import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { getBusinessConfig } from "@/lib/business-server";

export const dynamic = "force-dynamic";

/**
 * Consulta pública del estado de un pedido para la pantalla de seguimiento.
 * Filtra estrictamente por external_reference (ej: IM-123456) y proyecto_id = "impasto".
 * Devuelve únicamente los datos necesarios para el cliente (sin datos sensibles ni tokens).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const cleanedRef = String(ref || "").trim().toUpperCase();

  if (!cleanedRef || !cleanedRef.startsWith("IM-")) {
    return NextResponse.json({ ok: false, error: "Referencia de pedido inválida" }, { status: 400 });
  }

  const { data, error } = await db.database
    .from("pedidos")
    .select("numero_pedido, external_reference, nombre_cliente, modalidad, direccion, productos, subtotal, envio, total, status, estado_pago, metodo_pago, cuando, notas, created_at")
    .eq("external_reference", cleanedRef)
    .eq("proyecto_id", "impasto")
    .eq("sucursal_id", SUCURSAL_ID)
    .limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: "Error al consultar el pedido" }, { status: 500 });
  }

  const pedido = Array.isArray(data) ? data[0] : null;
  if (!pedido) {
    return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
  }

  const business = await getBusinessConfig();

  // Mapeo seguro para el cliente
  return NextResponse.json({
    ok: true,
    order: {
      numero: pedido.external_reference || `IM-${pedido.numero_pedido}`,
      cliente: pedido.nombre_cliente,
      modalidad: pedido.modalidad || "delivery",
      direccion: pedido.direccion || "",
      items: Array.isArray(pedido.productos) ? pedido.productos : [],
      subtotal: Number(pedido.subtotal || 0),
      envio: Number(pedido.envio || 0),
      total: Number(pedido.total || 0),
      estado: String(pedido.status || "nuevo") === "normal" ? "nuevo" : String(pedido.status || "nuevo"),
      estadoPago: String(pedido.estado_pago || "pendiente"),
      metodoPago: String(pedido.metodo_pago || "efectivo"),
      cuando: String(pedido.cuando || "asap"),
      notas: String(pedido.notas || ""),
      fecha: pedido.created_at || new Date().toISOString(),
      deliveryEstimate: business.deliveryEstimate,
      bancoInfo: pedido.metodo_pago === "transferencia" ? {
        alias: business.aliasCbu,
        cbu: business.cbu,
        banco: business.banco,
        titular: business.titularCuenta,
      } : null,
      whatsappPhone: business.whatsappPhone,
      businessPhone: business.phone,
      businessAddress: business.address,
    },
  });
}
