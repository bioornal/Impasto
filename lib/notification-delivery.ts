export interface FrozenEmail { provider: 'resend' | 'insforge' | ''; from: string; to: string; subject: string; html: string; replyTo?: string }
export interface FrozenTelegram { chatIds: string[]; text: string }
export type DeliveryState = 'enviado' | 'fallido' | 'omitido' | 'incierto';
export interface DeliveryResult { estado: DeliveryState; motivo?: string; id?: string; recibos?: Record<string, string> }
export async function deliverEmail(message: FrozenEmail, key: string, secret: string, fetcher: typeof fetch = fetch): Promise<DeliveryResult> {
  if (message.provider !== 'resend' || !secret || !message.from || !message.to) return { estado: 'omitido', motivo: 'Email sin configurar o destinatario vacío' };
  try {
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ from: message.from, to: message.to, subject: message.subject, html: message.html, ...(message.replyTo ? { reply_to: message.replyTo } : {}) }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { estado: response.status >= 500 || response.status === 408 || response.status === 409 ? 'incierto' : 'fallido', motivo: `Email HTTP ${response.status}` };
    if (typeof body?.id !== 'string' || !body.id.trim()) return { estado: 'incierto', motivo: 'Email sin comprobante de entrega' };
    return { estado: 'enviado', id: body.id };
  } catch { return { estado: 'incierto', motivo: 'No se pudo confirmar la respuesta del proveedor de email' }; }
}

/** Texto plano: no agregar parse_mode para contenido escrito por clientes. */
export async function deliverTelegram(message: FrozenTelegram, previous: Record<string,string>, secret: string, fetcher: typeof fetch = fetch): Promise<DeliveryResult & { recibos: Record<string,string> }> {
  const recibos = { ...previous };
  const chatIds = [...new Set(message.chatIds.filter(Boolean))];
  if (!secret || !chatIds.length) return { estado: 'omitido', motivo: 'Telegram sin configurar', recibos };
  const results = await Promise.all(chatIds.filter(id => !recibos[id]).map(async chatId => {
    try {
      const response = await fetcher(`https://api.telegram.org/bot${secret}/sendMessage`, {
        method: 'POST', signal: AbortSignal.timeout(20_000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message.text, disable_web_page_preview: true }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) return { estado: response.status >= 500 || response.status === 408 ? 'incierto' : 'fallido', chatId };
      const id = body?.result?.message_id;
      if (body?.ok !== true || !Number.isSafeInteger(id) || id <= 0) return { estado: 'incierto', chatId };
      recibos[chatId] = String(id); return { estado: 'enviado', chatId };
    } catch { return { estado: 'incierto', chatId }; }
  }));
  if (results.some(r => r.estado === 'incierto')) return { estado: 'incierto', motivo: 'Telegram: entrega sin confirmar en uno o más destinatarios', recibos };
  if (results.some(r => r.estado === 'fallido')) return { estado: 'fallido', motivo: 'Telegram: uno o más destinatarios rechazaron el envío', recibos };
  return { estado: 'enviado', recibos };
}
