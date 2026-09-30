import assert from 'node:assert/strict';
import { test } from 'node:test';
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
test('missing, zero or invalid grams retains legacy kg interpretation', () => {
  for (const grams of [undefined, null, 0, -1, 'invalid', Infinity]) {
    // Legacy 2.6kg gives 40 units; (6200 / 40 + 100) ×2 = 510 → 1000.
    assert.equal(price('huevo', 2, grams), 1000);
  }
});
