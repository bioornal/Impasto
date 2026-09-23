import { db } from "@/lib/insforge";
import type { CatalogData } from "@/types";
import { SUCURSAL_ID } from "@/lib/business";
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";
import { assembleCatalogFromResults, settleCatalogQuery } from "@/lib/catalog-source";
import { PricingUnavailableError } from "@/lib/pricing-safety";

export async function getCatalogData(): Promise<CatalogData> {
  try {
    const safeQuery = settleCatalogQuery;
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
      // `archivado` es la baja de carta: el producto sigue en la base (y en el
      // recetario, para costos históricos) pero no se muestra más al cliente.
      // Distinto de `disponible`, que es faltante temporal y se muestra agotado.
      safeQuery(db.database.from("productos").select("id,nombre,tipo,categoria,precio,disponible,desc,tags,popular")
        .eq("proyecto_id", "impasto")
        .not("archivado", "is", true)
        .in("categoria", [...CATEGORIAS_IMPASTO])),
      safeQuery(db.database.from("promociones").select("*").eq("activo", true).eq("sucursal_id", SUCURSAL_ID)),
      safeQuery(db.database.from("testimonios").select("*").eq("estado", "aprobado").eq("sucursal_id", SUCURSAL_ID)),
      safeQuery(db.database.from("etiquetas").select("*").eq("sucursal_id", SUCURSAL_ID).order("orden")),
      safeQuery(db.database.from("recetas").select("id,nombre,precio_prepizza,precio_salsa")),
      safeQuery(db.database.from("receta_ingredientes").select("receta_id,ingrediente_id,cantidad_kg")),
      safeQuery(db.database.from("ingredientes").select("id,precio_kg,multiplo_rendimiento")),
      safeQuery(db.database.from("precios_venta").select("receta_id,nombre,markup,subcategoria")),
      safeQuery(db.database.from("config_negocio").select("pizzas_objetivo_mes,precio_prepizza_default,precio_salsa_default,comision_tarjeta_pct,comision_en_precio").limit(1)),
      safeQuery(db.database.from("costos_fijos").select("monto").eq("activo", true)),
      safeQuery(db.database.from("costos_variables").select("monto_referencia")),
      safeQuery(db.database.from("gastos").select("monto")),
    ]);
    for (const [source, result] of [
      ["promociones", promosResult], ["testimonios", reviewsResult], ["etiquetas", etiquetasResult],
    ] as const) {
      if (result.error) console.error(`[catalog] fuente decorativa ${source}:`, result.error);
    }
    return assembleCatalogFromResults({
      productos: productsResult, promociones: promosResult, testimonios: reviewsResult, etiquetas: etiquetasResult,
      recetas: recipesResult, receta_ingredientes: recipeIngredientsResult, ingredientes: ingredientsResult,
      precios_venta: salePricesResult, config_negocio: defaultsResult, costos_fijos: costosFijosResult,
      costos_variables: costosVariablesResult, gastos: gastosResult,
    });
  } catch (error) {
    if (error instanceof PricingUnavailableError) console.error(`[catalog] fuente crítica ${error.source} no disponible`);
    else console.error("[catalog] fallo al armar el catálogo:", error);
    throw error;
  }
}
