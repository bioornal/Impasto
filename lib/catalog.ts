import { db } from "@/lib/insforge";
import type { CatalogData } from "@/types";
import { SUCURSAL_ID } from "@/lib/business";
import { buildCatalog, type DatabaseProduct } from "@/lib/catalog-build";
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";
import type { Etiqueta } from "@/lib/etiquetas";
import { buildEffectivePrices } from "@/lib/effective-prices";

export async function getCatalogData(): Promise<CatalogData> {
  try {
    const safeQuery = (query: PromiseLike<{ data?: unknown; error?: unknown }>) =>
      Promise.resolve(query).catch((error) => ({ data: null, error }));
    const [
      productsResult,
      promosResult,
      reviewsResult,
      etiquetasResult,
      recipesResult,
      recipeIngredientsResult,
      ingredientsResult,
      salePricesResult,
      defaultsResult,
      costosFijosResult,
      costosVariablesResult,
      gastosResult,
    ] = await Promise.all([
      safeQuery(db.database.from("productos").select("id,nombre,tipo,categoria,precio,disponible,desc,tags,popular")
        .not("disponible", "is", false)
        .in("categoria", [...CATEGORIAS_IMPASTO])),
      safeQuery(db.database.from("promociones").select("*").eq("activo", true).eq("sucursal_id", SUCURSAL_ID)),
      safeQuery(db.database.from("testimonios").select("*").eq("estado", "aprobado").eq("sucursal_id", SUCURSAL_ID)),
      safeQuery(db.database.from("etiquetas").select("*").eq("sucursal_id", SUCURSAL_ID).order("orden")),
      safeQuery(db.database.from("recetas").select("id,nombre,precio_prepizza,precio_salsa")),
      safeQuery(db.database.from("receta_ingredientes").select("receta_id,ingrediente_id,cantidad_kg")),
      safeQuery(db.database.from("ingredientes").select("id,precio_kg,multiplo_rendimiento")),
      safeQuery(db.database.from("precios_venta").select("receta_id,nombre,markup,subcategoria")),
      safeQuery(db.database.from("config_negocio").select("pizzas_objetivo_mes,precio_prepizza_default,precio_salsa_default").limit(1)),
      safeQuery(db.database.from("costos_fijos").select("monto").eq("activo", true)),
      safeQuery(db.database.from("costos_variables").select("monto_referencia")),
      safeQuery(db.database.from("gastos").select("monto")),
    ]);
    if (productsResult.error) console.error("[catalog] error al consultar productos:", productsResult.error);
    const products = Array.isArray(productsResult.data) ? productsResult.data as DatabaseProduct[] : [];

    const totalFijos = Array.isArray(costosFijosResult.data)
      ? costosFijosResult.data.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.monto ?? 0), 0)
      : 0;
    const totalVariables = Array.isArray(costosVariablesResult.data)
      ? costosVariablesResult.data.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.monto_referencia ?? 0), 0)
      : 0;
    const totalGastos = Array.isArray(gastosResult.data)
      ? gastosResult.data.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.monto ?? 0), 0)
      : 0;
    const totalOperativo = totalFijos + totalVariables + totalGastos;

    const effectivePrices = buildEffectivePrices(
      Array.isArray(recipesResult.data) ? recipesResult.data : [],
      Array.isArray(recipeIngredientsResult.data) ? recipeIngredientsResult.data : [],
      Array.isArray(ingredientsResult.data) ? ingredientsResult.data : [],
      Array.isArray(salePricesResult.data) ? salePricesResult.data : [],
      Array.isArray(defaultsResult.data) && defaultsResult.data[0] ? defaultsResult.data[0] : undefined,
      totalOperativo,
    );
    const productsWithEffectivePrices = products.map((product) => {
      const price = product.nombre ? effectivePrices.get(product.nombre) : undefined;
      return price == null ? product : { ...product, precio: price };
    });
    if (etiquetasResult.error) console.error("[catalog] error al consultar etiquetas:", etiquetasResult.error);
    const etiquetas = Array.isArray(etiquetasResult.data) ? etiquetasResult.data as Etiqueta[] : [];
    return buildCatalog(productsWithEffectivePrices, promosResult.data, reviewsResult.data, etiquetas);
  } catch {
    return buildCatalog([], null, null);
  }
}
