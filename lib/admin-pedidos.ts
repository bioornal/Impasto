import type { AdminOrder, OrderItem } from "../app/admin/components/types";
import { esPedidoParaCocina } from "./pedido-visible";

/** Lo que todavía hay que preparar o entregar: la vista por defecto de Pedidos y del Arranque. */
export const ESTADOS_ACTIVOS = ["nuevo", "preparando", "en-camino"] as const;
const RECORRIDO = ["nuevo", "preparando", "en-camino", "entregado"];

export const esActivo = (p: Pick<AdminOrder, "estado">) => (ESTADOS_ACTIVOS as readonly string[]).includes(p.estado);

/** El estado como lo lee el local: en retiro, "en camino" es "Listo para retirar". */
export function etiquetaEstado(estado: string, mode: AdminOrder["mode"]): string {
  switch (estado) {
    case "nuevo": return "Nuevo";
    case "preparando": return "Preparando";
    case "en-camino": return mode === "delivery" ? "En camino" : "Listo para retirar";
    case "entregado": return "Entregado";
    case "cancelado": return "Cancelado";
    default: return estado;
  }
}

/**
 * El paso siguiente del botón de la fila. Misma regla que el detalle: lo que no entra a la
 * cocina (tarjeta sin acreditar, cancelado) no avanza.
 */
export function siguienteEstado(p: Pick<AdminOrder, "estado" | "mode" | "pago" | "pagoEstado">): { estado: string; etiqueta: string } | null {
  const i = RECORRIDO.indexOf(p.estado);
  if (i < 0 || i >= RECORRIDO.length - 1) return null;
  if (!esPedidoParaCocina(p)) return null;
  const estado = RECORRIDO[i + 1];
  return { estado, etiqueta: etiquetaEstado(estado, p.mode) };
}

/** El número de la comanda (`107345`, `POS 3`); la referencia larga solo si no hay número. */
export function numeroCorto(p: Pick<AdminOrder, "numero" | "canal" | "id">): string {
  const numero = String(p.numero ?? "").trim();
  if (!numero) return p.id;
  return p.canal === "pos" ? `POS ${numero}` : numero;
}

/** Los ítems en una línea de hasta `max` caracteres; el primero entra siempre. */
export function resumenItems(items: ReadonlyArray<Pick<OrderItem, "qty" | "name">>, max = 48): { texto: string; resto: number } {
  const partes = items.map((i) => `${i.qty}× ${i.name}`);
  let texto = "";
  let usados = 0;
  for (const parte of partes) {
    const siguiente = texto ? `${texto}, ${parte}` : parte;
    if (texto && siguiente.length > max) break;
    texto = siguiente;
    usados++;
  }
  return { texto, resto: partes.length - usados };
}
