import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MasasAgotadasError, aplicarMasas, avisoMasas, errorDeMasasDeLaBase, excesoEnCarrito, topeDePizzas, masasDesdeTexto, pizzasDelCarrito, quedanMasas, validarMasasNoche,
} from "../lib/masas-noche";
import type { CartItem, CatalogData, Pizza } from "../types";

const pizza = (id: string, extra: Partial<Pizza> = {}): Pizza =>
  ({ id, nombre: id, categoria: "clasica", precio: 1, desc: "", tags: [], disponible: true, ...extra });

const catalogo = (pizzas: Pizza[], extra: Partial<CatalogData> = {}) => ({
  pizzas, empanadas: [], bebidas: [], empanadaBoxPrices: { 6: 0, 12: 0, 24: 0 }, promos: [], reviews: [], ...extra,
} as CatalogData);

const linea = (extra: Partial<CartItem>): CartItem =>
  ({ key: "f", cartId: "1", type: "pizza", name: "Fugazzetta", price: 1, qty: 1, ...extra });

test("quedanMasas: sin fila o sin cupo, sin límite; nunca negativo", () => {
  assert.equal(quedanMasas(undefined), null);
  assert.equal(quedanMasas({ cupo: null, vendidas: 7 }), null);
  assert.equal(quedanMasas({ cupo: 30, vendidas: 12 }), 18);
  assert.equal(quedanMasas({ cupo: 5, vendidas: 6 }), 0);
});

test("aplicarMasas: sin límite no cambia nada; en 0 agota todas las pizzas", () => {
  const base = catalogo([pizza("f"), pizza("m")]);
  assert.equal(aplicarMasas(base, null), base);
  const quedan3 = aplicarMasas(base, 3);
  assert.equal(quedan3.masasQuedan, 3);
  assert.ok(quedan3.pizzas.every((p) => p.disponible));
  const sinMasas = aplicarMasas(base, 0);
  assert.equal(sinMasas.masasQuedan, 0);
  assert.ok(sinMasas.pizzas.every((p) => !p.disponible));
});

test("pizzasDelCarrito: una masa por pizza, entera o mitad y mitad; lo demás no cuenta", () => {
  assert.equal(pizzasDelCarrito([
    linea({ qty: 2 }),
    linea({ type: "pizza-half", key: "h", qty: 1, variant: { kind: "half", ids: ["f", "m"] } }),
    linea({ type: "bebida", key: "b", qty: 3 }),
    linea({ type: "empanadas", key: "e", qty: 1 }),
  ]), 3);
});

test("validarMasasNoche: frena cuando el carrito pasa las masas que quedan", () => {
  const items = [linea({ qty: 2 })];
  assert.doesNotThrow(() => validarMasasNoche(items, catalogo([pizza("f")])));
  assert.doesNotThrow(() => validarMasasNoche(items, catalogo([pizza("f")], { masasQuedan: 2 })));
  assert.doesNotThrow(() => validarMasasNoche([linea({ type: "bebida" })], catalogo([], { masasQuedan: 0 })));
  assert.throws(() => validarMasasNoche(items, catalogo([pizza("f")], { masasQuedan: 1 })), (e: unknown) =>
    e instanceof MasasAgotadasError && e.message === "Esta noche nos queda solo 1 pizza. Bajá la cantidad para seguir.");
});

test("MasasAgotadasError: textos para el cliente", () => {
  assert.equal(new MasasAgotadasError(0).message, "Por esta noche se terminaron las pizzas. Sacalas del carrito para seguir.");
  assert.equal(new MasasAgotadasError(1).message, "Esta noche nos queda solo 1 pizza. Bajá la cantidad para seguir.");
  assert.equal(new MasasAgotadasError(3).message, "Esta noche nos quedan solo 3 pizzas. Bajá la cantidad para seguir.");
});

test("errorDeMasasDeLaBase: traduce el error de crear_pedido_costeado", () => {
  const e = errorDeMasasDeLaBase({ message: "MASAS_AGOTADAS|2" });
  assert.ok(e instanceof MasasAgotadasError);
  assert.equal(e?.quedan, 2);
  assert.equal(errorDeMasasDeLaBase({ message: "CUPO_AGOTADO|Rucola|0" }), null);
  assert.equal(errorDeMasasDeLaBase(null), null);
});

test("avisoMasas: solo con 3 o menos, o sin masas", () => {
  assert.equal(avisoMasas(undefined), null);
  assert.equal(avisoMasas(4), null);
  assert.equal(avisoMasas(3), "¡Quedan solo 3 pizzas esta noche!");
  assert.equal(avisoMasas(1), "¡Queda la última pizza de la noche!");
  assert.equal(avisoMasas(0), "Por esta noche se terminaron las pizzas.");
  assert.equal(avisoMasas(0, true), "Por esta noche se terminaron las pizzas. Todavía podés pedir empanadas.");
});

test("topeDePizzas: el carrito no suma más pizzas que las masas que quedan", () => {
  assert.equal(topeDePizzas(3, 1, null), null);
  assert.equal(topeDePizzas(3, 1, 4), null);
  assert.equal(topeDePizzas(4, 1, 4), "Esta noche nos quedan solo 4 pizzas: no se pueden sumar más.");
  assert.equal(topeDePizzas(0, 1, 1), null);
  assert.equal(topeDePizzas(1, 1, 1), "Esta noche nos queda solo 1 pizza: no se pueden sumar más.");
  assert.equal(topeDePizzas(0, 1, 0), "Por esta noche se terminaron las pizzas.");
});

test("excesoEnCarrito: si el carrito ya tiene de más, cuántas sacar", () => {
  assert.equal(excesoEnCarrito(5, null), null);
  assert.equal(excesoEnCarrito(4, 4), null);
  assert.equal(excesoEnCarrito(5, 4), "Esta noche nos quedan solo 4 pizzas. Sacá 1 del pedido para seguir.");
  assert.equal(excesoEnCarrito(6, 1), "Esta noche nos queda solo 1 pizza. Sacá 5 del pedido para seguir.");
  assert.equal(excesoEnCarrito(2, 0), "Por esta noche se terminaron las pizzas. Sacalas del pedido para seguir.");
});

test("masasDesdeTexto: enteros de 0 a 2000; vacío es sin límite", () => {
  assert.equal(masasDesdeTexto("40"), 40);
  assert.equal(masasDesdeTexto(0), 0);
  assert.equal(masasDesdeTexto(" 12 "), 12);
  assert.equal(masasDesdeTexto(""), null);
  assert.equal(masasDesdeTexto(null), null);
  assert.equal(masasDesdeTexto("1,5"), undefined);
  assert.equal(masasDesdeTexto(-1), undefined);
  assert.equal(masasDesdeTexto(2001), undefined);
  assert.equal(masasDesdeTexto("abc"), undefined);
});
