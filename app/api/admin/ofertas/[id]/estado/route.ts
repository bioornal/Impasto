import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { COLUMNAS_OFERTAS, productosParaOfertas } from "@/lib/ofertas-admin";
import { cambioEstadoOferta, margenOferta, type Oferta } from "@/lib/promos";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params, body = await req.json().catch(() => null);
    const accion: unknown = body?.accion;
    if (!["aprobar", "pausar", "reanudar"].includes(String(accion))) return NextResponse.json({ ok: false, error: "Elegí aprobar, pausar o reanudar." }, { status: 400 });
    const { data, error } = await db.database.from("ofertas").select(COLUMNAS_OFERTAS).eq("id", id).eq("proyecto_id", "impasto").limit(1);
    if (error) throw error;
    const oferta = data?.[0] as Oferta | undefined;
    if (!oferta) return NextResponse.json({ ok: false, error: "No encontramos esa promoción." }, { status: 404 });
    const estado = cambioEstadoOferta(oferta.estado, accion);
    if (!estado) return NextResponse.json({ ok: false, error: "Esa acción no corresponde al estado actual. Recargá la lista." }, { status: 400 });
    if (estado === "aprobada") {
      const { productos, comisionPct } = await productosParaOfertas(), margen = margenOferta(oferta, productos, comisionPct);
      if (margen.semaforo === "rojo") return NextResponse.json({ ok: false, error: margen.errores.join(" ") || "No podés aprobar una promo si algún caso deja cero o pérdida." }, { status: 400 });
    }
    const ahora = new Date().toISOString();
    const { data: updated, error: updateError } = await db.database.from("ofertas").update({ estado, actualizada_en: ahora, ...(estado === "aprobada" ? { aprobada_en: ahora } : {}) })
      .eq("id", id).eq("proyecto_id", "impasto").eq("estado", oferta.estado).eq("actualizada_en", oferta.actualizada_en).select("id");
    if (updateError) throw updateError;
    if (!updated?.length) return NextResponse.json({ ok: false, error: "La promoción cambió mientras la revisabas. Recargá la lista." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ofertas] estado", error);
    return NextResponse.json({ ok: false, error: "No se pudo cambiar el estado. Reintentá." }, { status: 500 });
  }
}
