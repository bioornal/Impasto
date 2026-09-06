import { randomInt } from "node:crypto";

/**
 * La referencia del pedido: `IM-107345-K7QD`.
 *
 * El número solo no alcanzaba. Se armaba con `Date.now() % 900000 + 100000`, que
 * tiene dos problemas al mismo tiempo:
 *
 * - **Se repite cada 15 minutos** (900.000 ms), y el índice de
 *   `pedidos.external_reference` no es único. El webhook de Mercado Pago busca
 *   el pedido por esa referencia con `.limit(1)`, así que una colisión puede
 *   marcar pagado el pedido equivocado. Encima la referencia es la clave de
 *   idempotencia que se le manda a MP: dos pedidos con la misma clave y el
 *   segundo cobro se trata como reintento del primero.
 * - **Es adivinable.** La ruta pública `/api/orders/[ref]` devuelve nombre,
 *   dirección e ítems del cliente; con 900.000 valores posibles —y derivados de
 *   la hora del pedido— cualquiera podía barrer el rango entero.
 *
 * El sufijo aleatorio arregla los dos: la referencia deja de repetirse y deja
 * de poder adivinarse.
 *
 * Server-only (usa `node:crypto`). No importarlo desde un componente cliente.
 */

/**
 * Sin `O`, `I`, `0` ni `1`: el cliente dicta esta referencia por teléfono y la
 * tipea en la URL del seguimiento. Una O que era un 0 lo manda a "pedido no
 * encontrado" y a llamar al local.
 */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const LARGO_SUFIJO = 4;

/** `randomInt` y no `Math.random()`: esto es lo que hace impredecible la referencia. */
function sufijo(): string {
  let salida = "";
  for (let i = 0; i < LARGO_SUFIJO; i++) salida += ALFABETO[randomInt(0, ALFABETO.length)];
  return salida;
}

/** La referencia de un pedido nuevo, a partir de su número. */
export function nuevaReferencia(numero: number): string {
  return `IM-${numero}-${sufijo()}`;
}

const FORMATO = new RegExp(`^IM-\\d{6}-[${ALFABETO}]{${LARGO_SUFIJO}}$`);

/**
 * Si una referencia tiene la forma correcta. La ruta pública de seguimiento la
 * usa **antes** de consultar la base: así un intento de enumeración se rechaza
 * sin costar una consulta.
 *
 * Tolera minúsculas y espacios porque la gente tipea la URL a mano.
 *
 * **Rechaza el formato viejo `IM-######`** a propósito: es justamente el que se
 * podía barrer. Cuando se hizo el cambio la tabla `pedidos` estaba vacía, así
 * que no hay pedidos viejos que se rompan. Si alguna vez se restauran pedidos
 * anteriores a esto, esta es la línea que hay que aflojar.
 */
export function esReferenciaValida(valor: string): boolean {
  return FORMATO.test(String(valor || "").trim().toUpperCase());
}

/** Normaliza lo que llega por URL a la forma en que se guardó. */
export function normalizarReferencia(valor: string): string {
  return String(valor || "").trim().toUpperCase();
}
