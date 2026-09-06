/**
 * Cómo interpretar una falla del chat: qué hace el widget y a quién hay que
 * despertar.
 *
 * Sin dependencias, igual que `lib/aviso-local.ts` y `lib/chat-mensajes.ts`:
 * así se testea con `tsx` y además el widget (`"use client"`) puede importar
 * `esFallaDelAsistente` sin arrastrar nada del servidor.
 */

export interface AlertaChat {
  /** Identifica el problema para no repetir el mismo aviso cada minuto. */
  clave: string;
  /** El texto que le llega al dueño por Telegram. */
  texto: string;
}

/**
 * Si el widget tiene que rendirse y volverse un botón de WhatsApp.
 *
 * Solo 502 y 503: son los dos códigos con los que `app/api/chat/route.ts` dice
 * "el asistente no está" (DeepSeek falló, o no hay key). El 429 del rate limit
 * propio se levanta en minutos y el 400 es un historial mal armado: en esos
 * dos, insistir sirve, así que el bot se queda.
 */
export function esFallaDelAsistente(status: number): boolean {
  return status === 502 || status === 503;
}

/**
 * El código que `lib/deepseek.ts` antepone al motivo (`HTTP ${status} …`).
 * Se lee solo del principio: un "402" mencionado dentro del cuerpo de otro
 * error no puede disfrazarse de falta de saldo.
 */
function codigoHttp(motivo: string): number | null {
  const encontrado = /^HTTP (\d{3})(\s|$)/.exec(motivo.trim());
  return encontrado ? Number(encontrado[1]) : null;
}

/**
 * El detalle lo escribe DeepSeek, no nosotros. El mensaje va sin `parse_mode`
 * —ver `lib/telegram.ts`—, pero un salto de línea en el cuerpo del error igual
 * podría falsificar un renglón del aviso. Mismo cuidado que `lib/aviso-local.ts`.
 */
const unaLinea = (valor: string) => valor.replace(/\s+/g, " ").trim();

const ENCABEZADO = "CHAT CAÍDO — el asistente del sitio no responde";
const MIENTRAS_TANTO = "Mientras tanto el widget les muestra WhatsApp a los clientes.";

/**
 * Decide si una falla merece un aviso al dueño, y con qué texto.
 *
 * Solo las que **piden una acción suya**: sin saldo (402) y key rechazada
 * (401). Un 500 o un timeout de DeepSeek se arreglan solos, y avisar por cada
 * uno convertiría el aviso en ruido — que es peor que no tenerlo, porque
 * entonces tampoco se mira el que sí importa.
 */
export function alertaPorFallo(motivo: string): AlertaChat | null {
  const codigo = codigoHttp(motivo);
  if (codigo !== 402 && codigo !== 401) return null;

  const detalle = unaLinea(motivo.replace(/^\s*HTTP \d{3}/, "")).slice(0, 200);

  const lineas = codigo === 402
    ? [
        ENCABEZADO,
        "Se quedó sin saldo la cuenta de DeepSeek (HTTP 402).",
        MIENTRAS_TANTO,
        "Recargá en https://platform.deepseek.com",
      ]
    : [
        ENCABEZADO,
        "DeepSeek rechazó la key (HTTP 401).",
        MIENTRAS_TANTO,
        "Revisá DEEPSEEK_API_KEY en Netlify.",
      ];

  if (detalle) lineas.push(`Detalle: ${detalle}`);

  return {
    clave: codigo === 402 ? "deepseek-sin-saldo" : "deepseek-key-rechazada",
    texto: lineas.join("\n"),
  };
}
