import {
  buildEffectivePrices,
  type PricingDefaults,
  type PricingIngredient,
  type PricingRecipe,
  type RecipeIngredient,
  type SalePriceRule,
} from "./effective-prices";

export class PricingUnavailableError extends Error {
  constructor(readonly source: string) {
    super("Los precios no están disponibles. Reintentá en unos minutos.");
    this.name = "PricingUnavailableError";
  }
}

export function requirePricingRows<T>(source: string, result: { data?: unknown; error?: unknown }): T[] {
  if (result.error || !Array.isArray(result.data)) throw new PricingUnavailableError(source);
  return result.data as T[];
}

export interface PriceResolution {
  calculated: Map<string, number>;
  invalid: Set<string>;
}

export interface PricingInput {
  recipes: PricingRecipe[];
  recipeIngredients: RecipeIngredient[];
  ingredients: PricingIngredient[];
  rules: SalePriceRule[];
  defaults?: PricingDefaults;
  totalOperativo: number;
}

const finite = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function resolveValidatedPrices(input: PricingInput): PriceResolution {
  if (!Number.isFinite(input.totalOperativo) || input.totalOperativo < 0) {
    throw new PricingUnavailableError("costos operativos");
  }

  const recipes = new Map(input.recipes.map((recipe) => [String(recipe.id), recipe]));
  const ingredients = new Map(input.ingredients.map((ingredient) => [String(ingredient.id), ingredient]));
  const components = new Map<string, RecipeIngredient[]>();
  for (const component of input.recipeIngredients) {
    const id = String(component.receta_id);
    components.set(id, [...(components.get(id) ?? []), component]);
  }

  const counts = new Map<string, number>();
  for (const rule of input.rules) {
    if (rule.nombre) counts.set(rule.nombre, (counts.get(rule.nombre) ?? 0) + 1);
  }

  const calculated = buildEffectivePrices(
    input.recipes,
    input.recipeIngredients,
    input.ingredients,
    input.rules,
    input.defaults,
    input.totalOperativo,
  );
  const invalid = new Set<string>();
  const validDenominator = finite(input.defaults?.pizzas_objetivo_mes);

  for (const rule of input.rules) {
    if (!rule.nombre) continue;
    const recipe = recipes.get(String(rule.receta_id));
    const parts = components.get(String(rule.receta_id)) ?? [];
    const markup = finite(rule.markup);
    const usesBase = rule.subcategoria !== "Empanadas" && rule.subcategoria !== "Bebidas";
    const prepizza = finite(recipe?.precio_prepizza ?? input.defaults?.precio_prepizza_default);
    const salsa = finite(recipe?.precio_salsa ?? input.defaults?.precio_salsa_default);
    const invalidBase = usesBase && (prepizza == null || prepizza < 0 || salsa == null || salsa < 0);
    const broken =
      (counts.get(rule.nombre) ?? 0) !== 1 ||
      !rule.receta_id ||
      !recipe ||
      markup == null || markup <= 0 ||
      invalidBase ||
      parts.length === 0 ||
      (input.totalOperativo > 0 && (validDenominator == null || validDenominator <= 0)) ||
      parts.some((part) => {
        const ingredient = ingredients.get(String(part.ingrediente_id));
        const quantity = finite(part.cantidad_kg);
        const price = finite(ingredient?.precio_kg);
        const multiplier = finite(ingredient?.multiplo_rendimiento);
        return !ingredient || quantity == null || quantity <= 0 ||
          price == null || price < 0 || multiplier == null || multiplier <= 0;
      });
    const value = calculated.get(rule.nombre);
    if (broken || value == null || !Number.isFinite(value) || value <= 0) {
      invalid.add(rule.nombre);
      calculated.delete(rule.nombre);
    }
  }

  return { calculated, invalid };
}

export function sellablePrice(
  product: { nombre?: string; precio?: unknown },
  resolution: PriceResolution,
): number | null {
  const name = String(product.nombre || "");
  if (resolution.invalid.has(name)) return null;
  const value = resolution.calculated.get(name) ?? finite(product.precio);
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}
