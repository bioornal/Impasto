import { DELIVERY_FEE } from "./business";
import type { AdminOrder, OrderItem } from "../app/admin/components/types";

export function adaptOrder(p: Record<string, unknown>): AdminOrder {
  const mode =
    p.modalidad === "takeaway"
      ? "takeaway"
      : p.modalidad === "delivery"
      ? "delivery"
      : p.direccion && p.direccion !== "Retiro en local"
      ? "delivery"
      : "takeaway";
  const isDelivery = mode === "delivery";
  const total = Number(p.total || 0);
  const shipping = Number(p.envio ?? (isDelivery ? DELIVERY_FEE : 0));
  const items: OrderItem[] = Array.isArray(p.productos)
    ? p.productos.map((i: Record<string, unknown>) => ({
        name: String(i.name || i.nombre || "?"),
        qty: Number(i.qty || i.cantidad || 1),
        price: Number(i.price || i.precio || 0),
        detail: String(i.detail || i.detalle || ""),
      }))
    : [];
  const num = String(p.numero_pedido || "").padStart(4, "0");
  return {
    _dbId: String(p.id || ""),
    id: String(p.external_reference || "IM-" + num),
    cliente: String(p.nombre_cliente || "—"),
    tel: String(p.telefono_cliente || "—"),
    mode: mode as "delivery" | "takeaway",
    dir: isDelivery ? String(p.direccion || "") : "",
    zona: "",
    items,
    subtotal: Number(p.subtotal ?? Math.max(0, Number(p.total_con_descuento || total) - shipping)),
    shipping,
    total,
    pago: String(p.metodo_pago || "n/d"),
    pagoEstado: String(p.estado_pago || "pendiente"),
    cambio: String(p.cambio || ""),
    referencia: String(p.referencia || ""),
    cuando: String(p.cuando || "asap"),
    estado: String(p.status || "nuevo") === "normal" ? "nuevo" : String(p.status || "nuevo"),
    fecha: String(p.created_at || new Date().toISOString()),
    notas: String(p.notas || ""),
  };
}
