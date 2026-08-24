import { db } from "@/lib/insforge";
import { quoteOrder } from "@/lib/order-quote";
import { getBusinessConfig } from "@/lib/business-server";
import { getCartSessionId } from "@/lib/cart-session";
import { estadoTienda } from "@/lib/hours";
import { SUCURSAL_ID } from "@/lib/business";
import type { EstadoPago } from "@/lib/mercadopago";
import type { CartItem } from "@/types";

export interface OrderPayload {
  nombre: string;
  tel: string;
  email: string;
  dir?: string;
  ref?: string;
  notas?: string;
  cambio?: string;
  mode: string;
  when?: string;
  items: CartItem[];
}

export interface CreatedOrder {
  id: string;
  numero: number;
  referencia: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  freeShipping: boolean;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Valida los datos mínimos del cliente. Lanza con un mensaje mostrable al usuario. */
export function validateOrderPayload(order: Record<string, unknown>): OrderPayload {
  const nombre = text(order.nombre);
  const tel = text(order.tel);
  const email = text(order.email);
  if (!nombre || !tel) throw new Error("Datos de pedido incompletos");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Necesitamos un email válido para enviarte la confirmación");
  if (order.mode !== "delivery" && order.mode !== "takeaway") throw new Error("Modalidad de entrega inválida");
  if (order.mode === "delivery" && !text(order.dir)) throw new Error("La dirección es obligatoria para delivery");

  return {
    nombre,
    tel,
    email,
    dir: text(order.dir),
    ref: text(order.ref),
    notas: text(order.notas),
    cambio: text(order.cambio),
    mode: order.mode,
    when: text(order.when) || "asap",
    items: order.items as CartItem[],
  };
}

async function upsertCliente(order: OrderPayload) {
  const { data: existente } = await db.database
    .from("clientes")
    .select("cant_compras")
    .eq("telefono", order.tel)
    .limit(1);

  if (existente && existente.length > 0) {
    await db.database
      .from("clientes")
      .update({
        nombre: order.nombre,
        email: order.email,
        direccion: order.dir || "",
        cant_compras: (existente[0].cant_compras || 0) + 1,
      })
      .eq("telefono", order.tel);
    return;
  }

  await db.database.from("clientes").insert({
    nombre: order.nombre,
    telefono: order.tel,
    email: order.email,
    direccion: order.dir || "",
    detalles: "",
    cant_compras: 1,
  });
}

/**
 * Cotiza server-side, registra el cliente y persiste el pedido.
 * El total nunca sale del cliente: siempre se recalcula acá.
 */
export async function createPedido(
  order: OrderPayload,
  payment: { metodoPago: string; estadoPago: EstadoPago; proveedorPago: string },
): Promise<CreatedOrder> {
  const business = await getBusinessConfig();

  // Choke point: ninguna vía de pago puede saltearse el horario ni el
  // interruptor manual de ventas.
  const estado = estadoTienda(business);
  if (!estado.abierto) throw new Error(estado.motivo);

  const quote = await quoteOrder(order.items, order.mode, business);

  await upsertCliente(order);

  const numero = (Date.now() % 900000) + 100000;
  const referencia = `IM-${numero}`;

  const { data, error } = await db.database
    .from("pedidos")
    .insert({
      numero_pedido: numero,
      proyecto_id: "impasto",
      nombre_cliente: order.nombre,
      telefono_cliente: order.tel,
      email_cliente: order.email,
      direccion: order.dir || "Retiro en local",
      productos: quote.items,
      total: quote.total,
      total_con_descuento: quote.total,
      status: "normal",
      sucursal_id: SUCURSAL_ID,
      modalidad: order.mode === "takeaway" ? "takeaway" : "delivery",
      cuando: order.when || "asap",
      metodo_pago: payment.metodoPago,
      cambio: order.cambio || "",
      referencia: order.ref || "",
      notas: order.notas || "",
      subtotal: quote.subtotal,
      envio: quote.shipping,
      estado_pago: payment.estadoPago,
      proveedor_pago: payment.proveedorPago,
      id_pago: "",
      mp_order_id: "",
      external_reference: referencia,
      fecha: new Date().toISOString().slice(0, 10),
    })
    .select("id");

  if (error) throw error;
  const id = String((Array.isArray(data) ? data[0]?.id : undefined) || "");

  await registrarEvento({
    pedidoId: id,
    tipo: "estado",
    valor: "normal",
    origen: "checkout",
    detalle: { metodo_pago: payment.metodoPago, estado_pago: payment.estadoPago },
  });

  return { id, numero, referencia, ...quote };
}

/** Deja rastro de cada cambio de estado, para el panel y el futuro chatbot. */
export async function registrarEvento(event: {
  pedidoId: string;
  tipo: "estado" | "pago";
  valor: string;
  origen: "checkout" | "panel" | "webhook" | "sistema";
  detalle?: Record<string, unknown>;
}) {
  if (!event.pedidoId) return;
  await db.database.from("pedido_eventos").insert({
    pedido_id: event.pedidoId,
    tipo: event.tipo,
    valor: event.valor,
    origen: event.origen,
    detalle: event.detalle || {},
  });
}

/** Vacía el carrito borrador una vez que el pedido quedó registrado. */
export async function clearCartDraft() {
  const session = await getCartSessionId();
  if (!session) return;
  await db.database.from("carritos").delete().eq("session_id", session).eq("sucursal_id", SUCURSAL_ID);
}
