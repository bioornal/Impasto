/**
 * Cuándo la página de seguimiento tiene que dejar de preguntar.
 *
 * Refresca cada 15 segundos, y hasta ahora no paraba nunca: un tab abierto en
 * una referencia equivocada consultaba la API para siempre, 4 veces por minuto
 * y cada una escribiendo su fila de rate limit. Lo mismo con un pedido ya
 * entregado, cuyo estado no va a cambiar más.
 *
 * Sin dependencias, para poder testearlo con `tsx` y a la vez importarlo desde
 * la página, que es `"use client"`.
 */

/** Estados en los que el pedido terminó su recorrido. */
const FINALES = new Set(["entregado", "cancelado"]);

/**
 * Si la respuesta del servidor cierra el asunto.
 *
 * Solo 400 (referencia mal formada) y 404 (no existe): eso no se arregla con
 * el tiempo. Un 429 del rate limit se libera solo, y un 500 puede ser un hipo
 * de base — cortar ahí dejaría a alguien con un pedido real y una pantalla
 * muerta, que es peor que unas consultas de más.
 */
export function esRespuestaDefinitiva(status: number): boolean {
  return status === 400 || status === 404;
}

/**
 * Si el pedido ya no va a cambiar de estado.
 *
 * Ante un estado desconocido devuelve `false` a propósito: parar de más congela
 * la pantalla de un pedido que sí estaba avanzando, y eso lo sufre el cliente.
 */
export function esEstadoFinal(estado: string | undefined | null): boolean {
  return FINALES.has(String(estado ?? "").trim().toLowerCase());
}
