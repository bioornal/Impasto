import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-auth";
import { idValido } from "@/lib/foto-subida";
import { MAXIMO_POR_VEZ, motivoNoEliminable } from "@/lib/eliminar-pedidos";
import { borrarComprobante } from "@/lib/comprobantes-bucket";

export const dynamic = "force-dynamic";

const falla = (mensaje: string, status: number) => NextResponse.json({ ok: false, error: mensaje }, { status });

/**
 * Elimina pedidos (típicamente de prueba) desde el panel. Irreversible. Los que no se
 * pueden eliminar se devuelven en `bloqueados` con el motivo; el resto se elimina.
 */
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let ids: unknown;
  try { ids = (await req.json())?.ids; } catch { return falla("JSON inválido", 400); }
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string" || !idValido(id))) {
    return falla("Elegí al menos un pedido.", 400);
  }
  const unicos = [...new Set(ids as string[])];
  if (unicos.length > MAXIMO_POR_VEZ) return falla(`Máximo ${MAXIMO_POR_VEZ} pedidos por vez.`, 400);

  const { data, error } = await db.database
    .from("pedidos")
    .select("id, external_reference, numero_pedido, metodo_pago, estado_pago, comprobante_clave")
    .in("id", unicos)
    .eq("proyecto_id", "impasto")
    .eq("sucursal_id", SUCURSAL_ID);
  if (error || !Array.isArray(data)) return falla("No se pudieron leer los pedidos.", 500);

  const [costeos, movimientos] = await Promise.all([
    db.database.from("pedido_costeos").select("pedido_id").in("pedido_id", unicos),
    db.database.from("pedido_movimientos").select("pedido_id").in("pedido_id", unicos),
  ]);
  if (costeos.error || movimientos.error) return falla("No se pudo verificar el registro contable.", 500);
  const conRegistro = new Set<string>([
    ...(costeos.data ?? []).map((r: { pedido_id: string }) => r.pedido_id),
    ...(movimientos.data ?? []).map((r: { pedido_id: string }) => r.pedido_id),
  ]);

  const eliminables: typeof data = [];
  const bloqueados: { id: string; pedido: string; motivo: string }[] = [];
  for (const pedido of data) {
    const motivo = motivoNoEliminable(pedido, conRegistro.has(String(pedido.id)));
    const nombre = String(pedido.external_reference || `#${pedido.numero_pedido}`);
    if (motivo) bloqueados.push({ id: String(pedido.id), pedido: nombre, motivo });
    else eliminables.push(pedido);
  }

  let eliminados = 0;
  if (eliminables.length > 0) {
    const { data: n, error: errorBorrado } = await db.database.rpc("eliminar_pedidos_impasto", { p_ids: eliminables.map((p) => String(p.id)) });
    if (errorBorrado) {
      console.error("[eliminar-pedidos]", errorBorrado);
      return falla("No se pudieron eliminar los pedidos. No se borró nada.", 500);
    }
    eliminados = Number(n) || 0;
    // Los comprobantes subidos por los clientes: si falla, queda un archivo suelto, no un pedido.
    await Promise.allSettled(eliminables.filter((p) => p.comprobante_clave).map((p) => borrarComprobante(String(p.comprobante_clave))));
  }

  return NextResponse.json({ ok: true, eliminados, ids: eliminables.map((p) => String(p.id)), bloqueados });
}
