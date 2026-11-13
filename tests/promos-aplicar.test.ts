import assert from "node:assert/strict";
import { test } from "node:test";
import { aplicarPromo, esErrorPromo, nocheLocal, ofertasVigentes, promosAplicables, type LineaPromo } from "../lib/promos-aplicar";
import type { Oferta } from "../lib/promos";

const base = { descripcion: "", dias: [5, 6, 0], desde: null, hasta: null, orden: 0, estado: "aprobada" as const, aprobada_en: null, creada_en: "", actualizada_en: "" };
const duo: Oferta = { ...base, id: "duo", nombre: "Dúo Muzza", titulo: "Dúo Muzza", tipo: "combo", config: { precio: 26900, lugares: [{ cantidad: 2, productos: ["muzza"] }] } };
const noche: Oferta = { ...base, id: "noche", nombre: "Noche", titulo: "Noche Impasto", tipo: "combo", config: { precio: 55000, lugares: [
  { cantidad: 1, productos: ["muzza"] }, { cantidad: 1, productos: ["jamon"] }, { cantidad: 1, productos: ["napo", "fuga"] }, { cantidad: 1, productos: ["coca"] }] } };
const mitad: Oferta = { ...base, id: "mitad", nombre: "2ª al 50", titulo: "La segunda, a mitad de precio", tipo: "descuento_cantidad", config: { cada: 2, porcentaje: 50, productos: null } };
const regalo: Oferta = { ...base, id: "regalo", nombre: "Bebida de regalo", titulo: "+ Bebida de regalo", tipo: "regalo", config: { minimoPizzas: 2, cantidad: 1, opciones: [{ producto: "pepsi", suplemento: 0 }, { producto: "vino", suplemento: 0 }] } };
const L = (idx: number, productoId: string | null, tipo: LineaPromo["tipo"], precio: number, cantidad: number): LineaPromo => ({ idx, productoId, nombre: productoId ?? "mitad", tipo, precio, cantidad });
const bebidas = [{ id: "pepsi", nombre: "Pepsi 1.5 L", precio: 4500 }, { id: "vino", nombre: "Vino", precio: 7500 }];
const total = (r: ReturnType<typeof aplicarPromo>) => { assert.ok(!esErrorPromo(r)); return r.tramos.reduce((s, t) => s + t.precio * t.cantidad, 0) + (r.regalo ? r.regalo.precio * r.regalo.cantidad : 0); };

test("Dúo: 2 Muzzarellas a $26.900, el descuento queda dentro de las líneas", () => {
  const r = aplicarPromo(duo, [L(0, "muzza", "pizza", 15500, 2)]);
  assert.equal(total(r), 26900);
  assert.ok(!esErrorPromo(r)); assert.equal(r.ahorro, 4100); assert.equal(r.veces, 1);
  assert.ok(r.tramos.every(t => t.promo?.precioLista === 15500 && t.precio > 0));
});

test("Dúo: 3 Muzzarellas, una queda a precio normal; 4 = dos dúos", () => {
  assert.equal(total(aplicarPromo(duo, [L(0, "muzza", "pizza", 15500, 3)])), 26900 + 15500);
  const r = aplicarPromo(duo, [L(0, "muzza", "pizza", 15500, 4)]);
  assert.ok(!esErrorPromo(r)); assert.equal(r.veces, 2); assert.equal(total(r), 53800);
});

test("Combo incompleto da error y no cambia precios", () => {
  assert.ok(esErrorPromo(aplicarPromo(duo, [L(0, "muzza", "pizza", 15500, 1)])));
});

test("Noche Impasto: elige la especial más cara del pedido y suma exacto $55.000", () => {
  const r = aplicarPromo(noche, [L(0, "muzza", "pizza", 15500, 1), L(1, "jamon", "pizza", 18500, 1), L(2, "fuga", "pizza", 17000, 1), L(3, "napo", "pizza", 20000, 1), L(4, "coca", "bebida", 6500, 1)]);
  assert.ok(!esErrorPromo(r));
  assert.equal(r.ahorro, 15500 + 18500 + 20000 + 6500 - 55000);
  assert.equal(total(r), 55000 + 17000);
  assert.equal(r.tramos.find(t => t.idx === 2)!.promo, null);
});

test("2ª al 50 %: la más barata de cada par, mitades incluidas", () => {
  const r = aplicarPromo(mitad, [L(0, "prosciutto", "pizza", 24000, 1), L(1, "muzza", "pizza", 15500, 1)]);
  assert.ok(!esErrorPromo(r)); assert.equal(r.ahorro, 7750); assert.equal(total(r), 31750);
  const r3 = aplicarPromo(mitad, [L(0, "muzza", "pizza", 15500, 3), L(1, null, "mitad", 24000, 1)]);
  assert.ok(!esErrorPromo(r3)); assert.equal(r3.veces, 2); assert.equal(r3.ahorro, 7750 * 2);
  assert.ok(esErrorPromo(aplicarPromo(mitad, [L(0, "muzza", "pizza", 15500, 1), L(1, "pepsi", "bebida", 4500, 1)])));
});

