/**
 * Saneamiento del historial de chat.
 *
 * El historial lo manda el cliente en cada request, así que es entrada de
 * usuario y se valida como tal. Dos cosas importan acá:
 *
 * 1. **El rol `system` se descarta siempre.** El prompt de sistema lo arma el
 *    servidor; si se aceptara uno del cliente, cualquiera podría reescribir las
 *    reglas del vendedor —precios, descuentos, qué productos existen— con un
 *    mensaje.
 * 2. **Los topes de tamaño son el techo de gasto.** Cada token se paga: sin
 *    límite, alguien manda mil mensajes largos y funde el saldo de DeepSeek.
 *
 * El tope de caracteres **no es el mismo para los dos roles**: `user` es lo
 * que escribe el cliente (una consulta de venta no necesita más de 500), pero
 * `assistant` es lo que generó el propio modelo, limitado en `lib/deepseek.ts`
 * por `max_tokens: 400` — unos 1.400 caracteres en español. Si se le aplicara
 * el mismo tope de 500 a una respuesta propia, `sanearHistorial` se la
 * devolvería truncada en el turno siguiente: el modelo vería una versión
 * corrupta de lo que él mismo dijo.
 *
 * No importa `db` ni nada que lo importe, para poder testearlo con `tsx`.
 */

export type RolCliente = "user" | "assistant";

export interface MensajeCliente {
  role: RolCliente;
  content: string;
}

/** Mensajes que se le mandan al modelo, contando el nuevo. */
export const MAX_MENSAJES = 12;

/** Caracteres por mensaje de `user`. Una consulta de venta no necesita más. */
export const MAX_CARACTERES = 500;

/**
 * Caracteres por mensaje de `assistant`. Tiene que dar holgura sobre los
 * ~1.400 caracteres que puede ocupar una respuesta de `max_tokens: 400`
 * (`lib/deepseek.ts`), o el propio historial del bot se corrompería.
 */
export const MAX_CARACTERES_ASSISTANT = 2000;

function topePara(role: RolCliente): number {
  return role === "assistant" ? MAX_CARACTERES_ASSISTANT : MAX_CARACTERES;
}

export function sanearHistorial(bruto: unknown): MensajeCliente[] {
  if (!Array.isArray(bruto)) return [];

  const limpios = bruto.flatMap((crudo): MensajeCliente[] => {
    if (!crudo || typeof crudo !== "object") return [];
    const { role, content } = crudo as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return [];
    const texto = String(content ?? "").trim().slice(0, topePara(role));
    if (!texto) return [];
    return [{ role, content: texto }];
  });

  return limpios.slice(-MAX_MENSAJES);
}
