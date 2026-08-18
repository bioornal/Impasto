import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-auth";
import { registrarEvento } from "@/lib/orders";
import { refundOrder, mapOrderStatus } from "@/lib/mercadopago";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const montoPedido = body.amount === undefined ? null : Number(body.amount);

  if (montoPedido !== null && (!Number.isFinite(montoPedido) || montoPedido <= 0)) {
    return NextResponse.json({ ok: false, error: "Monto de devolución inválido" }, { status: 400 });
  }

  const { data } = await db.database
    .from("pedidos")
    .select("id,total,estado_pago,mp_order_id,id_pago,proveedor_pago")
    .eq("id", id)
    .eq("sucursal_id", SUCURSAL_ID)
    .limit(1);

  const pedido = Array.isArray(data) ? data[0] : undefined;
  if (!pedido) return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });

  if (pedido.proveedor_pago !== "mercadopago" || !pedido.mp_order_id) {
    return NextResponse.json(
      { ok: false, error: "Ese pedido no se cobró por Mercado Pago; no hay nada que devolver" },
      { status: 400 },
    );
  }
  if (pedido.estado_pago !== "aprobado") {
    return NextResponse.json(
      { ok: false, error: `No se puede devolver un pago en estado "${pedido.estado_pago}"` },
      { status: 400 },
    );
  }
  if (montoPedido !== null && montoPedido > Number(pedido.total)) {
    return NextResponse.json(
      { ok: false, error: "La devolución no puede superar el total del pedido" },
      { status: 400 },
    );
  }

  const esParcial = montoPedido !== null && montoPedido < Number(pedido.total);
  if (esParcial && !pedido.id_pago) {
    return NextResponse.json(
      { ok: false, error: "Falta el id de pago para hacer una devolución parcial" },
      { status: 400 },
    );
  }

  try {
    const orden = await refundOrder(
      String(pedido.mp_order_id),
      esParcial ? { transactionId: String(pedido.id_pago), amount: montoPedido } : undefined,
    );

    const estadoPago = mapOrderStatus(orden.status, orden.status_detail);

    await db.database.from("pedidos").update({ estado_pago: estadoPago }).eq("id", id);
    await registrarEvento({
      pedidoId: id,
      tipo: "pago",
      valor: estadoPago,
      origen: "panel",
      detalle: {
        accion: esParcial ? "devolucion_parcial" : "devolucion_total",
        monto: esParcial ? montoPedido : Number(pedido.total),
        mp_status: orden.status,
        mp_status_detail: orden.status_detail,
      },
    });

    return NextResponse.json({ ok: true, estadoPago, parcial: esParcial });
  } catch (err: unknown) {
    const detalle = (err as { body?: { errors?: { message?: string }[] } }).body;
    const motivo = detalle?.errors?.[0]?.message
      || (err instanceof Error ? err.message : "No se pudo procesar la devolución");

    await registrarEvento({
      pedidoId: id,
      tipo: "pago",
      valor: "fallo_devolucion",
      origen: "panel",
      detalle: { motivo, monto: montoPedido },
    });

    return NextResponse.json({ ok: false, error: motivo }, { status: 400 });
  }
}
