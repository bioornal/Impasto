import { db } from "@/lib/insforge";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export type EmailResult =
  | { estado: "enviado"; id: string }
  | { estado: "omitido"; motivo: string }
  | { estado: "fallido"; motivo: string };

/**
 * Punto único de envío. Cambiar de proveedor es cambiar sólo este archivo:
 * `EMAIL_PROVIDER=resend` usa Resend, `insforge` usa el envío nativo (requiere
 * plan pago), y sin configurar no se envía nada pero tampoco se rompe el pedido.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase();

  if (provider === "resend") return sendConResend(message);
  if (provider === "insforge") return sendConInsforge(message);
  return { estado: "omitido", motivo: "EMAIL_PROVIDER no configurado" };
}

async function sendConResend(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { estado: "omitido", motivo: "Faltan RESEND_API_KEY o EMAIL_FROM" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: message.to, subject: message.subject, html: message.html }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { estado: "fallido", motivo: body?.message || `HTTP ${response.status}` };
    return { estado: "enviado", id: String(body?.id || "") };
  } catch (err) {
    return { estado: "fallido", motivo: err instanceof Error ? err.message : "error de red" };
  }
}

async function sendConInsforge(message: EmailMessage): Promise<EmailResult> {
  try {
    const { data, error } = await db.emails.send({
      to: message.to,
      subject: message.subject,
      html: message.html,
      from: process.env.EMAIL_FROM_NAME || "Impasto",
    });
    if (error) return { estado: "fallido", motivo: error.message };
    return { estado: "enviado", id: String((data as { id?: string } | null)?.id || "") };
  } catch (err) {
    return { estado: "fallido", motivo: err instanceof Error ? err.message : "error" };
  }
}
