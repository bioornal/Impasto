import assert from "node:assert/strict";
import { test } from "node:test";
import { PricingUnavailableError, requirePricingRows, resolveValidatedPrices, sellablePrice } from "../lib/pricing-safety";

const base = () => ({
  recipes: [{ id: "r", nombre: "Empanada", precio_prepizza: 500, precio_salsa: 200 }],
  recipeIngredients: [{ receta_id: "r", ingrediente_id: "i", cantidad_kg: 0.65 }],
  ingredients: [{ id: "i", precio_kg: 1000, multiplo_rendimiento: 1 }],
  rules: [{ receta_id: "r", nombre: "Empanada", markup: 2, subcategoria: "Empanadas" }],
  defaults: { pizzas_objetivo_mes: 800 },
  totalOperativo: 0,
});

test("una fuente con error o sin array bloquea todos los precios", () => {
  assert.throws(() => requirePricingRows("ingredientes", { data: null, error: new Error("red") }), PricingUnavailableError);
  assert.throws(() => requirePricingRows("ingredientes", { data: null, error: null }), PricingUnavailableError);
  assert.deepEqual(requirePricingRows("ingredientes", { data: [], error: null }), []);
});

test("un producto sin regla usa solo precio manual positivo y finito", () => {
  const resolution = { calculated: new Map<string, number>(), invalid: new Set<string>() };
  assert.equal(sellablePrice({ nombre: "Agua", precio: 2500 }, resolution), 2500);
  for (const precio of [null, 0, -1, Number.POSITIVE_INFINITY, Number.NaN, "abc"]) {
    assert.equal(sellablePrice({ nombre: "Agua", precio }, resolution), null);
  }
});

test("una regla válida conserva el redondeo a $500 sin prepizza para empanadas", () => {
  const resolution = resolveValidatedPrices(base());
  assert.equal(sellablePrice({ nombre: "Empanada", precio: 9000 }, resolution), 500);
});

test("una regla rota no cae al precio manual", () => {
  const cases = [
    { name: "sin componentes", change: (v: ReturnType<typeof base>) => { v.recipeIngredients = []; } },
    { name: "ingrediente ausente", change: (v: ReturnType<typeof base>) => { v.ingredients = []; } },
    { name: "cantidad inválida", change: (v: ReturnType<typeof base>) => { v.recipeIngredients[0].cantidad_kg = Number.NaN; } },
    { name: "precio inválido", change: (v: ReturnType<typeof base>) => { v.ingredients[0].precio_kg = Number.POSITIVE_INFINITY; } },
    { name: "markup inválido", change: (v: ReturnType<typeof base>) => { v.rules[0].markup = -1; } },
    { name: "receta ausente", change: (v: ReturnType<typeof base>) => { v.recipes = []; } },
    { name: "costo cero", change: (v: ReturnType<typeof base>) => { v.ingredients[0].precio_kg = 0; } },
    { name: "regla duplicada", change: (v: ReturnType<typeof base>) => { v.rules.push({ ...v.rules[0] }); } },
    { name: "sin denominador operativo", change: (v: ReturnType<typeof base>) => { v.totalOperativo = 1000; v.defaults.pizzas_objetivo_mes = 0; } },
  ];
  for (const { name, change } of cases) {
    const input = base();
    change(input);
    const resolution = resolveValidatedPrices(input);
    assert.equal(sellablePrice({ nombre: "Empanada", precio: 9000 }, resolution), null, name);
    assert.equal(resolution.invalid.has("Empanada"), true, name);
  }
});

test("una regla rota solo invalida su producto", () => {
  const resolution = resolveValidatedPrices(base());
  resolution.invalid.add("Palmito");
  assert.equal(sellablePrice({ nombre: "Palmito", precio: 9000 }, resolution), null);
  assert.equal(sellablePrice({ nombre: "Agua", precio: 2500 }, resolution), 2500);
});
