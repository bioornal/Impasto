import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogoVigente, CATALOGO_MAX_VIEJO_MS } from '../lib/catalog-vigencia';

test('la carta guardada sirve hasta 5 minutos', () => {
  const t = Date.parse('2026-10-13T20:00:00Z');
  assert.equal(CATALOGO_MAX_VIEJO_MS, 300000);
  assert.equal(catalogoVigente(t, t + 60_000), true);
  assert.equal(catalogoVigente(t, t + 300_000), true);
  assert.equal(catalogoVigente(t, t + 300_001), false);
  assert.equal(catalogoVigente(t, t - 1_000), true);
  assert.equal(catalogoVigente(Number.NaN, t), false);
});
