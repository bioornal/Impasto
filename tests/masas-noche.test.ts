import assert from "node:assert/strict";
import { test } from "node:test";
import { estadoMasas } from "../lib/masa";
import {
  MasasAgotadasError, aplicarMasas, avisoMasas, avisoOtraMasa, conMasasDeLaNoche, errorDeMasasDeLaBase, esMasa, excesoEnCarrito, masaParaSumar, masasDesdeTexto, pizzasPorMasa, quedanMasas, topeDePizzas, validarMasasNoche,
} from "../lib/masas-noche";
import type { CartItem, CatalogData, Pizza } from "../types";

const pizza = (id: string, extra: Partial<Pizza> = {}): Pizza =>
  ({ id, nombre: id, categoria: "clasica", precio: 1, desc: "", tags: [], disponible: true, ...extra });

const catalogo = (pizzas: Pizza[], extra: Partial<CatalogData> = {}) => ({
  pizzas, empanadas: [], bebidas: [], empanadaBoxPrices: { 6: 0, 12: 0, 24: 0 }, promos: [], reviews: [], ...extra,
} as CatalogData);

const linea = (extra: Partial<CartItem>): CartItem =>
  ({ key: "f", cartId: "1", type: "pizza", name: "Fugazzetta", price: 1, qty: 1, ...extra });

const quedan = (napoletana: number, molde: number) => ({ napoletana, molde });

test("quedanMasas: sin filas o sin cargar, sin límite; una sola cargada, la otra vale 0; nunca negativo", () => {
  assert.equal(quedanMasas(undefined), null);
  assert.equal(quedanMasas([]), null);
  assert.equal(quedanMasas([{ masa: "napoletana", cupo: null, vendidas: 7 }, { masa: "molde", cupo: null, vendidas: 2 }]), null);
  assert.deepEqual(quedanMasas([{ masa: "napoletana", cupo: 30, vendidas: 12 }]), quedan(18, 0));
  assert.deepEqual(quedanMasas([{ masa: "napoletana", cupo: null, vendidas: 1 }, { masa: "molde", cupo: 5, vendidas: 6 }]), quedan(0, 0));
  assert.deepEqual(quedanMasas([{ masa: "napoletana", cupo: 10, vendidas: 2 }, { masa: "molde", cupo: 5, vendidas: 1 }]), quedan(8, 4));
});

test("conMasasDeLaNoche: el número manda sobre el interruptor; sin números, mandan los interruptores", () => {
  const config = { masaNapoletanaActiva: true, masaMoldeActiva: false };
  assert.equal(conMasasDeLaNoche(config, null), config);
  assert.equal(estadoMasas(conMasasDeLaNoche(config, quedan(8, 3))).molde, true);
  assert.equal(estadoMasas(conMasasDeLaNoche({ ...config, masaMoldeActiva: true }, quedan(8, 0))).molde, false);
  const sinNapoletana = estadoMasas(conMasasDeLaNoche(config, quedan(0, 3)));
  assert.equal(sinNapoletana.napoletana, false);
  assert.match(sinNapoletana.aviso, /todas las pizzas salen al molde/);
});

test("aplicarMasas: sin límite no cambia nada; solo con las dos en 0 se agotan las pizzas", () => {
  const base = catalogo([pizza("f"), pizza("r")]);
  assert.equal(aplicarMasas(base, null), base);
  const conMolde = aplicarMasas(base, quedan(0, 3));
  assert.deepEqual(conMolde.masasQuedan, quedan(0, 3));
  assert.equal(conMolde.pizzas[0].disponible, true);
  const sinMasas = aplicarMasas(base, quedan(0, 0));
  assert.ok(sinMasas.pizzas.every((p) => p.disponible === false));
});

test("pizzasPorMasa: una masa por pizza, entera o mitad y mitad; sin elegir es napoletana; lo demás no cuenta", () => {
  assert.deepEqual(pizzasPorMasa([
    linea({ qty: 2 }),
    linea({ type: "pizza-half", qty: 1, masa: "molde" }),
    linea({ qty: 3, masa: "molde" }),
    linea({ type: "empanadas", qty: 4 }),
    linea({ type: "bebida", qty: 5 }),
  ]), { napoletana: 2, molde: 4 });
});

