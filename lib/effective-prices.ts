export interface PricingRecipe {
  id?: string;
  nombre?: string;
  precio_prepizza?: number | string;
  precio_salsa?: number | string;
  rend_tipo?: string | null;
  rend_valor?: number | string | null;
}

export interface PricingIngredient {
  id?: string;
  nombre?: string;
  unidad?: string;
  precio_kg?: number | string;
  multiplo_rendimiento?: number | string;
  gramos_por_unidad?: number | string | null;
}

export interface RecipeIngredient {
  receta_id?: string;
  ingrediente_id?: string;
  cantidad_kg?: number | string;
}

export interface SalePriceRule {
  receta_id?: string;
  nombre?: string;
  markup?: number | string;
  subcategoria?: string;
}

export interface PricingDefaults {
  pizzas_objetivo_mes?: number | string;
  precio_prepizza_default?: number | string;
  precio_salsa_default?: number | string;
  comision_tarjeta_pct?: number | string | null;
  comision_en_precio?: unknown;
}

const GRAMOS_POR_EMPANADA = 65;
/** Same conversion as the recetario: unit ingredients contribute their net mass. */
export function pesoPorUnidadGramos(ingredient: { gramos_por_unidad?: number | string | null }): number {
  const grams = Number(ingredient.gramos_por_unidad);
  return Number.isFinite(grams) && grams > 0 ? grams : 0;
}

export function masaNetaKg(ingredient: { cantidad_kg: number; gramos_por_unidad?: number | string | null }): number {
  const grams = pesoPorUnidadGramos(ingredient);
  const quantity = Number(ingredient.cantidad_kg) || 0;
  return grams > 0 ? quantity * grams / 1000 : quantity;
}
export const isEmpanadaShell = (ingredient: PricingIngredient): boolean =>
  String(ingredient.nombre ?? '').trim().toLowerCase() === 'tapa de empanada' && ingredient.unidad === 'unidad';
// El precio de venta sube al próximo múltiplo de $500. Con $1.000 los saltos
// eran dispares: Pollo pasaba de $2.029 a $3.000 y Árabe de $2.993 a $3.000.
const REDONDEO_PRECIO = 500;

// Las 7 categorías de precios_venta y la comisión por defecto, iguales a
// CATEGORIAS_PRECIO y COMISION_TARJETA_DEFAULT del recetario (src/utils/pricing.ts).
const CATEGORIAS_PRECIO = ['Pizzas', 'Calzones', 'Empanadas', 'Hamburguesas', 'Lomos', 'Bebidas', 'Otros'];
const COMISION_TARJETA_DEFAULT = 7.99;

/** Igual que leerComisionPct del recetario: si falta, vacío o no sirve, 7,99. */
function leerComisionPct(valor: unknown): number {
  if (valor === null || valor === undefined) return COMISION_TARJETA_DEFAULT;
  if (typeof valor === 'string' && valor.trim() === '') return COMISION_TARJETA_DEFAULT;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : COMISION_TARJETA_DEFAULT;
}

/**
 * Replica el cálculo de precios del proyecto recetario-napolitano (precios.astro).
 * El precio de venta es ese valor al peso, subido al próximo múltiplo de $500.
 * Si la categoría está en config_negocio.comision_en_precio, el markup se divide por
 * (1 − comisión): el precio absorbe la comisión de Mercado Pago.
 *
 * Pizzas:
 *   costoReceta = round(precio_prepizza + precio_salsa + Σ(precio_kg * cantidad_kg * multiplo_rendimiento))
 *   precioEfectivo = round(costoReceta * markup)
 *
 * Empanadas (sin prepizza ni salsa, igual que las bebidas):
 *   costoReceta = round(Σ(precio_kg * cantidad_kg * multiplo_rendimiento))
 *   unidades = según rend_tipo y rend_valor de la receta
 *   costoUnit = costoReceta / unidades + precio de una tapa
 *   precioEfectivo = round(costoUnit * markup)
 */
