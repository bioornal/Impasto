import assert from "node:assert/strict";
import { test } from "node:test";
import { diaDeNegocio, docenasDeItems, etiquetaDia, formatoUnidades, pizzasDeItems, resumenPorDia } from "../lib/resumen-diario";
import { adaptOrder } from "../lib/adapt-order";
import type { AdminOrder } from "../app/admin/components/types";

const pizzas = new Set(["Muzzarella Impasto", "Fugazzetta"]);
const carta = { pizzas, empanadas: new Set(["Empanada de Carne"]) };

const pedido = (extra: Partial<AdminOrder>): AdminOrder => ({
  _dbId: Math.random().toString(36).slice(2), id: "IM-1", cliente: "", tel: "", mode: "takeaway", dir: "", zona: "",
  items: [], subtotal: 0, shipping: 0, total: 0, pago: "efectivo", pagoEstado: "pendiente", cambio: "", referencia: "",
  cuando: "asap", estado: "nuevo", fecha: "2026-10-17T23:00:00.000Z", notas: "", canal: "web", ...extra,
});

test("diaDeNegocio: la noche va de 06:00 a 05:59, hora de Argentina", () => {
  // sáb 17/10 20:00 en Argentina = 23:00 UTC
  assert.equal(diaDeNegocio("2026-10-17T23:00:00.000Z"), "2026-10-17");
  // 18/10 00:30 en Argentina = 03:30 UTC: sigue siendo la noche del 17
  assert.equal(diaDeNegocio("2026-10-18T03:30:00.000Z"), "2026-10-17");
  // 18/10 06:00 en Argentina = 09:00 UTC: ya es el 18
  assert.equal(diaDeNegocio("2026-10-18T09:00:00.000Z"), "2026-10-18");
});

test("etiquetaDia: día de la semana y fecha corta", () => {
  assert.equal(etiquetaDia("2026-10-17"), "Sáb 17/10");
  assert.equal(etiquetaDia("2026-10-19"), "Lun 19/10");
});

test("pizzasDeItems: enteras y mitad y mitad cuentan 1; empanadas y bebidas no", () => {
  assert.equal(pizzasDeItems([
    { name: "Fugazzetta", qty: 2, price: 1, type: "pizza" },
    { name: "Mitad A / Mitad B", qty: 1, price: 1, type: "pizza-half" },
    { name: "Caja x12", qty: 1, price: 1, type: "empanadas" },
    { name: "Coca-Cola", qty: 3, price: 1, type: "bebida" },
  ], pizzas), 3);
  // POS: sin type, se reconoce por el nombre de la carta o por "Mitad … / Mitad …"
  assert.equal(pizzasDeItems([
    { name: "Muzzarella Impasto", qty: 2, price: 1, type: "" },
    { name: "Mitad Fugazzetta / Mitad Muzzarella Impasto", qty: 1, price: 1, type: "" },
    { name: "Coca-Cola 1.5 L", qty: 1, price: 1, type: "" },
  ], pizzas), 3);
});

test("resumenPorDia: suma por noche y por medio de pago; deja afuera cancelados y MP sin aprobar", () => {
  const dias = resumenPorDia([
    pedido({ total: 20000, pago: "efectivo", items: [{ name: "Fugazzetta", qty: 1, price: 18000, type: "pizza" }] }),
    pedido({ total: 40000, pago: "transferencia", fecha: "2026-10-18T03:30:00.000Z", canal: "pos",
      items: [{ name: "Muzzarella Impasto", qty: 2, price: 16500, type: "" }] }),
    pedido({ total: 18000, pago: "mercadopago", pagoEstado: "aprobado", items: [{ name: "Fugazzetta", qty: 1, price: 18000, type: "pizza" }] }),
    pedido({ total: 99000, pago: "mercadopago", pagoEstado: "pendiente", items: [{ name: "Fugazzetta", qty: 5, price: 1, type: "pizza" }] }),
    pedido({ total: 99000, pago: "efectivo", estado: "cancelado", items: [{ name: "Fugazzetta", qty: 5, price: 1, type: "pizza" }] }),
    pedido({ total: 16500, pago: "efectivo", fecha: "2026-10-16T23:00:00.000Z", items: [{ name: "Muzzarella Impasto", qty: 1, price: 1, type: "pizza" }] }),
  ], carta);

  assert.deepEqual(dias.map((d) => d.dia), ["2026-10-17", "2026-10-16"]);
  const sabado = dias[0];
  assert.equal(sabado.pedidos, 3);
  assert.equal(sabado.pizzas, 4);
  assert.equal(sabado.pizzasWeb, 2);
  assert.equal(sabado.pizzasPos, 2);
  assert.equal(sabado.total, 78000);
  assert.deepEqual(sabado.medios.efectivo, { pedidos: 1, pizzas: 1, docenas: 0, total: 20000 });
  assert.deepEqual(sabado.medios.transferencia, { pedidos: 1, pizzas: 2, docenas: 0, total: 40000 });
  assert.deepEqual(sabado.medios.mercadopago, { pedidos: 1, pizzas: 1, docenas: 0, total: 18000 });
  assert.deepEqual(sabado.medios.otro, { pedidos: 0, pizzas: 0, docenas: 0, total: 0 });
});

test("adaptOrder: el canal sale de la referencia real (el POS no tiene IM-)", () => {
  assert.equal(adaptOrder({ id: "a", external_reference: "IM-123456-ABCD" }).canal, "web");
  assert.equal(adaptOrder({ id: "b", external_reference: "IM-MAN-1234" }).canal, "web");
  assert.equal(adaptOrder({ id: "c", external_reference: "POS-ABC" }).canal, "pos");
  assert.equal(adaptOrder({ id: "d", external_reference: "", numero_pedido: 3 }).canal, "pos");
});

test("docenasDeItems: una docena de empanadas es 1 unidad; la caja de 6 es media", () => {
  assert.equal(docenasDeItems([
    { name: "Caja x12", qty: 2, price: 1, type: "empanadas" },
    { name: "Caja x6", qty: 1, price: 1, type: "empanadas" },
    { name: "Caja x24", qty: 1, price: 1, type: "empanadas" },
    { name: "Fugazzetta", qty: 1, price: 1, type: "pizza" },
  ], carta.empanadas), 4.5);
  // POS: empanadas sueltas por nombre de la carta
  assert.equal(docenasDeItems([{ name: "Empanada de Carne", qty: 18, price: 1, type: "" }], carta.empanadas), 1.5);
});

test("resumenPorDia: unidades = pizzas + docenas, también por medio de pago", () => {
  const [dia] = resumenPorDia([
    pedido({ total: 50000, pago: "efectivo", items: [
      { name: "Fugazzetta", qty: 2, price: 1, type: "pizza" },
      { name: "Caja x12", qty: 1, price: 1, type: "empanadas" },
    ] }),
  ], carta);
  assert.equal(dia.pizzas, 2);
  assert.equal(dia.docenas, 1);
  assert.equal(dia.unidades, 3);
  assert.equal(dia.medios.efectivo.docenas, 1);
});

test("formatoUnidades: sin decimales salvo la media docena", () => {
  assert.equal(formatoUnidades(3), "3");
  assert.equal(formatoUnidades(2.5), "2,5");
});
