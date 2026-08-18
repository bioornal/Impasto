import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { createPedido, validateOrderPayload, registrarEvento, clearCartDraft } from "@/lib/orders";
import { createCardOrder, mapOrderStatus, type EstadoPago, type MpOrder } from "@/lib/mercadopago";
import { notificarPedido } from "@/lib/notifications";

const TIPOS_TARJETA = ["credit_card", "debit_card"];

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Mensaje mostrable según por qué Mercado Pago no aprobó el pago. */
function motivoRechazo(statusDetail: string) {
  const motivos: Record<string, string> = {
    cc_rejected_insufficient_amount: "La tarjeta no tiene fondos suficientes.",
    cc_rejected_bad_filled_card_number: "Revisá el número de la tarjeta.",
    cc_rejected_bad_filled_date: "Revisá la fecha de vencimiento.",
    cc_rejected_bad_filled_security_code: "Revisá el código de seguridad.",
    cc_rejected_bad_filled_other: "Revisá los datos de la tarjeta.",
    cc_rejected_call_for_authorize: "Tenés que autorizar el pago con tu banco.",
    cc_rejected_card_disabled: "La tarjeta está inhabilitada. Llamá a tu banco.",
    cc_rejected_high_risk: "El pago fue rechazado por seguridad. Probá con otro medio.",
    cc_rejected_max_attempts: "Alcanzaste el límite de intentos. Probá con otra tarjeta.",
    cc_rejected_duplicated_payment: "Ya hay un pago igual en curso.",
  };
  return motivos[statusDetail] || "El pago fue rechazado. Probá con otra tarjeta o elegí efectivo.";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const token = text(body.token);
  const paymentMethodId = text(body.payment_method_id);
  const paymentType = text(body.payment_type_id);
  const installments = Number(body.installments);
  const payer = (body.payer || {}) as { email?: string; identification?: { type: string; number: string } };
  const email = text(payer.email);

  if (!token || !paymentMethodId) {
    return NextResponse.json({ ok: false, error: "Faltan los datos de la tarjeta" }, { status: 400 });
  }
  if (!TIPOS_TARJETA.includes(paymentType)) {
    return NextResponse.json({ ok: false, error: "Tipo de tarjeta no soportado" }, { status: 400 });
  }
  if (!Number.isInteger(installments) || installments < 1 || installments > 24) {
    return NextResponse.json({ ok: false, error: "Cantidad de cuotas inválida" }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ ok: false, error: "Falta el email para la factura" }, { status: 400 });
  }

  let pedidoId = "";
  try {
    const order = validateOrderPayload(body);

    // El pedido se registra antes de cobrar: si la respuesta de MP se pierde,
    // el webhook lo encuentra por external_reference.
    const created = await createPedido(order, {
      metodoPago: "mercadopago",
      estadoPago: "pendiente",
      proveedorPago: "mercadopago",
    });
    pedidoId = created.id;

    let mpOrder: MpOrder;
    try {
      mpOrder = await createCardOrder({
        amount: created.total,
        token,
        paymentMethodId,
        paymentType,
        installments,
        externalReference: created.referencia,
        description: `Pedido ${created.referencia} · Impasto`,
        payer: { email, identification: payer.identification },
      });
    } catch (mpError: unknown) {
      const detalle = (mpError as { body?: Record<string, unknown> }).body || {};
      const httpStatus = (mpError as { status?: number }).status || 0;
      // 4xx es un rechazo definitivo; 5xx o red pueden haber cobrado igual,
      // así que se dejan pendientes para que los resuelva el webhook.
      const estado: EstadoPago = httpStatus >= 400 && httpStatus < 500 ? "rechazado" : "pendiente";

      await db.database.from("pedidos").update({ estado_pago: estado }).eq("id", pedidoId);
      await registrarEvento({
        pedidoId,
        tipo: "pago",
        valor: estado,
        origen: "checkout",
        detalle: { error: mpError instanceof Error ? mpError.message : "error", http: httpStatus, ...detalle },
      });

      // Un `errors[]` es un problema de la petición (email inválido, monto mal
      // formado, credenciales), no una tarjeta rechazada: hay que verlo tal cual.
      const validacion = Array.isArray(detalle.errors)
        ? (detalle.errors as { message?: string }[])[0]?.message
        : undefined;

      return NextResponse.json(
        {
          ok: false,
          numero: created.referencia,
          estadoPago: estado,
          error: validacion
            || (estado === "rechazado"
              ? "El pago fue rechazado. Probá con otra tarjeta o elegí efectivo."
              : "No pudimos confirmar el pago todavía. Te avisamos por WhatsApp en cuanto se acredite."),
        },
        { status: estado === "rechazado" ? 402 : 202 },
      );
    }

    const pago = mpOrder.transactions?.payments?.[0];
    const estadoPago = mapOrderStatus(mpOrder.status, mpOrder.status_detail);

    await db.database
      .from("pedidos")
      .update({
        estado_pago: estadoPago,
        mp_order_id: String(mpOrder.id || ""),
        id_pago: String(pago?.id || ""),
        ...(estadoPago === "aprobado" ? { pagado_en: new Date().toISOString() } : {}),
      })
      .eq("id", pedidoId);

    await registrarEvento({
      pedidoId,
      tipo: "pago",
      valor: estadoPago,
      origen: "checkout",
      detalle: {
        mp_status: mpOrder.status,
        mp_status_detail: mpOrder.status_detail,
        mp_order_id: mpOrder.id,
        pago_id: pago?.id,
        cuotas: installments,
      },
    });

    if (estadoPago === "aprobado") {
      await clearCartDraft();
      try {
        await notificarPedido({
          pedidoId,
          referencia: created.referencia,
          nombre: order.nombre,
          email: order.email,
          mode: order.mode,
          dir: order.dir,
          items: created.items,
          subtotal: created.subtotal,
          shipping: created.shipping,
          total: created.total,
          metodoPago: "mercadopago",
        }, "pago_aprobado");
      } catch { /* queda registrado como fallido en `notificaciones` */ }
    }

    if (estadoPago === "rechazado") {
      return NextResponse.json(
        {
          ok: false,
          numero: created.referencia,
          estadoPago,
          error: motivoRechazo(pago?.status_detail || mpOrder.status_detail),
        },
        { status: 402 },
      );
    }

    return NextResponse.json({
      ok: true,
      numero: created.referencia,
      estadoPago,
      items: created.items,
      subtotal: created.subtotal,
      shipping: created.shipping,
      total: created.total,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "No se pudo procesar el pago";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
