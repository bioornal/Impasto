interface PedidoActualAdmin {
  metodo_pago?: unknown;
  estado_pago?: unknown;
  status?: unknown;
}

interface ActualizacionAdminPedido {
  status?: string;
  estado_pago?: string;
}

const ESTADOS_DE_PRODUCCION = new Set(["preparando", "en-camino", "entregado"]);

/**
 * Regla de dominio para cambios hechos por el panel operativo.
 * Mercado Pago es la única fuente autorizada para acreditar sus propios pagos.
 */
export function validarActualizacionAdminPedido(
  pedido: PedidoActualAdmin,
  actualizacion: ActualizacionAdminPedido,
): string | null {
  const metodoPago = String(pedido.metodo_pago || "").toLowerCase();
  if (metodoPago !== "mercadopago") return null;

  if (actualizacion.estado_pago !== undefined) {
    return "Los pagos de Mercado Pago se actualizan automáticamente";
  }

  const nuevoStatus = String(actualizacion.status || "").toLowerCase();
  const estadoPago = String(pedido.estado_pago || "").toLowerCase();
  if (ESTADOS_DE_PRODUCCION.has(nuevoStatus) && estadoPago !== "aprobado") {
    return "El pago de Mercado Pago debe estar aprobado antes de avanzar el pedido";
  }

  return null;
}
