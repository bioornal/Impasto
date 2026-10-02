import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-auth";
import { registrarEvento } from "@/lib/orders";
import { refundReservedOperation, getOrder } from "@/lib/mercadopago";
import { completeRefundOperation, reconcileRefundOnly, refundAuditAmount } from "@/lib/refund-completion";
import { reconcilePayment } from '@/lib/payment-recovery-server';
import { PAYMENT_COLUMNS, paymentRecoveryStore } from '@/lib/payment-recovery-store';
import type { RecoveryPedido } from '@/lib/payment-recovery';
import { pesosACentavos } from '@/lib/payment-ledger';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const operationId = body.operationId;
  if(operationId!==undefined && (typeof operationId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(operationId)))return NextResponse.json({ok:false,error:'Identificador de operación inválido'},{status:400});
  const montoPedido = body.amount === undefined ? null : Number(body.amount);

  if (montoPedido !== null && (!Number.isFinite(montoPedido) || montoPedido <= 0)) {
    return NextResponse.json({ ok: false, error: "Monto de devolución inválido" }, { status: 400 });
  }

  const { data, error: lookupError } = await db.database
    .from("pedidos")
    .select(PAYMENT_COLUMNS)
    .eq("id", id)
    .eq("sucursal_id", SUCURSAL_ID)
    .eq("proyecto_id", "impasto")
    .limit(1);

  if (lookupError) return NextResponse.json({ ok: false, error: "No se pudo consultar el pedido" }, { status: 503 });

  const pedido = Array.isArray(data) ? data[0] : undefined;
  if (!pedido) return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });

  if (pedido.proveedor_pago !== "mercadopago" || pedido.metodo_pago !== "mercadopago" || !pedido.mp_order_id) {
    return NextResponse.json(
      { ok: false, error: "Ese pedido no se cobró por Mercado Pago; no hay nada que devolver" },
      { status: 400 },
    );
  }
  if (!["aprobado", "parcialmente_reembolsado", "reembolsado"].includes(String(pedido.estado_pago))) {
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

  const esParcial = montoPedido !== null;
  if (esParcial && !pedido.id_pago) {
    return NextResponse.json(
      { ok: false, error: "Falta el id de pago para hacer una devolución parcial" },
      { status: 400 },
    );
  }

  try {
    if(montoPedido !== null)pesosACentavos(body.amount);
    const store=paymentRecoveryStore(db,id);
    const baseActions={
      pedido: pedido as unknown as RecoveryPedido,
      current: () => getOrder(String(pedido.mp_order_id)),
      persist: async (orden:Awaited<ReturnType<typeof getOrder>>) => { await reconcilePayment(pedido as unknown as RecoveryPedido,orden); },
    };
    const result = operationId ? await completeRefundOperation({
      ...baseActions,
      reserve: () => store.reservarOperacion(String(pedido.mp_order_id),operationId,esParcial
        ? {transaction_id:String(pedido.id_pago),amount_centavos:pesosACentavos(body.amount)} : {total:true}),
      refund: intent => refundReservedOperation(String(pedido.mp_order_id),intent.request,intent.key),
      confirm: (intent,orden) => store.confirmarOperacion(pedido as unknown as RecoveryPedido,intent,orden),
    }) : await reconcileRefundOnly(baseActions);
    const { order: orden, estadoPago, recovered, persistencePending } = result;
    // Failure of the local audit trail must not claim that MP failed to return money.
    try { await registrarEvento({
      pedidoId: id,
      tipo: "pago",
      valor: estadoPago,
      origen: "panel",
      detalle: {
        accion: recovered ? "conciliacion_devolucion" : esParcial ? "devolucion_parcial" : "devolucion_total",
        ...refundAuditAmount(result),
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
      ...(operationId ? { operationId } : {}),
      estadoPago,
      parcial: estadoPago === "parcialmente_reembolsado",
      totales: result.totales,
      ...(persistencePending ? { error: "Mercado Pago confirmó una devolución, pero falta conciliar el estado y los importes locales. No hagas otra devolución: reintentá para conciliar o revisá Mercado Pago." } : {}),
    }, { status: persistencePending ? 202 : 200 });
  } catch (err: unknown) {
    const detalle = (err as { body?: { errors?: { message?: string }[] } }).body;
    const motivo = detalle?.errors?.[0]?.message
      || (err instanceof Error ? err.message : "No se pudo procesar la devolución");

    try { await registrarEvento({
      pedidoId: id,
      tipo: "pago",
      valor: "fallo_devolucion",
      origen: "panel",
      detalle: { motivo, monto: montoPedido },
    }); } catch { /* preserve provider error */ }

    return NextResponse.json({ ok: false, error: motivo }, { status: 400 });
  }
}
