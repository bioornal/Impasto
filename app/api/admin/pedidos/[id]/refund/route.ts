import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-auth";
import { registrarEvento } from "@/lib/orders";
import { refundOrder, getOrder, mapOrderStatus } from "@/lib/mercadopago";
import { completeRefund } from "@/lib/refund-completion";
import { requireUpdatedRow } from "@/lib/db-result";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const montoPedido = body.amount === undefined ? null : Number(body.amount);

  if (montoPedido !== null && (!Number.isFinite(montoPedido) || montoPedido <= 0)) {
    return NextResponse.json({ ok: false, error: "Monto de devolución inválido" }, { status: 400 });
  }

  const { data, error: lookupError } = await db.database
    .from("pedidos")
    .select("id,total,estado_pago,mp_order_id,id_pago,proveedor_pago")
    .eq("id", id)
    .eq("sucursal_id", SUCURSAL_ID)
    .eq("proyecto_id", "impasto")
    .limit(1);

  if (lookupError) return NextResponse.json({ ok: false, error: "No se pudo consultar el pedido" }, { status: 503 });

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
    const result = await completeRefund({
      current: () => getOrder(String(pedido.mp_order_id)),
      refund: () => refundOrder(String(pedido.mp_order_id), esParcial ? { transactionId: String(pedido.id_pago), amount: montoPedido! } : undefined),
      persist: async orden => {
        const persisted = await db.database.from("pedidos")
          .update({ estado_pago: mapOrderStatus(orden.status, orden.status_detail) })
          .eq("id", id).eq("sucursal_id", SUCURSAL_ID).eq("proyecto_id", "impasto")
          .select("id,estado_pago");
        requireUpdatedRow(persisted as { data: { id: string; estado_pago: string }[] | null; error: unknown }, "guardar la devolución");
      },
    });
    const { order: orden, estadoPago, recovered, persistencePending } = result;
    // Failure of the local audit trail must not claim that MP failed to return money.
    try { await registrarEvento({
      pedidoId: id,
      tipo: "pago",
      valor: estadoPago,
      origen: "panel",
      detalle: {
        accion: recovered ? "conciliacion_devolucion" : esParcial ? "devolucion_parcial" : "devolucion_total",
        ...(recovered ? {} : { monto: esParcial ? montoPedido : Number(pedido.total) }),
        persistencia_pendiente: persistencePending,
        mp_status: orden.status,
        mp_status_detail: orden.status_detail,
      },
    }); } catch { /* money movement is already confirmed by MP */ }

    return NextResponse.json({
      ok: !persistencePending,
      refundCompleted: true,
      persistencePending,
      recovered,
      estadoPago,
      parcial: orden.status_detail === "partially_refunded",
      ...(persistencePending ? { error: "Mercado Pago confirmó una devolución, pero falta guardar el estado local. No hagas otra devolución: reintentá para conciliar o revisá Mercado Pago." } : {}),
    }, { status: persistencePending ? 202 : 200 });
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
