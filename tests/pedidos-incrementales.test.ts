import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cursorDePedidos, desdeParaConsulta, unirPedidos, SOLAPE_MS } from '../lib/pedidos-incrementales';

test('el cursor es el updated_at más nuevo, y conserva el anterior si no llega nada más nuevo', () => {
  const filas = [{ updated_at: '2026-10-13T20:00:00.123456+00:00' }, { updated_at: '2026-10-13T20:05:00+00:00' }, { updated_at: null }];
  assert.equal(cursorDePedidos(filas, null), '2026-10-13T20:05:00.000Z');
  assert.equal(cursorDePedidos([], '2026-10-13T20:05:00.000Z'), '2026-10-13T20:05:00.000Z');
  assert.equal(cursorDePedidos([{ updated_at: '2026-10-13T19:00:00Z' }], '2026-10-13T20:05:00.000Z'), '2026-10-13T20:05:00.000Z');
});

test('sin updated_at en las filas (migración sin correr) el cursor queda nulo', () => {
  assert.equal(cursorDePedidos([{ id: 'a' }, { id: 'b' }], null), null);
});

test('la consulta pide desde un minuto antes del cursor', () => {
  assert.equal(SOLAPE_MS, 60000);
  assert.equal(desdeParaConsulta('2026-10-13T20:05:00.000Z'), '2026-10-13T20:04:00.000Z');
});

test('unir reemplaza por _dbId, agrega los nuevos y ordena como el servidor', () => {
  const a = { _dbId: 'a', fecha: '2026-10-13T19:00:00Z', estado: 'nuevo' };
  const b = { _dbId: 'b', fecha: '2026-10-13T20:00:00Z', estado: 'nuevo' };
  const bListo = { ...b, estado: 'entregado' };
  const c = { _dbId: 'c', fecha: '2026-10-13T21:00:00Z', estado: 'nuevo' };
  const d = { _dbId: 'd', fecha: '2026-10-13T21:00:00Z', estado: 'nuevo' };
  assert.deepEqual(unirPedidos([b, a], [bListo, d, c]).map((p) => `${p._dbId}:${p.estado}`), ['c:nuevo', 'd:nuevo', 'b:entregado', 'a:nuevo']);
  const actuales = [b, a];
  assert.equal(unirPedidos(actuales, []), actuales);
});