test("Regalo: la bebida que el cliente sumó queda gratis; sin bebida avisa; con 1 pizza avisa", () => {
  const conPepsi = [L(0, "muzza", "pizza", 15500, 2), L(1, "pepsi", "bebida", 4500, 1)];
  const r = aplicarPromo(regalo, conPepsi, bebidas);
  assert.ok(!esErrorPromo(r)); assert.equal(r.regalo, null); assert.equal(r.ahorro, 4500); assert.equal(total(r), 31000);
  assert.equal(r.tramos.find(t => t.idx === 1)!.precio, 0);
  // Con dos bebidas, regala la que más ahorra (el vino) y cobra la otra.
  const dos = aplicarPromo(regalo, [...conPepsi, L(2, "vino", "bebida", 7500, 1)], bebidas);
  assert.ok(!esErrorPromo(dos)); assert.equal(dos.ahorro, 7500); assert.equal(total(dos), 31000 + 4500);
  assert.match((aplicarPromo(regalo, [L(0, "muzza", "pizza", 15500, 2)], bebidas) as { error: string }).error, /Agregá una bebida/);
  assert.match((aplicarPromo(regalo, [L(0, "muzza", "pizza", 15500, 1), L(1, "pepsi", "bebida", 4500, 1)], bebidas) as { error: string }).error, /Sumá 1 pizza/);
  // Una bebida que no está entre las opciones no se regala.
  assert.ok(esErrorPromo(aplicarPromo(regalo, [L(0, "muzza", "pizza", 15500, 2), L(1, "agua", "bebida", 2000, 1)], bebidas)));
});

test("Vigencia: aprobada, día de la noche de negocio (corte 06:00) y fechas", () => {
  assert.deepEqual(nocheLocal(new Date("2026-11-14T03:30:00Z")), { fecha: "2026-11-13", dia: 5 }); // sáb 00:30 AR = noche del viernes
  const vie = new Date("2026-11-13T23:00:00Z");
  assert.deepEqual(ofertasVigentes([duo, { ...duo, id: "p", estado: "pendiente" as const }, { ...duo, id: "x", hasta: "2026-11-12" }, { ...duo, id: "l", dias: [1] }], vie).map(o => o.id), ["duo"]);
});

test("promosAplicables ordena por ahorro: la primera se aplica sola", () => {
  const r = promosAplicables([duo, mitad, regalo], [L(0, "muzza", "pizza", 15500, 2), L(1, "vino", "bebida", 7500, 1)], bebidas, new Date("2026-11-13T23:00:00Z"));
  assert.deepEqual(r.map(x => [x.oferta.id, x.resultado.ahorro]), [["mitad", 7750], ["regalo", 7500], ["duo", 4100]]);
});

test("No se acumulan: Dúo con 2 Muzzarellas + Pepsi cobra la Pepsi entera; el regalo con Muzzarellas a lista", () => {
  const pedido = [L(0, "muzza", "pizza", 15500, 2), L(1, "pepsi", "bebida", 4500, 1)];
  const conDuo = aplicarPromo(duo, pedido, bebidas);
  assert.ok(!esErrorPromo(conDuo));
  assert.equal(conDuo.tramos.find(t => t.idx === 1)!.precio, 4500, "la bebida no queda gratis si ya se aplicó el Dúo");
  assert.equal(total(conDuo), 26900 + 4500);
  const conRegalo = aplicarPromo(regalo, pedido, bebidas);
  assert.ok(!esErrorPromo(conRegalo));
  assert.ok(conRegalo.tramos.filter(t => t.idx === 0).every(t => t.precio === 15500), "las pizzas van a lista si se regala la bebida");
  assert.equal(total(conRegalo), 31000);
  // Las dos aplican, pero el pedido se cobra con UNA: la primera de la lista (la de más ahorro).
  const opciones = promosAplicables([duo, regalo], pedido, bebidas, new Date("2026-11-13T23:00:00Z"));
  assert.deepEqual(opciones.map(o => o.oferta.id), ["regalo", "duo"]);
});

test("Regalo con pizzas excluidas: la Muzzarella no cuenta; la mitad y mitad cuenta salvo que sea toda excluida", () => {
  const sinMuzza: Oferta = { ...regalo, config: { ...regalo.config, excluidas: ["muzza"] } };
  const pepsi = L(9, "pepsi", "bebida", 4500, 1);
  const r1 = aplicarPromo(sinMuzza, [L(0, "muzza", "pizza", 15500, 2), pepsi], bebidas);
  assert.ok(esErrorPromo(r1)); assert.match(r1.error, /La muzza no entra en el regalo: sumá 2 pizzas más/);
  const r2 = aplicarPromo(sinMuzza, [L(0, "muzza", "pizza", 15500, 1), L(1, "fuga", "pizza", 17000, 1), pepsi], bebidas);
  assert.ok(esErrorPromo(r2)); assert.match(r2.error, /sumá 1 pizza más/);
  const r3 = aplicarPromo(sinMuzza, [L(1, "fuga", "pizza", 17000, 2), pepsi], bebidas);
  assert.ok(!esErrorPromo(r3)); assert.equal(r3.ahorro, 4500);
  const mitad = (ids: [string, string]): LineaPromo => ({ ...L(2, null, "mitad", 19500, 1), mitades: ids });
  assert.ok(!esErrorPromo(aplicarPromo(sinMuzza, [L(1, "fuga", "pizza", 17000, 1), mitad(["muzza", "napo"]), pepsi], bebidas)));
  assert.ok(esErrorPromo(aplicarPromo(sinMuzza, [L(1, "fuga", "pizza", 17000, 1), mitad(["muzza", "muzza"]), pepsi], bebidas)));
});
