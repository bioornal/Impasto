import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { quoteOrder } from "@/lib/order-quote";
import { getCartSessionId } from "@/lib/cart-session";
import { getBusinessConfig } from "@/lib/business-server";
import { SUCURSAL_ID } from "@/lib/business";
import type { CartItem } from "@/types";

export async function POST(req: NextRequest) {
  let order: Record<string, unknown>;
  try {
    order = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (typeof order.nombre !== "string" || typeof order.tel !== "string" || !order.nombre.trim() || !order.tel.trim()) {
    return NextResponse.json({ ok: false, error: "Datos de pedido incompletos" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const business = await getBusinessConfig();
    const quote = await quoteOrder(order.items as CartItem[], String(order.mode || ""), business.deliveryFee);

    const { data: clienteExistente } = await db.database
      .from("clientes")
      .select("cant_compras")
      .eq("telefono", order.tel.trim())
      .limit(1);

    if (clienteExistente && clienteExistente.length > 0) {
      await db.database.from("clientes").update({
        nombre: order.nombre.trim(),
        direccion: typeof order.dir === "string" ? order.dir.trim() : "",
        cant_compras: (clienteExistente[0].cant_compras || 0) + 1,
      }).eq("telefono", order.tel.trim());
    } else {
      await db.database.from("clientes").insert({
        nombre: order.nombre.trim(),
        telefono: order.tel.trim(),
        direccion: typeof order.dir === "string" ? order.dir.trim() : "",
        detalles: "",
        cant_compras: 1,
      });
    }

    const numeroPedido = Date.now() % 900000 + 100000;

    const { error } = await db.database.from("pedidos").insert({
      numero_pedido: numeroPedido,
      nombre_cliente: order.nombre.trim(),
      telefono_cliente: order.tel.trim(),
      direccion: typeof order.dir === "string" && order.dir.trim()
        ? order.dir.trim()
        : "Retiro en local",
      productos: quote.items,
      total: quote.total,
      total_con_descuento: quote.total,
      status: "normal",
      sucursal_id: SUCURSAL_ID,
      fecha: today,
    });

    if (error) throw error;
    const cartSession = await getCartSessionId();
    if (cartSession) await db.database.from("carritos").delete().eq("session_id", cartSession).eq("sucursal_id", SUCURSAL_ID);
    return NextResponse.json({ ok: true, numero: `IM-${numeroPedido}`, ...quote });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
