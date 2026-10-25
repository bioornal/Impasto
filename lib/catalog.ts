import { readPages } from "@/lib/read-pages";
import { db } from "@/lib/insforge";
import type { CatalogData } from "@/types";
import { SUCURSAL_ID } from "@/lib/business";
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";
import { assembleCatalogFromResults, settleCatalogQuery } from "@/lib/catalog-source";
import { PricingUnavailableError } from "@/lib/pricing-safety";
import { agregarFotos } from "@/lib/fotos";
import { listarFotos } from "@/lib/fotos-bucket";
import { conservarCosteo } from "@/lib/catalog-costeo";
import { aplicarCupos, type FilaCupo } from "@/lib/cupos";
import { aplicarMasas, quedanMasas, type FilaMasas } from "@/lib/masas-noche";
import { diaDeNegocio } from "@/lib/resumen-diario";

export async function getCatalogData(): Promise<CatalogData> {
  try {
    const fotos = listarFotos(); // en paralelo con la base; nunca falla
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
      cuposResult,
      masasResult,
    ] = await Promise.all([
      // `archivado` es la baja de carta: el producto sigue en la base (y en el
      // recetario, para costos históricos) pero no se muestra más al cliente.
      // Distinto de `disponible`, que es faltante temporal y se muestra agotado.
      readPages((start, end) => db.database.from("productos").select("id,nombre,tipo,categoria,precio,disponible,desc,tags,popular")
        .eq("proyecto_id", "impasto")
        .not("archivado", "is", true)
        .in("categoria", [...CATEGORIAS_IMPASTO]).order("id", { ascending: true }).range(start, end)),
      readPages((start, end) => db.database.from("promociones").select("*").eq("activo", true).eq("sucursal_id", SUCURSAL_ID).order("id", { ascending: true }).range(start, end)),
      // Aprobar = publicar: la home muestra las 6 aprobadas más recientes.
      safeQuery(db.database.from("testimonios").select("nombre,texto,rating,producto").eq("estado", "aprobado").eq("sucursal_id", SUCURSAL_ID)
        .order("created_at", { ascending: false }).limit(6)),
      readPages((start, end) => db.database.from("etiquetas").select("*").eq("sucursal_id", SUCURSAL_ID).order("orden").order("id", { ascending: true }).range(start, end)),
      readPages((start, end) => db.database.from("recetas").select("id,nombre,precio_prepizza,precio_salsa,rend_tipo,rend_valor").order("id", { ascending: true }).range(start, end)),
      readPages((start, end) => db.database.from("receta_ingredientes").select("id,receta_id,ingrediente_id,cantidad_kg").order("id", { ascending: true }).range(start, end)),
      readPages((start, end) => db.database.from("ingredientes").select("id,nombre,unidad,precio_kg,multiplo_rendimiento,gramos_por_unidad").order("id", { ascending: true }).range(start, end)),
      readPages((start, end) => db.database.from("precios_venta").select("id,receta_id,nombre,markup,subcategoria").order("id", { ascending: true }).range(start, end)),
      safeQuery(db.database.from("config_negocio").select("pizzas_objetivo_mes,precio_prepizza_default,precio_salsa_default,comision_tarjeta_pct,comision_en_precio").limit(1)),
      readPages((start, end) => db.database.from("costos_fijos").select("id,monto,activo").eq("activo", true).order("id", { ascending: true }).range(start, end)),
      readPages((start, end) => db.database.from("costos_variables").select("id,monto_referencia").order("id", { ascending: true }).range(start, end)),
      safeQuery(db.database.from("cupos_noche").select("producto_id,cupo_mitades,vendidas_mitades")
        .eq("proyecto_id", "impasto").eq("noche", diaDeNegocio(new Date().toISOString()))),
      safeQuery(db.database.from("masas_noche").select("cupo,vendidas")
        .eq("proyecto_id", "impasto").eq("noche", diaDeNegocio(new Date().toISOString())).limit(1)),
    ]);
    for (const [source, result] of [
      ["promociones", promosResult], ["testimonios", reviewsResult], ["etiquetas", etiquetasResult],
    ] as const) {
      if (result.error) console.error(`[catalog] fuente decorativa ${source}:`, result.error);
    }
    const catalogo = assembleCatalogFromResults({
      productos: productsResult, promociones: promosResult, testimonios: reviewsResult, etiquetas: etiquetasResult,
      recetas: recipesResult, receta_ingredientes: recipeIngredientsResult, ingredientes: ingredientsResult,
      precios_venta: salePricesResult, config_negocio: defaultsResult, costos_fijos: costosFijosResult,
      costos_variables: costosVariablesResult,
    });
    if (cuposResult.error) console.error("[catalog] cupos de la noche:", cuposResult.error);
    const cupos = Array.isArray(cuposResult.data) && !cuposResult.error ? cuposResult.data as FilaCupo[] : [];
    // Masas de la noche (24/10/2026): como los cupos, no crítico; si falla la lectura, sin límite (la base igual controla).
    if (masasResult.error) console.error("[catalog] masas de la noche:", masasResult.error);
    const masas = Array.isArray(masasResult.data) && !masasResult.error ? masasResult.data[0] as FilaMasas | undefined : undefined;
    // La foto más nueva de cada producto en el bucket; si el listado falla, viene vacío
    // y las ilustraciones usan el respaldo de siempre.
    // agregarFotos devuelve una copia: sin conservar el costeo, la cotización de cualquier
    // pedido fallaba con "Costeo de la venta no disponible" (03/10 al 06/10/2026).
    return conservarCosteo(catalogo, aplicarMasas(aplicarCupos(agregarFotos(catalogo, await fotos), cupos), quedanMasas(masas)));
  } catch (error) {
    if (error instanceof PricingUnavailableError) console.error(`[catalog] fuente crítica ${error.source} no disponible`);
    else console.error("[catalog] fallo al armar el catálogo:", error);
    throw error;
  }
}
