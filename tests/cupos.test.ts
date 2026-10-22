import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CupoAgotadoError, aplicarCupos, avisoQuedan, cantidadCliente, consumoDeItems, errorDeCupoDeLaBase, validarCupos,
} from "../lib/cupos";
import type { CartItem, CatalogData, Pizza } from "../types";

const pizza = (id: string, nombre: string, extra: Partial<Pizza> = {}): Pizza =>
  ({ id, nombre, categoria: "clasica", precio: 1, desc: "", tags: [], disponible: true, ...extra });

const catalogo = (pizzas: Pizza[]) => ({
  pizzas, empanadas: [], bebidas: [], empanadaBoxPrices: { 6: 0, 12: 0, 24: 0 }, promos: [], reviews: [],
} as CatalogData);

const linea = (extra: Partial<CartItem>): CartItem =>
  ({ key: "f", cartId: "1", type: "pizza", name: "Fugazzetta", price: 1, qty: 1, ...extra });

test("aplicarCupos: guarda lo que queda y agota en 0; sin fila, sin límite", () => {
  const c = aplicarCupos(catalogo([pizza("f", "Fugazzetta"), pizza("r", "Rucola"), pizza("m", "Muzza")]), [
    { producto_id: "f", cupo_mitades: 3, vendidas_mitades: 2 },
    { producto_id: "r", cupo_mitades: 4, vendidas_mitades: 5 },
  ]);
  assert.equal(c.pizzas[0].quedanMitades, 1);
  assert.equal(c.pizzas[0].disponible, true);
  assert.equal(c.pizzas[1].quedanMitades, 0);
  assert.equal(c.pizzas[1].disponible, false);
  assert.equal(c.pizzas[2].quedanMitades, undefined);
});

test("aplicarCupos: no revive una pizza que el panel marcó agotada", () => {
  const c = aplicarCupos(catalogo([pizza("f", "Fugazzetta", { disponible: false })]), [{ producto_id: "f", cupo_mitades: 4, vendidas_mitades: 0 }]);
  assert.equal(c.pizzas[0].disponible, false);
});

test("consumoDeItems: entera 2 mitades; mitad y mitad 1 de cada sabor", () => {
  const consumo = consumoDeItems([
    linea({ qty: 2 }),
    linea({ type: "pizza-half", key: "half-f-m", qty: 1, variant: { kind: "half", ids: ["f", "m"] } }),
    linea({ type: "bebida", key: "b" }),
  ]);
  assert.deepEqual([...consumo.entries()], [["f", 5], ["m", 1]]);
});

test("validarCupos: frena cuando lo pedido pasa lo que queda", () => {
  const c = catalogo([pizza("f", "Fugazzetta", { quedanMitades: 3 })]);
  assert.doesNotThrow(() => validarCupos([linea({ qty: 1 }), linea({ type: "pizza-half", key: "h", variant: { kind: "half", ids: ["f", "x"] } })], c));
  assert.throws(() => validarCupos([linea({ qty: 2 })], c), (e: unknown) =>
    e instanceof CupoAgotadoError && e.message === "De la Fugazzetta quedan 1 y media por esta noche. Bajá la cantidad para seguir.");
});

test("errorDeCupoDeLaBase: traduce el error de crear_pedido_costeado", () => {
  const e = errorDeCupoDeLaBase({ message: "CUPO_AGOTADO|Fugazzetta|1" });
  assert.ok(e instanceof CupoAgotadoError);
  assert.equal(e?.message, "De la Fugazzetta queda solo media: pedila en una mitad y mitad.");
  assert.equal(errorDeCupoDeLaBase({ message: "CUPO_AGOTADO|Rucola|0" })?.message, "Se agotó la Rucola por esta noche. Sacala del carrito para seguir.");
  assert.equal(errorDeCupoDeLaBase({ message: "otra cosa" }), null);
  assert.equal(errorDeCupoDeLaBase(null), null);
});

test("avisoQuedan y cantidadCliente: textos para el cliente", () => {
  assert.equal(avisoQuedan(undefined), null);
  assert.equal(avisoQuedan(0), null);
  assert.equal(avisoQuedan(1), "¡Queda la última media de la noche!");
  assert.equal(avisoQuedan(2), "¡Queda solo 1 esta noche!");
  assert.equal(avisoQuedan(3), "¡Quedan solo 1 y media esta noche!");
  assert.equal(avisoQuedan(4), "¡Quedan solo 2 esta noche!");
  assert.equal(avisoQuedan(5), null);
  assert.equal(avisoQuedan(4, true), "¡Quedan 2!");
  assert.equal(avisoQuedan(3, true), "¡Quedan 1½!");
  assert.equal(avisoQuedan(2, true), "¡Queda 1!");
  assert.equal(avisoQuedan(1, true), "¡Última ½!");
  assert.equal(cantidadCliente(5), "2 y media");
});

test("mitadesDesdePizzas: de a media pizza, con coma o punto", async () => {
  const { mitadesDesdePizzas } = await import("../lib/cupos");
  assert.equal(mitadesDesdePizzas(1.5), 3);
  assert.equal(mitadesDesdePizzas("1,5"), 3);
  assert.equal(mitadesDesdePizzas("0"), 0);
  assert.equal(mitadesDesdePizzas(1.25), null);
  assert.equal(mitadesDesdePizzas(-1), null);
  assert.equal(mitadesDesdePizzas("dos"), null);
});

test("quedanPizzas y pasoCupo: 100 por defecto, de a media entre 0 y 100", async () => {
  const { quedanPizzas, pasoCupo } = await import("../lib/cupos");
  assert.equal(quedanPizzas(undefined), 100);
  assert.equal(quedanPizzas({ producto_id: "f", cupo_mitades: 5, vendidas_mitades: 2 }), 1.5);
  assert.equal(quedanPizzas({ producto_id: "f", cupo_mitades: 2, vendidas_mitades: 3 }), 0);
  assert.equal(pasoCupo(100, -1), 99.5);
  assert.equal(pasoCupo(100, 1), 100);
  assert.equal(pasoCupo(0, -1), 0);
  assert.equal(pasoCupo(1.5, 1), 2);
});
