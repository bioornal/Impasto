import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveValidatedPrices, sellablePrice } from '../lib/pricing-safety';
import { buildEffectivePrices } from '../lib/effective-prices.ts';

// Hand-derived fixtures matching recetario masaNetaKg/calcUnidadesReceta.
function price(unit, qty, grams, fillingMultiplier = 1) {
  return buildEffectivePrices(
    [{id: 'r', rend_tipo: 'peso', rend_valor: 65}],
    [{receta_id: 'r', ingrediente_id: 'fill', cantidad_kg: 0.6}, {receta_id: 'r', ingrediente_id: unit, cantidad_kg: qty}],
    [{id: 'fill', precio_kg: 10000, multiplo_rendimiento: fillingMultiplier},
      {id: unit, unidad: 'unidad', precio_kg: 100, multiplo_rendimiento: 1, gramos_por_unidad: grams},
      {id: 'tapa', nombre: 'Tapa de empanada', unidad: 'unidad', precio_kg: 100, multiplo_rendimiento: 1}],
    [{receta_id: 'r', nombre: 'Empanada', markup: 2, subcategoria: 'Empanadas'}],
    {pizzas_objetivo_mes: 800}, 0,
  ).get('Empanada');
}

test('two 55g eggs add 110g, giving 10 empanadas and a $1500 list price', () => {
  // (6000 + 200) / floor(710/65) + 100 = 720; ×2 = 1440 → 1500.
  assert.equal(price('huevo', 2, 55), 1500);
});
test('ten 5g anchovies add 50g, giving 10 empanadas and a $2000 list price', () => {
  // (6000 + 1000) / floor(650/65) + 100 = 800; ×2 = 1600 → 2000.
  assert.equal(price('anchoa', 10, '5'), 2000);
});
test('MR affects cost but never net yield', () => {
  // (12000 + 200) / 10 + 100 = 1320; ×2 = 2640 → 3000.
  assert.equal(price('huevo', 2, 55, 2), 3000);
});
test('missing grams retains legacy kg interpretation', () => {
  for (const grams of [undefined, null]) {
    // Legacy 2.6kg gives 40 units; (6200 / 40 + 100) ×2 = 510 → 1000.
    assert.equal(price('huevo', 2, grams), 1000);
  }
});
test('explicit invalid grams blocks prices', () => {
  for (const grams of [0, -1, 'invalid', Infinity]) assert.throws(() => price('huevo', 2, grams));
});

const contrato = JSON.parse(readFileSync(new URL('./fixtures/rendimiento-contrato.json', import.meta.url), 'utf8'));
function costo(rendTipo, valor) {
  const production = new Map();
  buildEffectivePrices([{id:'r', rend_tipo:rendTipo, rend_valor:valor}],
    [{receta_id:'r', ingrediente_id:'fill', cantidad_kg:0.65}],
    [{id:'fill', precio_kg:1200 / 0.65, multiplo_rendimiento:1}],
    [{receta_id:'r', nombre:'Producto', markup:1, subcategoria:'Bebidas'}], {}, 0, production);
  return production.get('Producto');
}
test('shared yield contract preserves absent defaults and valid numeric strings', () => {
  for (const c of contrato.validos) {
    assert.equal(costo('directo', c.valor), c.costoDirecto);
    assert.equal(costo('peso', c.valor), c.costoPeso);
  }
  assert.equal(costo('directo', undefined), 1200);
  assert.equal(costo('peso', undefined), 120);
});
test('shared contract rejects malformed explicit metadata before returning prices', () => {
  for (const value of [...contrato.invalidos, NaN, Infinity]) {
    assert.throws(() => price('huevo', 2, value));
    assert.throws(() => costo('directo', value));
    assert.throws(() => costo('peso', value));
  }
  assert.throws(() => costo('peso', 1e-320));
  assert.throws(() => costo('directo', 1e-320));
  assert.throws(() => price('huevo', 2, 1e308));
});
test('invalid metadata disables only its rule and cannot fall back to a manual price', () => {
  for (const value of contrato.invalidos) {
    for (const field of ['rend_valor', 'gramos_por_unidad']) {
      const input = {
        recipes: [{id:'bad', rend_tipo:'peso', rend_valor:field === 'rend_valor' ? value : 65}, {id:'good', rend_tipo:'peso', rend_valor:65}],
        recipeIngredients: [{receta_id:'bad', ingrediente_id:'bad', cantidad_kg:0.65}, {receta_id:'good', ingrediente_id:'good', cantidad_kg:0.65}],
        ingredients: [{id:'bad', precio_kg:1000, multiplo_rendimiento:1, gramos_por_unidad:field === 'gramos_por_unidad' ? value : null}, {id:'good', precio_kg:1000, multiplo_rendimiento:1}],
        rules: [{receta_id:'bad', nombre:'Malo', markup:2, subcategoria:'Bebidas'}, {receta_id:'good', nombre:'Bueno', markup:2, subcategoria:'Bebidas'}],
        defaults:{pizzas_objetivo_mes:800}, totalOperativo:0,
      };
      const resolution = resolveValidatedPrices(input);
      assert.equal(sellablePrice({nombre:'Malo', precio:9000}, resolution), null);
      assert.equal(sellablePrice({nombre:'Bueno', precio:9000}, resolution), 500);
      assert.equal(resolution.productionCosts.has('Malo'), false);
    }
  }
});
