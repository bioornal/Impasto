export interface PedidoVisibleParams {
  metodo_pago?: string;
  estado_pago?: string;
  status?: string;
  pago?: string;
  pagoEstado?: string;
  estado?: string;
}

/**
 * Determina si un pedido debe ser enviado a preparación/impresión en cocina:
 * - False si el status general es "cancelado".
 * - Si el método de pago es Mercado Pago, solo entra a cocina si estado_pago es "aprobado".
 *   (Evita que pedidos con tarjetas rechazadas o pendientes entren a producción o suenen en la campanilla).
 * - Efectivo y transferencia entran a cocina para su preparación.
 */
export function esPedidoParaCocina(p: PedidoVisibleParams): boolean {
  const status = String(p.status || p.estado || "").toLowerCase();
  if (status === "cancelado") return false;

  const metodo = String(p.metodo_pago || p.pago || "").toLowerCase();
  const estadoPago = String(p.estado_pago || p.pagoEstado || "").toLowerCase();

  if (metodo === "mercadopago") {
    return estadoPago === "aprobado";
  }

  return true;
}

/**
 * Determina si un pedido computa para los totales de venta en el Dashboard.
 * Excluye pedidos cancelados y pagos con tarjeta no aprobados.
 */
export function esPedidoValidoParaVentas(p: PedidoVisibleParams): boolean {
  return esPedidoParaCocina(p);
}
