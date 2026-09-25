import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { getBusinessConfig } from "@/lib/business-server";
import { datosDesdePedido } from "@/lib/cuentas-transferencia";
import { productosDelPedido } from "@/lib/opiniones";
import { esReferenciaValida, normalizarReferencia } from "@/lib/referencia";
import { limitar } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Consulta pública del estado de un pedido para la pantalla de seguimiento.
 * Filtra estrictamente por external_reference (ej: IM-123456) y proyecto_id = "impasto".
 * Devuelve únicamente los datos necesarios para el cliente (sin datos sensibles ni tokens).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const cleanedRef = normalizarReferencia(ref);

  // El formato se valida antes de tocar la base: un intento de enumeración no
  // llega a costar una consulta. Ver `lib/referencia.ts`.
  if (!esReferenciaValida(cleanedRef)) {
    return NextResponse.json({ ok: false, error: "Referencia de pedido inválida" }, { status: 400 });
  }

  // Esta ruta es pública y devuelve nombre y dirección del cliente: el límite
  // es lo que impide que alguien la use para juntar datos a escala.
  const limitado = await limitar(req, "seguimiento");
  if (limitado) return limitado;

  const { data, error } = await db.database
    .from("pedidos")
    .select("id, numero_pedido, external_reference, nombre_cliente, modalidad, direccion, productos, subtotal, envio, total, status, estado_pago, metodo_pago, cuenta_transferencia, cuando, notas, created_at")
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

  // Entregado, el cliente puede opinar una vez. Esta consulta solo corre en ese
  // estado, que además corta el refresco de la página.
  let opinion: { productos: string[]; yaOpino: boolean } | null = null;
  if (pedido.status === "entregado") {
    const { data: previa } = await db.database.from("testimonios").select("id").eq("pedido_id", pedido.id).limit(1);
    opinion = {
      productos: productosDelPedido(pedido.productos),
      yaOpino: Array.isArray(previa) && previa.length > 0,
    };
  }

  const business = await getBusinessConfig();
  // La cuenta que se le mostró al cliente al pedir. Los pedidos anteriores a la
  // lista de cuentas no la tienen: para esos, la activa, como antes.
  const cuenta = pedido.metodo_pago === "transferencia"
    ? datosDesdePedido(pedido.cuenta_transferencia) ?? business.cuentaTransferencia
    : null;

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
      bancoInfo: cuenta ? {
        alias: cuenta.alias,
        cbu: cuenta.cbu,
        banco: cuenta.banco,
        titular: cuenta.titular,
      } : null,
      opinion,
      whatsappPhone: business.whatsappPhone,
      businessPhone: business.phone,
      businessAddress: business.address,
    },
  });
}
