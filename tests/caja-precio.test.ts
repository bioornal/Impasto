import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEffectivePrices, cajaPorUnidad, precioCaja } from "../lib/effective-prices";
import { resolveValidatedPrices, sellablePrice } from "../lib/pricing-safety";
import { assembleCatalogFromResults } from "../lib/catalog-source";
import { quoteItemsWithCatalog } from "../lib/order-quote";
import { catalogCosteo } from "../lib/catalog-costeo";
import { costeoCarrito } from "../lib/costeo-capture";
import type { CartItem } from "../types";

const cajaPizza = (precio: unknown = 320) => ({ id: "cp", nombre: "Caja de pizza", unidad: "unidad", precio_kg: precio as number, multiplo_rendimiento: 1 });
const cajaEmpanadas = (precio: unknown = 300) => ({ id: "ce", nombre: "Caja de empanadas", unidad: "unidad", precio_kg: precio as number, multiplo_rendimiento: 1 });
const tapa = { id: "tapa", nombre: "Tapa de empanada", unidad: "unidad", precio_kg: 100, multiplo_rendimiento: 1 };

// Pizza: costo 5000, markup 2 → $10.000 al peso.
// Empanada: relleno de 650 g → 10 unidades a $65 + tapa $100 = $165; markup 2,9 → $479 al peso.
const input = (cajas: object[] = [cajaPizza(), cajaEmpanadas()]) => ({
  recipes: [
    { id: "p", nombre: "Muzza", precio_prepizza: 0, precio_salsa: 0, rend_tipo: "directo", rend_valor: 1 },
    { id: "e", nombre: "Palmito", rend_tipo: "peso", rend_valor: 65 },
  ],
  recipeIngredients: [
    { receta_id: "p", ingrediente_id: "queso", cantidad_kg: 0.5 },
    { receta_id: "e", ingrediente_id: "relleno", cantidad_kg: 0.65 },
  ],
  ingredients: [
    { id: "queso", precio_kg: 10000, multiplo_rendimiento: 1 },
    { id: "relleno", precio_kg: 1000, multiplo_rendimiento: 1 },
    tapa,
    ...cajas,
  ],
  rules: [
    { receta_id: "p", nombre: "Muzza", markup: 2, subcategoria: "Pizzas" },
    { receta_id: "e", nombre: "Palmito", markup: 2.9, subcategoria: "Empanadas" },
  ],
  defaults: { pizzas_objetivo_mes: 800 },
  totalOperativo: 0,
});

function args(v: ReturnType<typeof input>) {
  return [v.recipes, v.recipeIngredients, v.ingredients, v.rules, v.defaults, v.totalOperativo] as const;
}

test("cada pizza lleva su caja y cada empanada la sexta parte de la caja de empanadas", () => {
  assert.equal(cajaPorUnidad("Pizzas", 320, 300), 320);
  assert.equal(cajaPorUnidad("Empanadas", 320, 300), 50);
  assert.equal(cajaPorUnidad("Bebidas", 320, 300), 0);
  assert.equal(cajaPorUnidad("Pizzas", null, 300), null);
  assert.equal(cajaPorUnidad("Empanadas", 320, null), null);
});

