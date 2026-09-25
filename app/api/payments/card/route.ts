import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { createPedido, validateOrderPayload, registrarEvento, clearCartDraft, type CreatedOrder, type OrderPayload } from "@/lib/orders";
import { createCardOrder, mapOrderStatus, type EstadoPago, type MpOrder } from "@/lib/mercadopago";
import { notificarPedido } from "@/lib/notifications";
import { limitar, limpiarIntentosViejos } from "@/lib/rate-limit";
import {
  decideCardAttempt,
  normalizeCardAttemptReference,
  type PersistedCardAttempt,
} from "@/lib/card-attempt";
import { DatabaseOperationError, requireDbRows, requireUpdatedRow } from "@/lib/db-result";
import { PricingUnavailableError } from "@/lib/pricing-safety";

const TIPOS_TARJETA = ["credit_card", "debit_card"];

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

interface ExistingCardOrder extends PersistedCardAttempt {
  total: number;
  subtotal: number;
  envio: number;
  mp_order_id?: string;
}

function createdFromExisting(existing: ExistingCardOrder): CreatedOrder {
  return {
    id: existing.id,
    numero: Number(existing.external_reference.match(/^IM-(\d{6})-/)?.[1] || 0),
    referencia: existing.external_reference,
    items: Array.isArray(existing.productos) ? existing.productos : [],
    subtotal: Number(existing.subtotal || 0),
    shipping: Number(existing.envio || 0),
    total: Number(existing.total || 0),
    freeShipping: Number(existing.envio || 0) === 0,
    // Un pedido con tarjeta nunca muestra datos de transferencia.
    cuentaTransferencia: null,
  };
}

async function findExistingCardOrder(reference: string): Promise<ExistingCardOrder | null> {
  const result = await db.database
    .from("pedidos")
    .select("id,total,subtotal,envio,external_reference,productos,estado_pago,nombre_cliente,telefono_cliente,email_cliente,direccion,modalidad,mp_order_id")
    .eq("external_reference", reference)
    .eq("proyecto_id", "impasto")
    .limit(1);
  const rows = requireDbRows(result as { data: ExistingCardOrder[] | null; error: unknown }, "leer el intento de pago");
  return rows[0] ?? null;
}

async function responseForExistingCardOrder(existing: ExistingCardOrder, order: OrderPayload) {
  const decision = decideCardAttempt(existing, order);
  const created = createdFromExisting(existing);
  const common = {
    numero: created.referencia,
    estadoPago: existing.estado_pago,
    items: created.items,
    subtotal: created.subtotal,
    shipping: created.shipping,
    total: created.total,
  };

  if (decision === "recover-approved") {
    await clearCartDraft();
    return NextResponse.json({ ok: true, recovered: true, ...common });
  }
  if (decision === "wait-pending") {
    return NextResponse.json(
      { ok: false, ...common, error: "El pago anterior todavía se está confirmando. No volvimos a cobrarte." },
      { status: 202 },
    );
  }
  if (decision === "return-rejected") {
    return NextResponse.json(
      { ok: false, ...common, error: "El intento anterior fue rechazado. Podés volver a intentarlo con una nueva tarjeta." },
      { status: 402 },
    );
  }
  if (decision === "conflict") {
    return NextResponse.json(
      { ok: false, error: "La referencia de pago pertenece a otro carrito. Actualizá el checkout e intentá nuevamente." },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { ok: false, ...common, error: "Ese intento de pago ya está cerrado." },
    { status: 409 },
  );
}

async function persistPaymentState(pedidoId: string, values: Record<string, unknown>) {
  const result = await db.database
    .from("pedidos")
    .update(values)
    .eq("id", pedidoId)
    .eq("proyecto_id", "impasto")
    .select("id,estado_pago");
  return requireUpdatedRow(result as { data: { id: string; estado_pago: string }[] | null; error: unknown }, "guardar el estado del pago");
}

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
  // El más estricto de todos: un atacante probando tarjetas robadas acá
  // pone en riesgo la cuenta de Mercado Pago, no solo dinero.
  const limitado = await limitar(req, "pago");
  if (limitado) return limitado;
  await limpiarIntentosViejos();

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
  let attemptReference = "";
  try {
    const order = validateOrderPayload(body);

    let created: CreatedOrder;
    const normalizedReference = normalizeCardAttemptReference(body.externalReference);
    if (!normalizedReference) throw new Error("Referencia de pago inválida. Actualizá el checkout e intentá nuevamente.");
    attemptReference = normalizedReference;

    const existingPedido = await findExistingCardOrder(attemptReference);
    if (existingPedido) return responseForExistingCardOrder(existingPedido, order);

    // La referencia nace en el navegador y se guarda antes de llamar a MP. Si
    // la respuesta se pierde, el siguiente request encuentra este mismo pedido.
    try {
      created = await createPedido(order, {
        metodoPago: "mercadopago",
        estadoPago: "pendiente",
        proveedorPago: "mercadopago",
      }, { externalReference: attemptReference });
    } catch (createError) {
      // Dos envíos simultáneos pueden llegar a consultar antes del INSERT. El
      // índice único deja uno solo; el perdedor recupera la fila ganadora.
      const racedPedido = await findExistingCardOrder(attemptReference);
      if (racedPedido) return responseForExistingCardOrder(racedPedido, order);
      throw createError;
    }
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

      await persistPaymentState(pedidoId, { estado_pago: estado });
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
          items: created.items,
          subtotal: created.subtotal,
          shipping: created.shipping,
          total: created.total,
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

    await persistPaymentState(pedidoId, {
      estado_pago: estadoPago,
      mp_order_id: String(mpOrder.id || ""),
      id_pago: String(pago?.id || ""),
      ...(estadoPago === "aprobado" ? { pagado_en: new Date().toISOString() } : {}),
    });

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
          tel: order.tel,
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
    const persistenceFailure = err instanceof DatabaseOperationError;
    const pricingFailure = err instanceof PricingUnavailableError;
    const msg = persistenceFailure
      ? "No pudimos confirmar el estado del pedido. No vuelvas a pagar: reintentá para recuperar este mismo intento."
      : err instanceof Error ? err.message : "No se pudo procesar el pago";
    return NextResponse.json(
      { ok: false, ...(attemptReference ? { numero: attemptReference } : {}), error: msg },
      { status: persistenceFailure ? 500 : pricingFailure ? 503 : 400 },
    );
  }
}
