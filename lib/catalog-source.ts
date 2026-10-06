import { buildCatalog, type DatabaseProduct } from "./catalog-build";
import type { Etiqueta } from "./etiquetas";
import type { CatalogData } from "../types";
import type { PricingDefaults, PricingIngredient, PricingRecipe, RecipeIngredient, SalePriceRule } from "./effective-prices";
import { PricingUnavailableError, requirePricingRows, resolveValidatedPrices, sellablePrice } from "./pricing-safety";
import {presupuestoMensual} from './presupuesto-precios';
import {rememberCatalogCosteo} from './catalog-costeo';

type QueryResult = { data?: unknown; error?: unknown };

export interface CatalogQueryResults {
  productos: QueryResult;
  promociones: QueryResult;
  testimonios: QueryResult;
  etiquetas: QueryResult;
  recetas: QueryResult;
  receta_ingredientes: QueryResult;
  ingredientes: QueryResult;
  precios_venta: QueryResult;
  config_negocio: QueryResult;
  costos_fijos: QueryResult;
  costos_variables: QueryResult;
}

export function settleCatalogQuery(query: PromiseLike<QueryResult>): Promise<QueryResult> {
  return Promise.resolve(query).catch((error) => ({ data: null, error }));
}

export function assembleCatalogFromResults(results: CatalogQueryResults): CatalogData {
  const products = requirePricingRows<DatabaseProduct>("productos", results.productos);
  const recipes = requirePricingRows<PricingRecipe>("recetas", results.recetas);
  const recipeIngredients = requirePricingRows<RecipeIngredient>("receta_ingredientes", results.receta_ingredientes);
  const ingredients = requirePricingRows<PricingIngredient>("ingredientes", results.ingredientes);
  const rules = requirePricingRows<SalePriceRule>("precios_venta", results.precios_venta);
  const defaultsRows = requirePricingRows<PricingDefaults>("config_negocio", results.config_negocio);
  const fixed = requirePricingRows<Record<string, unknown>>("costos_fijos", results.costos_fijos);
  const variable = requirePricingRows<Record<string, unknown>>("costos_variables", results.costos_variables);
  let totalOperativo:number;
  try{totalOperativo=presupuestoMensual(fixed,variable);}catch{throw new PricingUnavailableError('presupuesto mensual');}
  const resolution = resolveValidatedPrices({
    recipes, recipeIngredients, ingredients, rules,
    defaults: defaultsRows[0], totalOperativo,
  });

  const preciosNoDisponibles: string[] = [];
  const empanadaBoxNoDisponibles = new Set<6 | 12 | 24>();
  const vendibles: DatabaseProduct[] = [];
  for (const product of products) {
    const price = sellablePrice(product, resolution);
    if (price == null) {
      preciosNoDisponibles.push(String(product.id ?? product.nombre ?? ""));
      const box = String(product.nombre || "").match(/caja\s*(?:x|×)\s*(6|12|24)\b/i);
      if (box) empanadaBoxNoDisponibles.add(Number(box[1]) as 6 | 12 | 24);
      continue;
    }
    vendibles.push({ ...product, precio: price });
  }

  const decorations = (result: QueryResult) => Array.isArray(result.data) && !result.error ? result.data : [];
  const catalog:CatalogData = {
    ...buildCatalog(
      vendibles,
      decorations(results.promociones),
      decorations(results.testimonios),
      decorations(results.etiquetas) as Etiqueta[],
    ),
    preciosNoDisponibles,
    empanadaBoxNoDisponibles: [...empanadaBoxNoDisponibles],
  };
  const costs=new Map<string,number>();
  for(const product of vendibles){const cost=resolution.productionCosts?.get(String(product.nombre));if(cost!==undefined)costs.set(String(product.id??product.nombre),cost);}
  rememberCatalogCosteo(catalog,{costs,commissionPct:resolution.commissionPct!});
  return catalog;
}

export function publicSaleProducts<T extends DatabaseProduct & { archivado?: boolean }>(
  products: T[], catalog: CatalogData,
): Array<T & { precio: number }> {
  const prices = new Map(
    [...catalog.pizzas, ...catalog.empanadas, ...catalog.bebidas]
      .map((product) => [product.id, product.precio] as const),
  );
  return products.flatMap((product) => {
    if (product.archivado === true) return [];
    const id = String(product.id ?? product.nombre ?? "");
    const box = String(product.nombre || "").match(/caja\s*(?:x|×)\s*(6|12|24)\b/i);
    const size = box ? Number(box[1]) as 6 | 12 | 24 : null;
    const price = size != null
      ? catalog.empanadaBoxNoDisponibles?.includes(size) ? null : catalog.empanadaBoxPrices[size]
      : prices.get(id);
    return price != null && Number.isFinite(price) && price > 0 ? [{ ...product, precio: price }] : [];
  });
}