test("masaParaSumar: la que corresponde si entra; si no, la otra; si no, ninguna", () => {
  const items = [linea({ qty: 2 })];
  assert.equal(masaParaSumar(items, "napoletana", 1, null), "napoletana");
  assert.equal(masaParaSumar(items, "napoletana", 1, quedan(3, 0)), "napoletana");
  assert.equal(masaParaSumar(items, "napoletana", 1, quedan(2, 4)), "molde");
  assert.equal(masaParaSumar(items, "napoletana", 2, quedan(3, 1)), null);
  assert.equal(masaParaSumar(items, "molde", 1, quedan(5, 0)), "napoletana");
});

test("avisoOtraMasa: dice a qué masa fue la pizza", () => {
  assert.equal(avisoOtraMasa("molde"), "Esta pizza va al molde: no quedan más napoletanas.");
  assert.equal(avisoOtraMasa("napoletana"), "Esta pizza va con masa napoletana: no quedan más al molde.");
});

test("validarMasasNoche: frena por masa, no por el total", () => {
  const items = [linea({ qty: 2, masa: "molde" })];
  assert.doesNotThrow(() => validarMasasNoche(items, catalogo([pizza("f")])));
  assert.doesNotThrow(() => validarMasasNoche(items, catalogo([pizza("f")], { masasQuedan: quedan(0, 2) })));
  assert.doesNotThrow(() => validarMasasNoche([linea({ type: "bebida" })], catalogo([], { masasQuedan: quedan(0, 0) })));
  assert.throws(() => validarMasasNoche(items, catalogo([pizza("f")], { masasQuedan: quedan(9, 1) })), (e: unknown) =>
    e instanceof MasasAgotadasError && e.masa === "molde" && e.message === "Esta noche nos queda solo 1 pizza al molde. Bajá la cantidad o cambiá la masa para seguir.");
  assert.throws(() => validarMasasNoche([linea({ qty: 1 })], catalogo([], { masasQuedan: quedan(0, 0) })), (e: unknown) =>
    e instanceof MasasAgotadasError && e.message === "Por esta noche se terminaron las pizzas. Sacalas del carrito para seguir.");
});

test("MasasAgotadasError: textos para el cliente", () => {
  assert.equal(new MasasAgotadasError(0, "molde").message, "Por esta noche se terminó la masa al molde. Cambiala en el carrito o sacá esas pizzas para seguir.");
  assert.equal(new MasasAgotadasError(1, "napoletana").message, "Esta noche nos queda solo 1 pizza napoletana. Bajá la cantidad o cambiá la masa para seguir.");
  assert.equal(new MasasAgotadasError(3, "napoletana").message, "Esta noche nos quedan solo 3 pizzas napoletanas. Bajá la cantidad o cambiá la masa para seguir.");
  assert.equal(new MasasAgotadasError(3, "molde").message, "Esta noche nos quedan solo 3 pizzas al molde. Bajá la cantidad o cambiá la masa para seguir.");
});

test("errorDeMasasDeLaBase: traduce el error de crear_pedido_costeado", () => {
  const e = errorDeMasasDeLaBase({ message: "MASAS_AGOTADAS|2|molde" });
  assert.ok(e instanceof MasasAgotadasError);
  assert.equal(e?.quedan, 2);
  assert.equal(e?.masa, "molde");
  assert.equal(errorDeMasasDeLaBase({ message: "CUPO_AGOTADO|Rucola|0" }), null);
  assert.equal(errorDeMasasDeLaBase(null), null);
});

