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
 * No importa `db` ni nada que lo importe, para poder testearlo con `tsx`.
 */

export type RolCliente = "user" | "assistant";

export interface MensajeCliente {
  role: RolCliente;
  content: string;
}

/** Mensajes que se le mandan al modelo, contando el nuevo. */
export const MAX_MENSAJES = 12;

/** Caracteres por mensaje. Una consulta de venta no necesita más. */
export const MAX_CARACTERES = 500;

export function sanearHistorial(bruto: unknown): MensajeCliente[] {
  if (!Array.isArray(bruto)) return [];

  const limpios = bruto.flatMap((crudo): MensajeCliente[] => {
    if (!crudo || typeof crudo !== "object") return [];
    const { role, content } = crudo as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return [];
    const texto = String(content ?? "").trim().slice(0, MAX_CARACTERES);
    if (!texto) return [];
    return [{ role, content: texto }];
  });

  return limpios.slice(-MAX_MENSAJES);
}
