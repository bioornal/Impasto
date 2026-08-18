import crypto from "node:crypto";

const MP_API = "https://api.mercadopago.com";

/** Estados de pago que persistimos en `pedidos.estado_pago`. */
export type EstadoPago = "pendiente" | "aprobado" | "rechazado" | "reembolsado";

export interface MpOrder {
  id: string;
  status: string;
  status_detail: string;
  external_reference?: string;
  total_amount?: string;
  transactions?: {
    payments?: {
      id: string;
      status: string;
      status_detail: string;
      paid_amount?: string;
      payment_method?: { id?: string; type?: string; installments?: number };
    }[];
  };
}

export interface CardPaymentInput {
  /** Monto en pesos enteros, tal como lo calcula la cotización server-side. */
  amount: number;
  token: string;
  paymentMethodId: string;
  /** `credit_card` o `debit_card`, según informa el Brick. */
  paymentType: string;
  installments: number;
  externalReference: string;
  description: string;
  payer: {
    email: string;
    identification?: { type: string; number: string };
  };
}

function accessToken() {
  const token = process.env.MERCADOPAGO_AUTH_HEADER;
  if (!token) throw new Error("Falta configurar MERCADOPAGO_AUTH_HEADER");
  return token;
}

/** Mercado Pago espera los montos como string con dos decimales. */
const asAmount = (value: number) => value.toFixed(2);

async function mpFetch(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const { idempotencyKey, ...rest } = init;
  const response = await fetch(`${MP_API}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...rest.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.message || body?.error || `HTTP ${response.status}`;
    const error = new Error(`Mercado Pago: ${detail}`);
    Object.assign(error, { status: response.status, body });
    throw error;
  }
  return body;
}

/**
 * Crea una orden online con procesamiento automático (Checkout API vía Orders).
 * El token viene del Brick en el cliente: los datos de tarjeta nunca tocan nuestro servidor.
 */
export async function createCardOrder(input: CardPaymentInput): Promise<MpOrder> {
  return mpFetch("/v1/orders", {
    method: "POST",
    // La clave de idempotencia evita cobrar dos veces si el cliente reintenta.
    idempotencyKey: input.externalReference,
    body: JSON.stringify({
      type: "online",
      processing_mode: "automatic",
      total_amount: asAmount(input.amount),
      external_reference: input.externalReference,
      description: input.description,
      payer: {
        email: input.payer.email,
        ...(input.payer.identification ? { identification: input.payer.identification } : {}),
      },
      transactions: {
        payments: [
          {
            amount: asAmount(input.amount),
            payment_method: {
              id: input.paymentMethodId,
              type: input.paymentType,
              token: input.token,
              installments: input.installments,
            },
          },
        ],
      },
    }),
  });
}

export async function getOrder(orderId: string): Promise<MpOrder> {
  return mpFetch(`/v1/orders/${orderId}`);
}

/**
 * Reembolsa una orden. Sin `amount` devuelve el total; con `amount` hace un
 * parcial sobre la transacción indicada. Mercado Pago acepta reembolsos
 * hasta 360 días después del pago.
 */
export async function refundOrder(
  orderId: string,
  partial?: { transactionId: string; amount: number },
): Promise<MpOrder> {
  return mpFetch(`/v1/orders/${orderId}/refund`, {
    method: "POST",
    // Distinta clave por monto: permite reintentar sin duplicar el reembolso,
    // pero no bloquea un segundo parcial por otro importe.
    idempotencyKey: `refund-${orderId}-${partial ? partial.amount : "total"}`,
    ...(partial
      ? {
          body: JSON.stringify({
            transactions: [{ id: partial.transactionId, amount: asAmount(partial.amount) }],
          }),
        }
      : {}),
  });
}

/** Las notificaciones de tipo `payment` traen el id del pago, no el de la orden. */
export async function getPayment(paymentId: string) {
  return mpFetch(`/v1/payments/${paymentId}`);
}

/**
 * Traduce el par status/status_detail de Orders al estado que guardamos.
 * Referencia: estados `created`, `processed`, `processing`, `action_required`,
 * `canceled`, `charged_back`, `expired`, `failed`, `refunded`.
 */
export function mapOrderStatus(status: string, statusDetail = ""): EstadoPago {
  switch (status) {
    case "processed":
      return statusDetail === "partially_refunded" ? "reembolsado" : "aprobado";
    case "refunded":
    case "charged_back":
      return "reembolsado";
    case "canceled":
    case "expired":
    case "failed":
      return "rechazado";
    default:
      // created, processing, action_required y cualquier estado nuevo.
      return "pendiente";
  }
}

/** Estados de la API de pagos v1, que llegan por webhook de tipo `payment`. */
export function mapPaymentStatus(status: string): EstadoPago {
  switch (status) {
    case "approved":
      return "aprobado";
    case "rejected":
    case "cancelled":
      return "rechazado";
    case "refunded":
    case "charged_back":
      return "reembolsado";
    default:
      return "pendiente";
  }
}

/**
 * Valida la firma `x-signature` del webhook.
 * El manifiesto es `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` firmado con
 * HMAC-SHA256 usando el secreto de la aplicación.
 */
export function verifyWebhookSignature(params: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  // Sin secreto configurado no podemos confiar en la notificación: fallamos cerrado.
  if (!secret || !params.signatureHeader || !params.dataId) return false;

  const parts = Object.fromEntries(
    params.signatureHeader.split(",").map((part) => {
      const [key, ...value] = part.split("=");
      return [key.trim(), value.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const received = parts.v1;
  if (!ts || !received) return false;

  // Mercado Pago exige el data.id en minúsculas cuando es alfanumérico.
  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.requestId || ""};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
