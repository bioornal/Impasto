export type TelegramResult =
  | { estado: "enviado"; ids: string[] }
  | { estado: "omitido"; motivo: string }
  | { estado: "fallido"; motivo: string };

/**
 * Punto único de envío a Telegram, espejo de `lib/email.ts`. Sin las variables
 * configuradas no envía nada, pero tampoco rompe el pedido.
 *
 * **Nunca agregar `parse_mode`.** El texto lleva nombre y dirección escritos por
 * el cliente: con Markdown o HTML activos, un nombre podría inyectar formato o
 * un link. Es la misma decisión que tomó Carro Fogón, por el mismo motivo.
 */
export async function sendTelegram(text: string): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!token) return { estado: "omitido", motivo: "TELEGRAM_BOT_TOKEN no configurado" };
  if (chatIds.length === 0) return { estado: "omitido", motivo: "TELEGRAM_CHAT_IDS vacío" };

  // Que un chat falle no puede cancelar los demás: si el celular del cadete
  // bloqueó el bot, el del local tiene que recibir el pedido igual.
  const envios = await Promise.allSettled(
    chatIds.map(async (chatId) => {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.description || `HTTP ${response.status}`);
      return String(body?.result?.message_id || "");
    }),
  );

  const enviados = envios.filter((e) => e.status === "fulfilled") as PromiseFulfilledResult<string>[];
  if (enviados.length === 0) {
    const primero = envios[0];
    const motivo = primero && primero.status === "rejected"
      ? (primero.reason instanceof Error ? primero.reason.message : String(primero.reason))
      : "no se pudo enviar";
    return { estado: "fallido", motivo };
  }

  return { estado: "enviado", ids: enviados.map((e) => e.value) };
}
