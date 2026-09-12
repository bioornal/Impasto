export interface PricingRecipe {
  id?: string;
  nombre?: string;
  precio_prepizza?: number | string;
  precio_salsa?: number | string;
}

export interface PricingIngredient {
  id?: string;
  precio_kg?: number | string;
  multiplo_rendimiento?: number | string;
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
}

const GRAMOS_POR_EMPANADA = 65;
// El precio de venta sube al próximo múltiplo de $500. Con $1.000 los saltos
// eran dispares: Pollo pasaba de $2.029 a $3.000 y Árabe de $2.993 a $3.000.
const REDONDEO_PRECIO = 500;

/**
 * Replica el cálculo de precios del proyecto recetario-napolitano (precios.astro).
 * El precio de venta es ese valor al peso, subido al próximo múltiplo de $500.
 *
 * Pizzas:
 *   costoReceta = round(precio_prepizza + precio_salsa + Σ(precio_kg * cantidad_kg * multiplo_rendimiento))
 *   precioEfectivo = round(costoReceta * markup)
 *
 * Empanadas (sin prepizza ni salsa, igual que las bebidas):
 *   costoReceta = round(Σ(precio_kg * cantidad_kg * multiplo_rendimiento))
 *   unidades = floor(totalCantidadKg * 1000 / 65)
 *   costoUnit = costoReceta / unidades
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

  const riByRecipe = new Map<string, RecipeIngredient[]>();
  for (const ri of recipeIngredients) {
    const key = String(ri.receta_id);
    if (!riByRecipe.has(key)) riByRecipe.set(key, []);
    riByRecipe.get(key)!.push(ri);
  }

  const pizzasObjetivo = Number(defaults?.pizzas_objetivo_mes) || 0;
  const costoOpPorPizza = pizzasObjetivo > 0 ? Math.round(totalOperativo / pizzasObjetivo) : 0;

  const prices = new Map<string, number>();

  for (const rule of salePriceRules) {
    if (!rule.receta_id || !rule.nombre) continue;
    const markup = Number(rule.markup);
    if (!markup || markup <= 0) continue;

    const recipe = recipeById.get(String(rule.receta_id));
    const components = riByRecipe.get(String(rule.receta_id)) ?? [];
    const subcategoria = String(rule.subcategoria || '');

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
        totalCantidadKg += cantidad;
      }

      const costoReceta = Math.round(precioPrepizza + precioSalsa + costoIngredientes);

      if (subcategoria === 'Empanadas') {
        const unidades = Math.floor((totalCantidadKg * 1000) / GRAMOS_POR_EMPANADA);
        costoUnit = unidades > 0 ? costoReceta / unidades : costoReceta;
      } else {
        costoUnit = costoReceta;
      }
    }

    const costoOpUnit = subcategoria === 'Empanadas' ? Math.round(costoOpPorPizza / 12) : subcategoria === 'Bebidas' ? 0 : costoOpPorPizza;
    const costoReal = costoUnit + costoOpUnit;
    // Primero al peso, como lo muestra el recetario; después hacia arriba al múltiplo de $500.
    prices.set(rule.nombre, Math.ceil(Math.round(costoReal * markup) / REDONDEO_PRECIO) * REDONDEO_PRECIO);
  }

  return prices;
}
