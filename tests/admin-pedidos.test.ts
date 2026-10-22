import assert from "node:assert/strict";
import { test } from "node:test";
import { esActivo, etiquetaEstado, numeroCorto, resumenItems, siguienteEstado } from "../lib/admin-pedidos";

const pedido = (extra: Record<string, unknown> = {}) =>
  ({ estado: "nuevo", mode: "delivery", pago: "efectivo", pagoEstado: "pendiente", ...extra }) as Parameters<typeof siguienteEstado>[0];

test("esActivo: nuevo, preparando y en camino; no entregado ni cancelado", () => {
  assert.equal(esActivo({ estado: "nuevo" }), true);
  assert.equal(esActivo({ estado: "preparando" }), true);
  assert.equal(esActivo({ estado: "en-camino" }), true);
  assert.equal(esActivo({ estado: "entregado" }), false);
  assert.equal(esActivo({ estado: "cancelado" }), false);
});

test("etiquetaEstado: en camino es 'Listo para retirar' en retiro", () => {
  assert.equal(etiquetaEstado("en-camino", "delivery"), "En camino");
  assert.equal(etiquetaEstado("en-camino", "takeaway"), "Listo para retirar");
  assert.equal(etiquetaEstado("nuevo", "takeaway"), "Nuevo");
  assert.equal(etiquetaEstado("raro", "takeaway"), "raro");
});

test("siguienteEstado: avanza un paso y nombra el destino según la entrega", () => {
  assert.deepEqual(siguienteEstado(pedido()), { estado: "preparando", etiqueta: "Preparando" });
  assert.deepEqual(siguienteEstado(pedido({ estado: "preparando" })), { estado: "en-camino", etiqueta: "En camino" });
  assert.deepEqual(siguienteEstado(pedido({ estado: "preparando", mode: "takeaway" })), { estado: "en-camino", etiqueta: "Listo para retirar" });
  assert.deepEqual(siguienteEstado(pedido({ estado: "en-camino" })), { estado: "entregado", etiqueta: "Entregado" });
});

test("siguienteEstado: nada después de entregado ni para cancelados", () => {
  assert.equal(siguienteEstado(pedido({ estado: "entregado" })), null);
  assert.equal(siguienteEstado(pedido({ estado: "cancelado" })), null);
});

test("siguienteEstado: una tarjeta sin acreditar no avanza (misma regla que la cocina)", () => {
  assert.equal(siguienteEstado(pedido({ pago: "mercadopago", pagoEstado: "pendiente" })), null);
  assert.deepEqual(siguienteEstado(pedido({ pago: "mercadopago", pagoEstado: "aprobado" })), { estado: "preparando", etiqueta: "Preparando" });
});

test("numeroCorto: el número de la comanda; el POS con prefijo; sin número, la referencia", () => {
  assert.equal(numeroCorto({ numero: "107345", canal: "web", id: "IM-107345-K7QD" }), "107345");
  assert.equal(numeroCorto({ numero: "3", canal: "pos", id: "IM-0003" }), "POS 3");
  assert.equal(numeroCorto({ numero: "", canal: "web", id: "IM-MAN-36E8" }), "IM-MAN-36E8");
  assert.equal(numeroCorto({ id: "IM-1" }), "IM-1");
});

test("resumenItems: entra lo que cabe y cuenta el resto", () => {
  const items = [{ qty: 1, name: "Fugazzetta" }, { qty: 2, name: "Muzzarella Impasto" }, { qty: 1, name: "Coca-Cola 1.5 L" }];
  assert.deepEqual(resumenItems(items, 60), { texto: "1× Fugazzetta, 2× Muzzarella Impasto, 1× Coca-Cola 1.5 L", resto: 0 });
  assert.deepEqual(resumenItems(items, 30), { texto: "1× Fugazzetta", resto: 2 });
  // El primero siempre entra, aunque sea largo (la tabla lo corta con "…").
  assert.deepEqual(resumenItems([{ qty: 1, name: "Mitad Napoletana all'Aglio / Mitad Prosciutto, Rucola e Parmigiano" }], 20).resto, 0);
  assert.deepEqual(resumenItems([], 30), { texto: "", resto: 0 });
});
