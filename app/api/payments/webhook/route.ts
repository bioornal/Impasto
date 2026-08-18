import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { registrarEvento } from "@/lib/orders";
import {
  getOrder,
  getPayment,
  mapOrderStatus,
  mapPaymentStatus,
  verifyWebhookSignature,
  type EstadoPago,
} from "@/lib/mercadopago";

/** Resuelve la notificación contra la API de MP: nunca confiamos en el payload recibido. */
async function resolverNotificacion(tipo: string, id: string) {
  if (tipo.startsWith("payment")) {
    const pago = await getPayment(id);
    return {
      externalReference: String(pago?.external_reference || ""),
      estado: mapPaymentStatus(String(pago?.status || "")),
      idPago: String(pago?.id || ""),
      mpOrderId: String(pago?.order?.id || ""),
      detalle: { status: pago?.status, status_detail: pago?.status_detail },
    };
  }

  const orden = await getOrder(id);
  const pago = orden.transactions?.payments?.[0];
  return {
    externalReference: String(orden.external_reference || ""),
    estado: mapOrderStatus(orden.status, orden.status_detail),
    idPago: String(pago?.id || ""),
    mpOrderId: String(orden.id || ""),
    detalle: { status: orden.status, status_detail: orden.status_detail },
  };
}

export async function POST(req: NextRequest) {
  const dataId = req.nextUrl.searchParams.get("data.id") || req.nextUrl.searchParams.get("id");

  if (!verifyWebhookSignature({
    signatureHeader: req.headers.get("x-signature"),
    requestId: req.headers.get("x-request-id"),
    dataId,
  })) {
    return NextResponse.json({ ok: false, error: "Firma inválida" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    // Mercado Pago también notifica sin cuerpo; los datos vienen en la query.
  }

  const tipo = String(payload.type || req.nextUrl.searchParams.get("type") || "");
  const id = String((payload.data as { id?: string } | undefined)?.id || dataId || "");
  if (!tipo || !id) return NextResponse.json({ ok: true, ignored: true });

  try {
    const resuelto = await resolverNotificacion(tipo, id);
    if (!resuelto.externalReference) return NextResponse.json({ ok: true, ignored: true });

    const { data } = await db.database
      .from("pedidos")
      .select("id,estado_pago")
      .eq("external_reference", resuelto.externalReference)
      .limit(1);

    const pedido = Array.isArray(data) ? data[0] : undefined;
    if (!pedido) return NextResponse.json({ ok: true, ignored: true });

    // Idempotencia: si el estado no cambió, no volvemos a escribir ni a registrar evento.
    if (pedido.estado_pago === resuelto.estado) return NextResponse.json({ ok: true, unchanged: true });

    const estado = resuelto.estado as EstadoPago;
    await db.database
      .from("pedidos")
      .update({
        estado_pago: estado,
        id_pago: resuelto.idPago || "",
        ...(resuelto.mpOrderId ? { mp_order_id: resuelto.mpOrderId } : {}),
        ...(estado === "aprobado" ? { pagado_en: new Date().toISOString() } : {}),
      })
      .eq("id", pedido.id);

    await registrarEvento({
      pedidoId: String(pedido.id),
      tipo: "pago",
      valor: estado,
      origen: "webhook",
      detalle: { ...resuelto.detalle, notificacion: tipo, recurso: id },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // Un 500 hace que Mercado Pago reintente la notificación más tarde.
    const msg = err instanceof Error ? err.message : "Error procesando la notificación";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
