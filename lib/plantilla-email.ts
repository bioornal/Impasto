import { fmt } from "@/lib/utils";
import { esperaComprobante } from "@/lib/transferencia-pendiente";
import { urlAbsoluta } from "@/lib/site";
import type { BusinessConfig } from "@/lib/business";
import type { AvisoPedido, TipoAviso } from "@/lib/aviso-local";

/**
 * La plantilla del mail al cliente. Vive aparte de `lib/notifications.ts` (que arrastra
 * el SDK de InsForge) para poder testearla bajo `tsx`.
 */

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo al recibir",
  transferencia: "Transferencia",
  mercadopago: "Tarjeta (Mercado Pago)",
};

export function plantilla(aviso: AvisoPedido, business: BusinessConfig, tipo: TipoAviso) {
  const esDelivery = aviso.mode === "delivery";
  // Una transferencia no está pagada hasta que vemos el comprobante: hasta entonces
  // no decimos que lo estamos preparando.
  const esperaPago = tipo === "pedido_recibido" && esperaComprobante(aviso.metodoPago, "pendiente");
  const titulo = tipo === "pago_aprobado" ? "Tu pago se acreditó" : esperaPago ? "Registramos tu pedido" : "Recibimos tu pedido";
  const bajada = tipo === "pago_aprobado"
    ? "Ya está confirmado y entra a cocina."
    : esperaPago
      ? `Lo empezamos a preparar apenas recibamos el comprobante de tu transferencia. Subilo desde el seguimiento de tu pedido: ${urlAbsoluta(`/pedido/${aviso.referencia}`)}`
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
    <tr><td style="padding:3px 0;color:#7a6f65;">${esDelivery ? "Envío" : "Retiro en nuestra cocina"}</td><td style="text-align:right;">${aviso.shipping === 0 ? (esDelivery ? "Gratis" : "—") : fmt(aviso.shipping)}</td></tr>
    <tr><td style="padding:8px 0 0;font-weight:700;font-size:16px;">Total</td><td style="text-align:right;font-weight:700;font-size:16px;">${fmt(aviso.total)}</td></tr>
  </table>

  <div style="margin-top:20px;padding:14px;background:#faf7f2;border-radius:10px;font-size:14px;">
    <p style="margin:0 0 6px;"><strong>${esDelivery ? "Entregamos en" : "Retirás en nuestra cocina"}:</strong> ${escape(esDelivery ? (aviso.dir || "") : business.address)}</p>
    <p style="margin:0;"><strong>Pago:</strong> ${escape(METODO_LABEL[aviso.metodoPago] || aviso.metodoPago)}</p>
  </div>

  <p style="margin:22px 0 0;font-size:13px;color:#7a6f65;text-align:center;">
    ¿Alguna duda? Escribinos por WhatsApp al ${escape(business.phone)}.
  </p>
</div>`;

  return { subject: `${titulo} · ${aviso.referencia} · ${business.name}`, html };
}
