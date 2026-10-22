import assert from "node:assert/strict";
import { test } from "node:test";
import { comparacionNoche, masVendidas, nochesParaGrafico, restarDias } from "../lib/admin-dashboard";
import { resumenPorDia } from "../lib/resumen-diario";
import type { AdminOrder } from "../app/admin/components/types";

const carta = { pizzas: new Set(["Muzzarella Impasto", "Fugazzetta"]), empanadas: new Set(["Empanada de Carne"]) };
const pedido = (extra: Partial<AdminOrder>): AdminOrder => ({
  _dbId: Math.random().toString(36).slice(2), id: "IM-1", cliente: "", tel: "", mode: "takeaway", dir: "", zona: "",
  items: [], subtotal: 0, shipping: 0, total: 0, pago: "efectivo", pagoEstado: "aprobado", cambio: "", referencia: "",
  cuando: "asap", estado: "entregado", fecha: "2026-10-17T23:00:00.000Z", notas: "", canal: "web", ...extra,
});
// sáb 17/10 y sáb 10/10 a las 20:00 de Argentina; vie 16/10 a las 21:00
const orders = [
  pedido({ total: 30000, fecha: "2026-10-17T23:00:00.000Z", items: [{ name: "Fugazzetta", qty: 2, price: 15000, type: "pizza" }] }),
  pedido({ total: 20000, fecha: "2026-10-17T23:30:00.000Z", canal: "pos", items: [{ name: "Muzzarella Impasto", qty: 1, price: 16000, type: "" }, { name: "Coca-Cola", qty: 1, price: 4000, type: "" }] }),
  pedido({ total: 40000, fecha: "2026-10-10T23:00:00.000Z", items: [{ name: "Fugazzetta", qty: 1, price: 15000, type: "pizza" }, { name: "Caja x12", qty: 1, price: 25000, type: "empanadas" }] }),
  pedido({ total: 10000, fecha: "2026-10-17T00:00:00.000Z", items: [{ name: "Mitad Fugazzetta / Mitad Muzzarella Impasto", qty: 1, price: 10000, type: "pizza-half" }] }),
  pedido({ total: 99999, fecha: "2026-10-17T23:00:00.000Z", estado: "cancelado", items: [{ name: "Fugazzetta", qty: 9, price: 1, type: "pizza" }] }),
];
const dias = resumenPorDia(orders, carta);

test("restarDias", () => {
  assert.equal(restarDias("2026-10-17", 7), "2026-10-10");
  assert.equal(restarDias("2026-11-02", 7), "2026-10-26");
});

test("nochesParaGrafico: solo noches con ventas, de la más vieja a la más nueva", () => {
  assert.deepEqual(nochesParaGrafico(dias, 7).map((n) => [n.dia, n.total]), [["2026-10-10", 40000], ["2026-10-16", 10000], ["2026-10-17", 50000]]);
  assert.deepEqual(nochesParaGrafico(dias, 2).map((n) => n.dia), ["2026-10-16", "2026-10-17"]);
  assert.equal(nochesParaGrafico(dias, 7)[2].etiqueta, "Sáb 17/10");
});

test("comparacionNoche: esta noche contra la misma de la semana anterior", () => {
  assert.deepEqual(comparacionNoche(dias, "2026-10-17"), { actual: 50000, pedidos: 2, web: 1, pos: 1, anterior: 40000, pct: 25 });
  assert.deepEqual(comparacionNoche(dias, "2026-10-18"), { actual: 0, pedidos: 0, web: 0, pos: 0, anterior: null, pct: null });
});

test("masVendidas: pizzas y empanadas; bebidas y cancelados no; mitad y mitad aparte", () => {
  assert.deepEqual(masVendidas(orders, carta), [
    { nombre: "Fugazzetta", cantidad: 3 },
    { nombre: "Empanadas (docenas)", cantidad: 1 },
    { nombre: "Mitad y mitad", cantidad: 1 },
    { nombre: "Muzzarella Impasto", cantidad: 1 },
  ]);
  assert.equal(masVendidas(orders, carta, 1).length, 1);
});
