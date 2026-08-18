import { db } from "@/lib/insforge";
import { sendEmail } from "@/lib/email";
import { getBusinessConfig } from "@/lib/business-server";
import { fmt } from "@/lib/utils";
import type { BusinessConfig } from "@/lib/business";
import type { CartItem } from "@/types";

export type TipoAviso = "pedido_recibido" | "pago_aprobado";

export interface AvisoPedido {
  pedidoId: string;
  referencia: string;
  nombre: string;
  email: string;
  mode: string;
  dir?: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  metodoPago: string;
}

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo al recibir",
  transferencia: "Transferencia",
  mercadopago: "Tarjeta (Mercado Pago)",
};

function plantilla(aviso: AvisoPedido, business: BusinessConfig, tipo: TipoAviso) {
  const esDelivery = aviso.mode === "delivery";
  const titulo = tipo === "pago_aprobado" ? "Tu pago se acreditó" : "Recibimos tu pedido";
  const bajada = tipo === "pago_aprobado"
    ? "Ya está confirmado y entra a cocina."
    : esDelivery
      ? "Ya lo estamos preparando. Te avisamos cuando salga."
      : "Ya lo estamos preparando. Te avisamos cuando esté listo para retirar.";

  const filas = aviso.items.map((item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">
        <strong>${escape(item.name)}</strong>${item.detail ? `<br><span style="color:#7a6f65;font-size:13px;">${escape(item.detail)}</span>` : ""}
        <br><span style="color:#7a6f65;font-size:13px;">×${item.qty}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${fmt(item.price * item.qty)}</td>
    </tr>`).join("");

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2a201a;">
  <div style="text-align:center;padding-bottom:20px;border-bottom:2px solid #b2472a;">
    <h1 style="margin:0;font-size:22px;">${escape(business.name)}</h1>
    <p style="margin:4px 0 0;color:#7a6f65;font-size:13px;">${escape(business.locationLabel)}</p>
  </div>

  <h2 style="font-size:19px;margin:24px 0 4px;">${titulo}, ${escape(aviso.nombre.split(" ")[0])}</h2>
  <p style="margin:0 0 4px;color:#5a5048;">${bajada}</p>
  <p style="margin:0 0 20px;color:#7a6f65;font-size:14px;">Pedido <strong style="color:#b2472a;">${escape(aviso.referencia)}</strong></p>

  <table style="width:100%;border-collapse:collapse;font-size:14px;">${filas}</table>

  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
    <tr><td style="padding:3px 0;color:#7a6f65;">Subtotal</td><td style="text-align:right;">${fmt(aviso.subtotal)}</td></tr>
    <tr><td style="padding:3px 0;color:#7a6f65;">${esDelivery ? "Envío" : "Retiro en local"}</td><td style="text-align:right;">${aviso.shipping === 0 ? (esDelivery ? "Gratis" : "—") : fmt(aviso.shipping)}</td></tr>
    <tr><td style="padding:8px 0 0;font-weight:700;font-size:16px;">Total</td><td style="text-align:right;font-weight:700;font-size:16px;">${fmt(aviso.total)}</td></tr>
  </table>

  <div style="margin-top:20px;padding:14px;background:#faf7f2;border-radius:10px;font-size:14px;">
    <p style="margin:0 0 6px;"><strong>${esDelivery ? "Entregamos en" : "Retirás en"}:</strong> ${escape(esDelivery ? (aviso.dir || "") : business.address)}</p>
    <p style="margin:0;"><strong>Pago:</strong> ${escape(METODO_LABEL[aviso.metodoPago] || aviso.metodoPago)}</p>
  </div>

  <p style="margin:22px 0 0;font-size:13px;color:#7a6f65;text-align:center;">
    ¿Alguna duda? Escribinos por WhatsApp al ${escape(business.phone)}.
  </p>
</div>`;

  return { subject: `${titulo} · ${aviso.referencia} · ${business.name}`, html };
}

/**
 * Envía un aviso y lo deja registrado. El índice único de `notificaciones`
 * garantiza que un mismo aviso no salga dos veces aunque se reintente.
 */
export async function notificarPedido(aviso: AvisoPedido, tipo: TipoAviso) {
  if (!aviso.email) return;

  // Reservar el aviso primero: si ya existe, otra ejecución lo mandó.
  const { error: yaExiste } = await db.database.from("notificaciones").insert({
    pedido_id: aviso.pedidoId,
    canal: "email",
    tipo,
    destino: aviso.email,
    estado: "pendiente",
  });
  if (yaExiste) return;

  const business = await getBusinessConfig();
  const { subject, html } = plantilla(aviso, business, tipo);
  const resultado = await sendEmail({ to: aviso.email, subject, html });

  await db.database
    .from("notificaciones")
    .update({
      estado: resultado.estado,
      detalle: resultado.estado === "enviado" ? { id: resultado.id } : { motivo: resultado.motivo },
    })
    .eq("pedido_id", aviso.pedidoId)
    .eq("tipo", tipo)
    .eq("canal", "email");
}
