import { NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";
import { getCatalogData } from "@/lib/catalog";
import { publicSaleProducts } from "@/lib/catalog-source";
import { PricingUnavailableError, requirePricingRows } from "@/lib/pricing-safety";
import type { DatabaseProduct } from "@/lib/catalog-build";

export async function GET() {
  try {
    // También es un endpoint público: no puede divulgar precios guardados que
    // el catálogo/checkout considera inseguros. Conservamos los campos de cada fila.
    const catalog = await getCatalogData();
    const result = await db.database.from("productos").select("*")
      .eq("proyecto_id", "impasto")
      .in("categoria", [...CATEGORIAS_IMPASTO]);
    const products = requirePricingRows<DatabaseProduct & { archivado?: boolean }>("productos", result);
    return NextResponse.json({ ok: true, data: publicSaleProducts(products, catalog) });
  } catch (error) {
    if (error instanceof PricingUnavailableError) {
      console.error(`[api/productos] fuente crítica ${error.source} no disponible`);
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    console.error("[api/productos] error:", error);
    return NextResponse.json({ ok: false, error: "No se pudieron cargar los productos" }, { status: 500 });
  }
}