export function buildEffectivePrices(
  recipes: PricingRecipe[],
  recipeIngredients: RecipeIngredient[],
  ingredients: PricingIngredient[],
  salePriceRules: SalePriceRule[],
  defaults: PricingDefaults | undefined,
  totalOperativo: number,
): Map<string, number> {
  const recipeById = new Map<string, PricingRecipe>();
  for (const recipe of recipes) {
    if (recipe.id) recipeById.set(String(recipe.id), recipe);
  }

  const ingredientData = new Map<string, PricingIngredient>();
  for (const ingredient of ingredients) {
    if (ingredient.id) ingredientData.set(String(ingredient.id), ingredient);
  }
  const tapa = ingredients.find(isEmpanadaShell);
  const costoTapa = Number(tapa?.precio_kg) || 0;

  const riByRecipe = new Map<string, RecipeIngredient[]>();
  for (const ri of recipeIngredients) {
    const key = String(ri.receta_id);
    if (!riByRecipe.has(key)) riByRecipe.set(key, []);
    riByRecipe.get(key)!.push(ri);
  }

  const pizzasObjetivo = Number(defaults?.pizzas_objetivo_mes) || 0;
  const costoOpPorPizza = pizzasObjetivo > 0 ? Math.round(totalOperativo / pizzasObjetivo) : 0;
  const comisionPct = leerComisionPct(defaults?.comision_tarjeta_pct);
  const categoriasConComision = new Set(
    Array.isArray(defaults?.comision_en_precio) ? (defaults!.comision_en_precio as unknown[]).map(String) : [],
  );

  const prices = new Map<string, number>();

  for (const rule of salePriceRules) {
    if (!rule.receta_id || !rule.nombre) continue;
    const markup = Number(rule.markup);
    if (!markup || markup <= 0) continue;

    const recipe = recipeById.get(String(rule.receta_id));
    const components = riByRecipe.get(String(rule.receta_id)) ?? [];
    const subcategoria = String(rule.subcategoria || '');
    // La categoría normalizada solo decide el tilde; el costeo sigue con la subcategoría tal cual.
    const categoria = CATEGORIAS_PRECIO.includes(subcategoria) ? subcategoria : 'Otros';
    const markupFinal = categoriasConComision.has(categoria) ? markup / (1 - comisionPct / 100) : markup;

    let costoUnit = 0;
    if (recipe && components.length > 0) {
      // La prepizza y la salsa son de la pizza: empanadas y bebidas no las suman
      // aunque la receta las tenga cargadas.
      const llevaPrepizza = subcategoria !== 'Empanadas' && subcategoria !== 'Bebidas';
      const precioPrepizza = llevaPrepizza ? Number(recipe.precio_prepizza ?? defaults?.precio_prepizza_default ?? 0) : 0;
      const precioSalsa = llevaPrepizza ? Number(recipe.precio_salsa ?? defaults?.precio_salsa_default ?? 0) : 0;

      let costoIngredientes = 0;
      let totalCantidadKg = 0;
      for (const ri of components) {
        const ing = ingredientData.get(String(ri.ingrediente_id));
        if (!ing) continue;
        const precioKg = Number(ing.precio_kg);
        const cantidad = Number(ri.cantidad_kg);
        const multiplo = Number(ing.multiplo_rendimiento ?? 1);
        costoIngredientes += precioKg * cantidad * multiplo;
        // MR affects purchase cost only, never net recipe yield.
        totalCantidadKg += masaNetaKg({ cantidad_kg: cantidad, gramos_por_unidad: ing.gramos_por_unidad });
      }

      const costoReceta = Math.round(precioPrepizza + precioSalsa + costoIngredientes);

      const rendValor = Number(recipe.rend_valor) || 0;
      const unidades = recipe.rend_tipo === 'peso'
        ? Math.floor((totalCantidadKg * 1000) / (rendValor || GRAMOS_POR_EMPANADA))
        : (rendValor || 1);
      costoUnit = (unidades > 0 ? costoReceta / unidades : costoReceta)
        + (subcategoria === 'Empanadas' ? costoTapa : 0);
    }

    const costoOpUnit = subcategoria === 'Empanadas' ? Math.round(costoOpPorPizza / 12) : subcategoria === 'Bebidas' ? 0 : costoOpPorPizza;
    const costoReal = costoUnit + costoOpUnit;
    // Primero al peso, como lo muestra el recetario; después hacia arriba al múltiplo de $500.
    prices.set(rule.nombre, Math.ceil(Math.round(costoReal * markupFinal) / REDONDEO_PRECIO) * REDONDEO_PRECIO);
  }

  return prices;
}
