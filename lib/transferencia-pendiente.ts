/**
 * Una transferencia no está pagada hasta que el local ve el comprobante y marca
 * "Pago recibido" en el panel. Hasta entonces el cliente no tiene que leer que
 * lo estamos preparando: el pedido está registrado y a la espera de su pago.
 *
 * Sin dependencias, para poder testearlo con `tsx` y usarlo desde componentes
 * `"use client"`, la API y el mail.
 */

const norm = (valor: unknown) => String(valor ?? "").trim().toLowerCase();

/** Pedido por transferencia cuyo pago todavía no se acreditó. */
export function esperaComprobante(metodoPago: unknown, estadoPago: unknown): boolean {
  return norm(metodoPago) === "transferencia" && (norm(estadoPago) || "pendiente") === "pendiente";
}

/**
 * El estado del pedido que se le muestra al cliente. Mientras espera el
 * comprobante, "preparando" y "en camino" se informan como "nuevo", aunque el
 * panel ya los haya movido: el cliente nunca ve avanzar un pedido sin pagar.
 * Cancelado y entregado se respetan tal cual.
 */
export function estadoVisibleAlCliente(estado: string, metodoPago: unknown, estadoPago: unknown): string {
  if (!esperaComprobante(metodoPago, estadoPago)) return estado;
  return estado === "preparando" || estado === "en-camino" ? "nuevo" : estado;
}
