import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { camposOferta, COLUMNAS_OFERTAS, productosParaOfertas } from "@/lib/ofertas-admin";
import { validarOferta, type OfertaInput } from "@/lib/promos";

type Contexto = { params: Promise<{ id: string }> };
export async function PUT(req: NextRequest, { params }: Contexto) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params, body = await req.json().catch(() => null), { productos } = await productosParaOfertas();
    const errores = validarOferta(body, productos);
    if (errores.length) return NextResponse.json({ ok: false, error: errores.join(" ") }, { status: 400 });
    const version: unknown = body.actualizada_en;
    if (typeof version !== "string" || !Number.isFinite(Date.parse(version))) return NextResponse.json({ ok: false, error: "Falta la versión de la promoción. Recargá la lista." }, { status: 400 });
    const { data: existente, error: readError } = await db.database.from("ofertas").select("id").eq("id", id).eq("proyecto_id", "impasto").limit(1);
    if (readError) throw readError;
    if (!existente?.length) return NextResponse.json({ ok: false, error: "No encontramos esa promoción." }, { status: 404 });
    const { data, error } = await db.database.from("ofertas").update({ ...camposOferta(body as OfertaInput), actualizada_en: new Date(Math.max(Date.now(), Date.parse(version) + 1)).toISOString() })
      .eq("id", id).eq("proyecto_id", "impasto").eq("actualizada_en", version).select(COLUMNAS_OFERTAS);
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ ok: false, error: "La promoción cambió mientras la editabas. Cerrá el editor y recargá la lista." }, { status: 409 });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[ofertas] edición", error);
    return NextResponse.json({ ok: false, error: "No se pudo editar la promoción. Reintentá." }, { status: 500 });
  }
}
export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    const { data, error } = await db.database.from("ofertas").delete().eq("id", id).eq("proyecto_id", "impasto").select("id");
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ ok: false, error: "No encontramos esa promoción." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ofertas] eliminación", error);
    return NextResponse.json({ ok: false, error: "No se pudo eliminar la promoción. Reintentá." }, { status: 500 });
  }
}
