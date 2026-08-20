/**
 * `productos` es una tabla global compartida con otro proyecto, y no tiene
 * ninguna columna de pertenencia. Esta lista es el único criterio por el que
 * un producto es de Impasto: las demás categorías (hamburguesas, lomos,
 * calzones, otros) son del proyecto paralelo y no se muestran ni se editan.
 *
 * Ver docs/superpowers/specs/2026-08-20-saneamiento-catalogo-design.md
 */
export const CATEGORIAS_IMPASTO = ["pizzas", "empanadas", "bebidas"] as const;

export type CategoriaImpasto = (typeof CATEGORIAS_IMPASTO)[number];

export const esCategoriaImpasto = (valor: unknown): valor is CategoriaImpasto =>
  typeof valor === "string" && (CATEGORIAS_IMPASTO as readonly string[]).includes(valor);
