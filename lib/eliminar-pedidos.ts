/**
 * Qué pedidos se pueden eliminar desde el panel. Puro, para testearse con `tsx`; la
 * ruta es `app/api/admin/pedidos/eliminar/route.ts`.
 */
export const MAXIMO_POR_VEZ = 100;

export interface PedidoEliminable {
  metodo_pago?: unknown;
  estado_pago?: unknown;
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/**
 * Motivo por el que NO se puede eliminar, o `null` si se puede.
 *
 * - Tarjeta con el pago acreditado o devuelto: es plata que pasó por Mercado Pago, y su
 *   rastro tiene que quedar. Eliminarlo descuadra la conciliación.
 * - Con costeo o movimientos de pago guardados: son inmutables a propósito (el trigger de
 *   la base los protege), así que el pedido tampoco se puede borrar.
 */
export function motivoNoEliminable(pedido: PedidoEliminable, conRegistroContable: boolean): string | null {
  if (norm(pedido.metodo_pago) === "mercadopago" && ["aprobado", "parcialmente_reembolsado", "reembolsado"].includes(norm(pedido.estado_pago))) {
    return "Pago con tarjeta acreditado o devuelto: tiene que quedar el registro.";
  }
  if (conRegistroContable) {
    return "Tiene costeo o movimientos de pago guardados, que son inmutables.";
  }
  return null;
}
