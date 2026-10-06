import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEffectivePrices, cajasDeEmpanadas, precioCaja } from "../lib/effective-prices";
import { resolveValidatedPrices, sellablePrice } from "../lib/pricing-safety";
import { assembleCatalogFromResults } from "../lib/catalog-source";
import { quoteItemsWithCatalog } from "../lib/order-quote";
import { catalogCosteo } from "../lib/catalog-costeo";
import { costeoCarrito } from "../lib/costeo-capture";
import type { CartItem } from "../types";

const cajaPizza = (precio: unknown = 320) => ({ id: "cp", nombre: "Caja de pizza", unidad: "unidad", precio_kg: precio as number, multiplo_rendimiento: 1 });
const cajaEmpanadas = (precio: unknown = 320) => ({ id: "ce", nombre: "Caja de empanadas", unidad: "unidad", precio_kg: precio as number, multiplo_rendimiento: 1 });
const tapa = { id: "tapa", nombre: "Tapa de empanada", unidad: "unidad", precio_kg: 100, multiplo_rendimiento: 1 };

// Pizza: costo 5000, markup 2 → 10000 al peso. Empanada: relleno 650 g → 10 u. a $65 + tapa $100 = $165, markup 2 → $330 → $500.
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
    { receta_id: "e", nombre: "Palmito", markup: 2, subcategoria: "Empanadas" },
  ],
  defaults: { pizzas_objetivo_mes: 800 },
  totalOperativo: 0,
});

test("una caja cada 12 empanadas: x6 y x12 llevan una, 18 y 24 llevan dos", () => {
  assert.deepEqual([0, 1, 6, 12, 13, 18, 24, 25].map(cajasDeEmpanadas), [0, 1, 1, 1, 2, 2, 2, 3]);
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

test("la pizza suma la caja al costo, sin margen, antes de redondear a $500", () => {
  const sinCaja = buildEffectivePrices(...args(input([])));
  const conCaja = buildEffectivePrices(...args(input()));
  assert.equal(sinCaja.get("Muzza"), 10000);
  assert.equal(conCaja.get("Muzza"), 10500); // 10000 + 320 → 10500
  const caja600 = buildEffectivePrices(...args(input([cajaPizza(600), cajaEmpanadas()])));
  assert.equal(caja600.get("Muzza"), 11000); // 10600 → 11000: la caja no se multiplica por el markup
});

test("la caja de pizza entra en el costo de producción; la empanada no la lleva por unidad", () => {
  const costs = new Map<string, number>();
  const prices = buildEffectivePrices(...args(input()), costs);
  assert.equal(costs.get("Muzza"), 5320);
  assert.equal(costs.get("Palmito"), 165);
  assert.equal(prices.get("Palmito"), 500);
});

test("un precio de caja de pizza roto bloquea solo las pizzas", () => {
  const resolution = resolveValidatedPrices(input([cajaPizza("abc"), cajaEmpanadas()]));
  assert.equal(sellablePrice({ nombre: "Muzza", precio: 9000 }, resolution), null);
  assert.equal(sellablePrice({ nombre: "Palmito", precio: 9000 }, resolution), 500);
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

test("la caja de empanadas cobra la suma de las empanadas más sus cajas, sin redondear", () => {
  const catalog = catalogo();
  assert.equal(catalog.empanadas[0]?.precio, 500); // el precio por unidad no cambia
  assert.deepEqual(catalog.empanadaBoxCharge, { 6: 320, 12: 320, 24: 640 });
  const [x6, x12, x24] = quoteItemsWithCatalog([caja(6), caja(12), caja(24)], catalog);
  assert.equal(x6.price, 3320);
  assert.equal(x12.price, 6320);
  assert.equal(x24.price, 12640);
  assert.equal(x12.name, "Caja x12");
  assert.doesNotMatch(`${x12.name} ${x12.detail}`, /caja de|cart[oó]n|\$320/i);
});

test("el costeo de la venta suma la caja de empanadas y la de pizza al costo", () => {
  const catalog = catalogo();
  const { costs, cajaEmpanadas: precio } = catalogCosteo(catalog);
  const items = quoteItemsWithCatalog([caja(12), caja(24), { key: "pz", cartId: "p", type: "pizza", name: "", price: 0, qty: 2 }], catalog);
  // 12 × 165 + 320 = 2300; 24 × 165 + 640 = 4600; 2 × 5320 = 10640
  assert.equal(costeoCarrito(items, costs, precio), 1754000);
});

test("sin cajas cargadas todo se vende como antes", () => {
  const catalog = catalogo([]);
  assert.deepEqual(catalog.empanadaBoxCharge, { 6: 0, 12: 0, 24: 0 });
  assert.equal(catalog.pizzas[0]?.precio, 10000);
  assert.equal(quoteItemsWithCatalog([caja(12)], catalog)[0].price, 6000);
});

test("un precio de caja de empanadas roto bloquea las cajas, no las pizzas", () => {
  const catalog = catalogo([cajaPizza(), cajaEmpanadas(-5)]);
  assert.deepEqual(catalog.empanadaBoxNoDisponibles, [6, 12, 24]);
  assert.throws(() => quoteItemsWithCatalog([caja(12)], catalog), /precio no disponible/i);
  assert.equal(catalog.pizzas[0]?.precio, 10500);
});

function args(v: ReturnType<typeof input>) {
  return [v.recipes, v.recipeIngredients, v.ingredients, v.rules, v.defaults, v.totalOperativo] as const;
}
