import { fmt } from "@/lib/utils";
import type { CartItem } from "@/types";

/**
 * Armado del aviso que le llega al local. Vive aparte de `lib/notifications.ts`
 * a propósito: ese módulo importa el SDK de InsForge y no se puede cargar bajo
 * `tsx`, así que la plantilla no sería testeable desde ahí.
 *
 * Sin dependencias fuera de `@/lib/utils` y `@/types`.
 */

export type TipoAviso = "pedido_recibido" | "pago_aprobado";

export interface AvisoPedido {
  pedidoId: string;
  referencia: string;
  nombre: string;
  email: string;
  tel?: string;
  mode: string;
  dir?: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  metodoPago: string;
}

/**
 * El mensaje va sin `parse_mode`, pero un salto de línea metido en el nombre o
 * la dirección igual podría falsificar una línea del aviso. Todo lo que escribe
 * el cliente pasa por acá.
 */
const unaLinea = (valor: unknown) => String(valor ?? "").replace(/\s+/g, " ").trim();

/**
 * Qué hacer con la plata. Se evita un "PAGO OK" genérico porque en efectivo
 * tampoco está cobrado, y quien entrega necesita saber si tiene que pedirla.
 */
function lineaDePago(aviso: AvisoPedido, tipo: TipoAviso): string {
  if (aviso.metodoPago === "efectivo") return `COBRAR AL ENTREGAR ${fmt(aviso.total)}`;
  if (aviso.metodoPago === "mercadopago") {
    return tipo === "pago_aprobado" ? "PAGADO CON TARJETA" : "PAGO SIN CONFIRMAR — revisar";
  }
  if (aviso.metodoPago === "transferencia") return "PAGO SIN CONFIRMAR — revisar";
  return `PAGO: ${unaLinea(aviso.metodoPago)}`;
}

export function plantillaLocal(aviso: AvisoPedido, tipo: TipoAviso): string {
  const esDelivery = aviso.mode === "delivery";
  const lineas: string[] = [];

  lineas.push(`PEDIDO NUEVO — ${unaLinea(aviso.referencia)}`);
  lineas.push(lineaDePago(aviso, tipo));
  lineas.push("");

  const dir = unaLinea(aviso.dir);
  lineas.push(esDelivery ? `Delivery — ${dir || "SIN DIRECCIÓN"}` : "Retira en el local");

  const contacto = [unaLinea(aviso.nombre), unaLinea(aviso.tel)].filter(Boolean).join(" — ");
  if (contacto) lineas.push(contacto);
  lineas.push("");

  for (const item of aviso.items) {
    const detalle = unaLinea(item.detail);
    lineas.push(`${item.qty}x ${unaLinea(item.name)}${detalle ? ` (${detalle})` : ""}`);
  }
  lineas.push("");

  lineas.push(`Total ${fmt(aviso.total)}`);

  return lineas.join("\n");
}
