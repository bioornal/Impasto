import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { readPages } from "@/lib/read-pages";
import { camposOferta, COLUMNAS_OFERTAS, contextoNegocio, productosParaOfertas } from "@/lib/ofertas-admin";
import { analisisOferta, margenOferta, validarOferta, type Oferta, type OfertaInput } from "@/lib/promos";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const [{ data, error }, { productos, comisionPct }, contexto] = await Promise.all([
      readPages((start, end) => db.database.from("ofertas").select(COLUMNAS_OFERTAS).eq("proyecto_id", "impasto").order("orden").order("id", { ascending: true }).range(start, end)),
      productosParaOfertas(),
      contextoNegocio(),
    ]);
    if (error) throw error;
    return NextResponse.json({ ok: true, data: (data as Oferta[]).map(o => ({ ...o, margen: margenOferta(o, productos, comisionPct), analisis: analisisOferta(o, productos, contexto) })), productos, comisionPct, contexto });
  } catch (error) {
    console.error("[ofertas] lectura", error);
    return NextResponse.json({ ok: false, error: "No se pudieron cargar las promociones y sus costos. Reintentá." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const body = await req.json().catch(() => null), { productos } = await productosParaOfertas();
    const errores = validarOferta(body, productos);
    if (errores.length) return NextResponse.json({ ok: false, error: errores.join(" ") }, { status: 400 });
    const { data, error } = await db.database.from("ofertas").insert([{ ...camposOferta(body as OfertaInput), proyecto_id: "impasto", estado: "pendiente" }]).select(COLUMNAS_OFERTAS);
    if (error) throw error;
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    console.error("[ofertas] alta", error);
    return NextResponse.json({ ok: false, error: "No se pudo guardar la promoción. Reintentá." }, { status: 500 });
  }
}
