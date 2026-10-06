



import type { CartItem } from "@/types";

// El tipo y la plantilla del aviso al local viven en `lib/aviso-local.ts`, que
// no importa el SDK y por eso se puede testear bajo `tsx`. Se reexportan para
// no romper a quien ya los importaba desde acá.
export type { TipoAviso, AvisoPedido } from "@/lib/aviso-local";
import type { AvisoPedido } from "@/lib/aviso-local";

export { plantilla } from "@/lib/plantilla-email";

export { notificarPedido } from "@/lib/notification-server";

/** Traduce una fila de `pedidos` al aviso, para avisar desde el webhook. */
export function avisoDesdePedido(fila: Record<string, unknown>): AvisoPedido {
  const productos = Array.isArray(fila.productos) ? (fila.productos as CartItem[]) : [];
  return {
    pedidoId: String(fila.id),
    referencia: String(fila.external_reference || `IM-${fila.numero_pedido ?? ""}`),
    nombre: String(fila.nombre_cliente || ""),
    email: String(fila.email_cliente || ""),
    tel: String(fila.telefono_cliente || ""),
    mode: String(fila.modalidad || "delivery"),
    dir: String(fila.direccion || ""),
    items: productos,
    subtotal: Number(fila.subtotal || 0),
    shipping: Number(fila.envio || 0),
    total: Number(fila.total || 0),
    metodoPago: String(fila.metodo_pago || ""),
    cuentaTransferencia: fila.cuenta_transferencia && typeof fila.cuenta_transferencia === 'object'
      ? String((fila.cuenta_transferencia as Record<string,unknown>).nombre || '') : undefined,
  };
}
