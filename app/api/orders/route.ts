import { NextRequest, NextResponse } from "next/server";
import { createPedido, validateOrderPayload, clearCartDraft } from "@/lib/orders";
import { notificarPedido } from "@/lib/notifications";

/** Métodos que se cobran al entregar: no pasan por Mercado Pago. */
const METODOS_OFFLINE = ["efectivo", "transferencia"];

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const metodoPago = String(body.pago || "efectivo");
  if (!METODOS_OFFLINE.includes(metodoPago)) {
    return NextResponse.json(
      { ok: false, error: "Ese método de pago se procesa desde el checkout con tarjeta" },
      { status: 400 },
    );
  }

  try {
    const order = validateOrderPayload(body);
    const created = await createPedido(order, {
      metodoPago,
      estadoPago: "pendiente",
      proveedorPago: "manual",
    });

    await clearCartDraft();

    // Un fallo de email nunca debe voltear un pedido ya registrado.
    try {
      await notificarPedido({
        pedidoId: created.id,
        referencia: created.referencia,
        nombre: order.nombre,
        email: order.email,
        mode: order.mode,
        dir: order.dir,
        items: created.items,
        subtotal: created.subtotal,
        shipping: created.shipping,
        total: created.total,
        metodoPago,
      }, "pedido_recibido");
    } catch { /* queda registrado como fallido en `notificaciones` */ }

    return NextResponse.json({
      ok: true,
      numero: created.referencia,
      items: created.items,
      subtotal: created.subtotal,
      shipping: created.shipping,
      total: created.total,
      freeShipping: created.freeShipping,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
