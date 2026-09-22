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

// Por uuid y no por el id visible: el POS numera 1, 2, 3… y ese número se repite entre días.
export function clavesDePedidos(pedidos: { _dbId: string }[]): Set<string> {
  return new Set(pedidos.map((p) => p._dbId));
}

/**
 * IDs que ya estaban habilitados para cocina al iniciar el panel.
 * Una tarjeta pendiente queda deliberadamente afuera para poder anunciarla
 * cuando Mercado Pago la apruebe en un sondeo posterior.
 */
export function clavesDePedidosParaCocina<T extends PedidoVisibleParams & { _dbId: string }>(
  pedidos: T[],
): Set<string> {
  return new Set(pedidos.filter(esPedidoParaCocina).map((p) => p._dbId));
}

/**
 * Mantiene un historial monótono de pedidos que alguna vez entraron a cocina.
 * No elimina IDs al cancelar: así una eventual reactivación no vuelve a sonar.
 */
export function registrarPedidosConocidosParaCocina<T extends PedidoVisibleParams & { _dbId: string }>(
  conocidos: Set<string>,
  pedidos: T[],
): Set<string> {
  const siguientes = new Set(conocidos);
  for (const pedido of pedidos) {
    if (esPedidoParaCocina(pedido)) siguientes.add(pedido._dbId);
  }
  return siguientes;
}

export function pedidosNuevosParaCocina<T extends PedidoVisibleParams & { _dbId: string }>(
  conocidos: Set<string>,
  pedidos: T[],
): T[] {
  return pedidos.filter((p) => !conocidos.has(p._dbId) && esPedidoParaCocina(p));
}