test("la caja se lee de Ingredientes; sin cargar vale 0 y un precio roto es null", () => {
  assert.equal(precioCaja([cajaPizza(" 320 ")], "Caja de pizza"), 320);
  assert.equal(precioCaja([{ ...cajaPizza(), nombre: "  caja DE pizza " }], "Caja de pizza"), 320);
  assert.equal(precioCaja([], "Caja de pizza"), 0);
  assert.equal(precioCaja([{ ...cajaPizza(), unidad: "kg" }], "Caja de pizza"), 0);
  assert.equal(precioCaja([cajaPizza(0)], "Caja de pizza"), 0);
  for (const roto of [null, "", "abc", -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(precioCaja([cajaPizza(roto)], "Caja de pizza"), null);
  }
});

test("la caja va al precio al costo, sin margen, antes de redondear a $500", () => {
  const sinCaja = buildEffectivePrices(...args(input([])));
  const conCaja = buildEffectivePrices(...args(input()));
  assert.equal(sinCaja.get("Muzza"), 10000);
  assert.equal(conCaja.get("Muzza"), 10500); // 10000 + 320 → 10500
  assert.equal(sinCaja.get("Palmito"), 500); // 479 → 500
  assert.equal(conCaja.get("Palmito"), 1000); // 479 + 300 ÷ 6 = 529 → 1000
  const caja600 = buildEffectivePrices(...args(input([cajaPizza(600), cajaEmpanadas()])));
  assert.equal(caja600.get("Muzza"), 11000); // 10600 → 11000: la caja no se multiplica por el markup
});

test("el costo de producción de cada unidad incluye su parte de la caja", () => {
  const costs = new Map<string, number>();
  buildEffectivePrices(...args(input()), costs);
  assert.equal(costs.get("Muzza"), 5320);
  assert.equal(costs.get("Palmito"), 215); // 165 + 300 ÷ 6
});

test("una caja con precio roto bloquea solo lo que la lleva", () => {
  const pizzaRota = resolveValidatedPrices(input([cajaPizza("abc"), cajaEmpanadas()]));
  assert.equal(sellablePrice({ nombre: "Muzza", precio: 9000 }, pizzaRota), null);
  assert.equal(sellablePrice({ nombre: "Palmito", precio: 9000 }, pizzaRota), 1000);
  const empanadaRota = resolveValidatedPrices(input([cajaPizza(), cajaEmpanadas(-5)]));
  assert.equal(sellablePrice({ nombre: "Palmito", precio: 9000 }, empanadaRota), null);
  assert.equal(sellablePrice({ nombre: "Muzza", precio: 9000 }, empanadaRota), 10500);
});

const rows = (data: unknown[] = []) => ({ data, error: null });
function catalogo(cajas: object[] = [cajaPizza(), cajaEmpanadas()]) {
  const base = input(cajas);
  return assembleCatalogFromResults({
    productos: rows([
      { id: "pz", nombre: "Muzza", categoria: "pizzas", precio: 1, disponible: true },
      { id: "em", nombre: "Palmito", categoria: "empanadas", precio: 1, disponible: true },
    ]),
    promociones: rows(), testimonios: rows(), etiquetas: rows(),
    recetas: rows(base.recipes), receta_ingredientes: rows(base.recipeIngredients), ingredientes: rows(base.ingredients),
    precios_venta: rows(base.rules), config_negocio: rows([base.defaults]),
    costos_fijos: rows(), costos_variables: rows(),
  });
}
const caja = (size: 6 | 12 | 24): CartItem => ({
  key: `emp-${size}-em`, cartId: String(size), type: "empanadas", name: `Caja x${size}`, price: 0, qty: 1,
  variant: { kind: "empanadas-box", size, selections: { em: size } },
});

test("la caja de empanadas cobra solo la suma de sus empanadas: la caja ya está en cada una", () => {
  const catalog = catalogo();
  assert.equal(catalog.empanadas[0]?.precio, 1000);
  const [x6, x12, x24] = quoteItemsWithCatalog([caja(6), caja(12), caja(24)], catalog);
  assert.equal(x6.price, 6000);
  assert.equal(x12.price, 12000);
  assert.equal(x24.price, 24000);
});

test("el costeo de la venta lleva la caja dentro del costo de cada unidad", () => {
  const catalog = catalogo();
  const items = quoteItemsWithCatalog([caja(12), { key: "pz", cartId: "p", type: "pizza", name: "", price: 0, qty: 2 }], catalog);
  // 12 × 215 = 2580; 2 × 5320 = 10640
  assert.equal(costeoCarrito(items, catalogCosteo(catalog).costs), 1322000);
});

test("sin cajas cargadas todo se vende como antes", () => {
  const catalog = catalogo([]);
  assert.equal(catalog.pizzas[0]?.precio, 10000);
  assert.equal(catalog.empanadas[0]?.precio, 500);
  assert.equal(quoteItemsWithCatalog([caja(12)], catalog)[0].price, 6000);
});