test("avisoMasas: por masa, con 3 o menos; la masa terminada no se nombra", () => {
  assert.equal(avisoMasas(undefined), null);
  assert.equal(avisoMasas(null), null);
  assert.equal(avisoMasas(quedan(4, 9)), null);
  assert.equal(avisoMasas(quedan(9, 0)), null);
  assert.equal(avisoMasas(quedan(3, 9)), "¡Quedan solo 3 pizzas napoletanas esta noche!");
  assert.equal(avisoMasas(quedan(9, 2)), "¡Quedan solo 2 pizzas al molde esta noche!");
  assert.equal(avisoMasas(quedan(0, 1)), "¡Queda la última pizza al molde de la noche!");
  assert.equal(avisoMasas(quedan(1, 9)), "¡Queda la última pizza napoletana de la noche!");
  assert.equal(avisoMasas(quedan(2, 1)), "¡Quedan solo 2 napoletanas y 1 al molde esta noche!");
  assert.equal(avisoMasas(quedan(1, 3)), "¡Quedan solo 1 napoletana y 3 al molde esta noche!");
  assert.equal(avisoMasas(quedan(0, 0)), "Por esta noche se terminaron las pizzas.");
  assert.equal(avisoMasas(quedan(0, 0), true), "Por esta noche se terminaron las pizzas. Todavía podés pedir empanadas.");
});

test("topeDePizzas: el carrito no suma más pizzas de una masa que las que quedan", () => {
  const tres = [linea({ qty: 3 })];
  assert.equal(topeDePizzas(tres, "napoletana", 1, null), null);
  assert.equal(topeDePizzas(tres, "napoletana", 1, quedan(4, 0)), null);
  assert.equal(topeDePizzas(tres, "molde", 1, quedan(3, 1)), null);
  assert.equal(topeDePizzas(tres, "napoletana", 1, quedan(3, 5)), "Esta noche nos quedan solo 3 pizzas napoletanas: no se pueden sumar más.");
  assert.equal(topeDePizzas([linea({ masa: "molde" })], "molde", 1, quedan(5, 1)), "Esta noche nos queda solo 1 pizza al molde: no se pueden sumar más.");
  assert.equal(topeDePizzas([], "molde", 1, quedan(5, 0)), "Por esta noche se terminó la masa al molde.");
  assert.equal(topeDePizzas([], "napoletana", 1, quedan(0, 0)), "Por esta noche se terminaron las pizzas.");
});

test("excesoEnCarrito: si el carrito ya tiene de más, cuántas sacar o pasar a la otra masa", () => {
  const cinco = [linea({ qty: 5, masa: "molde" })];
  assert.equal(excesoEnCarrito(cinco, null), null);
  assert.equal(excesoEnCarrito(cinco, quedan(0, 5)), null);
  assert.equal(excesoEnCarrito(cinco, quedan(0, 4)), "Esta noche nos quedan solo 4 pizzas al molde. Sacá 1 del pedido para seguir.");
  assert.equal(excesoEnCarrito(cinco, quedan(1, 4)), "Esta noche nos quedan solo 4 pizzas al molde. Pasá 1 a napoletana o sacala del pedido para seguir.");
  assert.equal(excesoEnCarrito(cinco, quedan(3, 2)), "Esta noche nos quedan solo 2 pizzas al molde. Pasá 3 a napoletana o sacalas del pedido para seguir.");
  assert.equal(excesoEnCarrito([linea({ qty: 2 })], quedan(0, 0)), "Por esta noche se terminaron las pizzas. Sacalas del pedido para seguir.");
  assert.equal(excesoEnCarrito([linea({ qty: 2, masa: "molde" })], quedan(1, 0)), "Por esta noche se terminó la masa al molde. Sacá 2 del pedido para seguir.");
});

test("masasDesdeTexto y esMasa: lo que carga el panel", () => {
  assert.equal(masasDesdeTexto(""), null);
  assert.equal(masasDesdeTexto(null), null);
  assert.equal(masasDesdeTexto("  "), null);
  assert.equal(masasDesdeTexto("40"), 40);
  assert.equal(masasDesdeTexto(0), 0);
  assert.equal(masasDesdeTexto(2000), 2000);
  assert.equal(masasDesdeTexto(2001), undefined);
  assert.equal(masasDesdeTexto("-1"), undefined);
  assert.equal(masasDesdeTexto("1.5"), undefined);
  assert.equal(masasDesdeTexto("abc"), undefined);
  assert.equal(esMasa("molde"), true);
  assert.equal(esMasa("napoletana"), true);
  assert.equal(esMasa("otra"), false);
  assert.equal(esMasa(null), false);
});
