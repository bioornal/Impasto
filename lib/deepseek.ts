/**
 * Punto único de llamada a DeepSeek, espejo de `lib/telegram.ts`.
 *
 * Sin `DEEPSEEK_API_KEY` devuelve `omitido` y no rompe nada: el sitio funciona
 * entero y el widget muestra WhatsApp.
 *
 * **La key es server-only.** Nunca `NEXT_PUBLIC_`: en el bundle del cliente
 * quedaría pública y cualquiera gastaría el saldo del dueño.
 *
 * La API de DeepSeek es compatible con OpenAI, así que no hace falta ninguna
 * dependencia: alcanza con `fetch`. Los modelos son `deepseek-v4-flash` y
 * `deepseek-v4-pro`; los viejos `deepseek-chat` y `deepseek-reasoner` ya no
 * existen.
 */

export type ChatMensaje = { role: "system" | "user" | "assistant"; content: string };

export type DeepSeekResult =
  | { estado: "ok"; stream: ReadableStream<Uint8Array> }
  | { estado: "omitido"; motivo: string }
  | { estado: "fallido"; motivo: string };

/** Si hay key configurada. Se consulta desde el servidor para decidir si mostrar el chat. */
export const hayChat = () => Boolean(process.env.DEEPSEEK_API_KEY);

/**
 * Texto de una línea SSE, o `null` si esa línea no aporta nada.
 *
 * Tolera todo lo que manda un servidor SSE y no es contenido: comentarios de
 * keep-alive, líneas en blanco, el `[DONE]` final y —sobre todo— JSON
 * incompleto, que aparece cuando un chunk de red corta una línea al medio.
 */
export function textoDeLineaSSE(linea: string): string | null {
  if (!linea.startsWith("data:")) return null;
  const carga = linea.slice(5).trim();
  if (!carga || carga === "[DONE]") return null;
  try {
    const json = JSON.parse(carga) as { choices?: { delta?: { content?: unknown } }[] };
    const delta = json.choices?.[0]?.delta?.content;
    return typeof delta === "string" && delta.length > 0 ? delta : null;
  } catch {
    return null;
  }
}

/**
 * Convierte el stream SSE de DeepSeek en un stream de texto plano.
 *
 * El buffer `resto` es lo que hace que funcione: los chunks de red no respetan
 * los límites de línea, así que una línea puede llegar partida entre dos
 * chunks. Sin el buffer, esos pedazos se descartan como JSON roto y el cliente
 * ve la respuesta con agujeros.
 */
export function streamDeTexto(sse: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let resto = "";

  return sse.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        resto += decoder.decode(chunk, { stream: true });
        const lineas = resto.split("\n");
        // La última puede estar incompleta: se guarda para el próximo chunk.
        resto = lineas.pop() ?? "";
        for (const linea of lineas) {
          const texto = textoDeLineaSSE(linea.trim());
          if (texto) controller.enqueue(encoder.encode(texto));
        }
      },
      flush(controller) {
        const texto = textoDeLineaSSE(resto.trim());
        if (texto) controller.enqueue(encoder.encode(texto));
      },
    }),
  );
}

export async function chatStream(mensajes: ChatMensaje[]): Promise<DeepSeekResult> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { estado: "omitido", motivo: "DEEPSEEK_API_KEY no configurada" };

  const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const modelo = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

  // `AbortSignal.timeout()` no es un timeout de conexión: queda atado también
  // al cuerpo de la respuesta, así que a los 20s cortaría un stream que venía
  // bien. Para entonces la ruta ya mandó el 200 y no hay forma de avisar del
  // error: el cliente vería la frase cortada a la mitad sin explicación.
  // Un `AbortController` propio, cancelado apenas llegan los headers, cubre
  // solo la conexión y deja correr el stream sin techo de tiempo.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelo,
        messages: mensajes,
        stream: true,
        // Un vendedor que escribe párrafos no vende, y es el techo de gasto por respuesta.
        max_tokens: 400,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const detalle = await response.text().catch(() => "");
      return { estado: "fallido", motivo: `HTTP ${response.status} ${detalle.slice(0, 200)}` };
    }
    if (!response.body) {
      return { estado: "fallido", motivo: "DeepSeek respondió sin body" };
    }

    return { estado: "ok", stream: streamDeTexto(response.body) };
  } catch (error) {
    // Si el error vino de otra cosa que no sea el propio abort, el timer
    // sigue vivo: cancelarlo evita dejarlo pendiente de más.
    clearTimeout(timer);
    return {
      estado: "fallido",
      motivo: error instanceof Error ? error.message : "no se pudo conectar con DeepSeek",
    };
  }
}
