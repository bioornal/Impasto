import { db } from "@/lib/insforge";
import type { CatalogData } from "@/types";
import { SUCURSAL_ID } from "@/lib/business";
import { buildCatalog, type DatabaseProduct } from "@/lib/catalog-build";
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";

export async function getCatalogData(): Promise<CatalogData> {
  try {
    const safeQuery = (query: PromiseLike<{ data?: unknown; error?: unknown }>) =>
      Promise.resolve(query).catch((error) => ({ data: null, error }));
    const [productsResult, promosResult, reviewsResult] = await Promise.all([
      safeQuery(db.database.from("productos").select("*")
        .not("disponible", "is", false)
        .in("categoria", [...CATEGORIAS_IMPASTO])),
      safeQuery(db.database.from("promociones").select("*").eq("activo", true).eq("sucursal_id", SUCURSAL_ID)),
      safeQuery(db.database.from("testimonios").select("*").eq("estado", "aprobado").eq("sucursal_id", SUCURSAL_ID)),
    ]);
    if (productsResult.error) console.error("[catalog] error al consultar productos:", productsResult.error);
    const products = Array.isArray(productsResult.data) ? productsResult.data as DatabaseProduct[] : [];
    return buildCatalog(products, promosResult.data, reviewsResult.data);
  } catch {
    return buildCatalog([], null, null);
  }
}
