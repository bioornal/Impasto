import { db } from "@/lib/insforge";
import type { CatalogData } from "@/types";
import { SUCURSAL_ID } from "@/lib/business";
import { buildCatalog, type DatabaseProduct } from "@/lib/catalog-build";

export { buildCatalog, type DatabaseProduct };

export async function getCatalogData(): Promise<CatalogData> {
  try {
    const safeQuery = (query: PromiseLike<{ data?: unknown }>) => Promise.resolve(query).catch(() => ({ data: null }));
    const [productsResult, promosResult, reviewsResult] = await Promise.all([
      safeQuery(db.database.from("productos").select("*")),
      safeQuery(db.database.from("promociones").select("*").eq("activo", true).eq("sucursal_id", SUCURSAL_ID)),
      safeQuery(db.database.from("testimonios").select("*").eq("estado", "aprobado").eq("sucursal_id", SUCURSAL_ID)),
    ]);
    const products = Array.isArray(productsResult.data) ? productsResult.data as DatabaseProduct[] : [];
    return buildCatalog(products, promosResult.data, reviewsResult.data);
  } catch {
    return buildCatalog([], null, null);
  }
}
