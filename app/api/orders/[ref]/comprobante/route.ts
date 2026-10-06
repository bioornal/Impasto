import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { esReferenciaValida, normalizarReferencia } from "@/lib/referencia";
import { limitar } from "@/lib/rate-limit";
import { avisoComprobante, claveDeComprobante, puedeSubirComprobante, validarComprobante } from "@/lib/comprobante";
import { subirComprobante } from "@/lib/comprobantes-bucket";
import { registrarEvento } from "@/lib/orders";
import { sendTelegram } from "@/lib/telegram";
import { datosDesdePedido } from "@/lib/cuentas-transferencia";
import { fmt } from "@/lib/utils";

export const dynamic = "force-dynamic";

const error = (mensaje: string, status: number) => NextResponse.json({ ok: false, error: mensaje }, { status });

/**
 * El cliente sube el comprobante de su transferencia. Pública: la protege la
 * referencia (sufijo aleatorio), el límite por IP y que solo acepta pedidos por
 * transferencia todavía sin acreditar. No acredita nada: eso lo hace el local.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const referencia = normalizarReferencia(ref);
  if (!esReferenciaValida(referencia)) return error("Referencia de pedido inválida", 400);

  const limitado = await limitar(req, "comprobante");
  if (limitado) return limitado;

  let archivo: FormDataEntryValue | null;
  try { archivo = (await req.formData()).get("comprobante"); } catch { return error("Elegí el comprobante.", 400); }
  if (!(archivo instanceof Blob)) return error("Elegí el comprobante.", 400);
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const validacion = validarComprobante(bytes, archivo.size);
  if (!validacion.ok) return error(validacion.error, validacion.status);

  const { data, error: errorLectura } = await db.database
    .from("pedidos")
    .select("id, external_reference, nombre_cliente, total, metodo_pago, estado_pago, status, cuenta_transferencia")
    .eq("external_reference", referencia)
    .eq("proyecto_id", "impasto")
    .eq("sucursal_id", SUCURSAL_ID)
    .limit(1);
  if (errorLectura) return error("No se pudo consultar el pedido.", 500);
  const pedido = Array.isArray(data) ? data[0] : null;
  if (!pedido) return error("Pedido no encontrado", 404);
  if (!puedeSubirComprobante(pedido)) {
    return error("Este pedido ya no necesita comprobante.", 409);
  }

  const ahora = new Date();
  const clave = claveDeComprobante(String(pedido.id), ahora, validacion.tipo.ext);
  try {
    await subirComprobante(clave, bytes, validacion.tipo.mime);
  } catch (errorSubida) {
    console.error("[comprobante] No se pudo subir:", errorSubida);
    return error("No se pudo subir el comprobante. Probá de nuevo.", 502);
  }

  const actualizado = await db.database
    .from("pedidos")
    .update({ comprobante_clave: clave, comprobante_tipo: validacion.tipo.mime, comprobante_subido_at: ahora.toISOString() })
    .eq("id", String(pedido.id))
    .eq("proyecto_id", "impasto")
    .eq("estado_pago", String(pedido.estado_pago || "pendiente"))
    .select("id");
  if (actualizado.error || !Array.isArray(actualizado.data) || actualizado.data.length !== 1) {
    return error("No se pudo registrar el comprobante. Probá de nuevo.", 500);
  }

  // El rastro y el aviso son secundarios: el comprobante ya quedó guardado.
  try { await registrarEvento({ pedidoId: String(pedido.id), tipo: "comprobante", valor: "subido", origen: "checkout", detalle: { tipo: validacion.tipo.mime } }); } catch {}
  try {
    await sendTelegram(avisoComprobante(
      String(pedido.external_reference),
      String(pedido.nombre_cliente || ""),
      fmt(Number(pedido.total || 0)),
      datosDesdePedido(pedido.cuenta_transferencia)?.nombre,
    ));
  } catch {}

  return NextResponse.json({ ok: true, subidoAt: ahora.toISOString() });
}
