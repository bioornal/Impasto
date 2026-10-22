import assert from "node:assert/strict";
import { test } from "node:test";
import { TODAS_LAS_MASAS, ajustarMasas, cambiarMasa, contarMasas, detalleCocina, esMismaLinea, estadoMasas, masaDe, masaUnica, nombreCocina, normalizarMasa, validarMasas } from "../lib/masa";
import { quoteItemsWithCatalog } from "../lib/order-quote";
import type { CartItem, CatalogData } from "../types";

const catalog = {
  pizzas: [
    { id: "p", nombre: "Muzza", precio: 9000, disponible: true },
    { id: "q", nombre: "Fugazza", precio: 9500, disponible: true },
  ],
  empanadas: [], bebidas: [{ id: "b", nombre: "Agua", precio: 2000, disponible: true }],
  empanadaBoxPrices: { 6: 0, 12: 0, 24: 0 }, promos: [], reviews: [],
} as unknown as CatalogData;

const pizza = (extra: Partial<CartItem> = {}): CartItem =>
  ({ key: "p", cartId: "1", type: "pizza", name: "Muzza", price: 9000, qty: 1, ...extra });

test("normalizarMasa: solo 'molde' es molde; lo demás es napoletana", () => {
  assert.equal(normalizarMasa("molde"), "molde");
  assert.equal(normalizarMasa("napoletana"), "napoletana");
  assert.equal(normalizarMasa(undefined), "napoletana");
  assert.equal(normalizarMasa("MOLDE<script>"), "napoletana");
});

test("quote: la pizza guarda la masa y al molde lo dice en el detalle, al mismo precio", () => {
  const [napo] = quoteItemsWithCatalog([pizza()], catalog);
  assert.equal(napo.masa, "napoletana");
  assert.equal(napo.detail, undefined);
  const [molde] = quoteItemsWithCatalog([pizza({ masa: "molde" })], catalog);
  assert.equal(molde.masa, "molde");
  assert.equal(molde.detail, "Masa al molde");
  assert.equal(molde.price, 9000);
});

test("quote: un detalle inventado por el cliente no llega al pedido", () => {
  const [item] = quoteItemsWithCatalog([pizza({ detail: "sin cebolla gratis" })], catalog);
  assert.equal(item.detail, undefined);
});

test("quote: la mitad y mitad también lleva masa", () => {
  const half: CartItem = { key: "half-p-q", cartId: "2", type: "pizza-half", name: "x", price: 1, qty: 1,
    variant: { kind: "half", ids: ["p", "q"] }, masa: "molde" };
  const [item] = quoteItemsWithCatalog([half], catalog);
  assert.equal(item.masa, "molde");
  assert.equal(item.detail, "Pizza mitad y mitad · Masa al molde");
  const [napo] = quoteItemsWithCatalog([{ ...half, masa: undefined }], catalog);
  assert.equal(napo.detail, "Pizza mitad y mitad");
});

test("quote: las bebidas no llevan masa", () => {
  const [item] = quoteItemsWithCatalog([{ key: "b", cartId: "3", type: "bebida", name: "Agua", price: 2000, qty: 1, masa: "molde" }], catalog);
  assert.equal(item.masa, undefined);
});

test("esMismaLinea: misma pizza con otra masa es otra línea", () => {
  assert.equal(esMismaLinea(pizza(), pizza({ masa: "napoletana" })), true);
  assert.equal(esMismaLinea(pizza(), pizza({ masa: "molde" })), false);
});

test("cambiarMasa: cambia la línea entera o la junta con la que ya tiene esa masa", () => {
  const a = pizza({ cartId: "a", qty: 2 });
  assert.deepEqual(cambiarMasa([a], "a", "molde"), [{ ...a, masa: "molde" }]);
  const b = pizza({ cartId: "b", qty: 1, masa: "molde" });
  const juntas = cambiarMasa([a, b], "a", "molde");
  assert.equal(juntas.length, 1);
  assert.equal(juntas[0].cartId, "b");
  assert.equal(juntas[0].qty, 3);
});

test("cocina: la masa va en el nombre, en mayúsculas, y sale del detalle", () => {
  assert.equal(masaDe(pizza({ masa: "molde" })), "molde");
  assert.equal(masaDe({ type: "bebida" }), undefined);
  assert.equal(nombreCocina({ name: "Muzza", type: "pizza", masa: "molde" }), "Muzza [AL MOLDE]");
  assert.equal(nombreCocina({ name: "Muzza", type: "pizza", masa: "napoletana" }), "Muzza [NAPOLETANA]");
  assert.equal(nombreCocina({ name: "Mitad A / Mitad B", type: "pizza-half", masa: "molde" }), "Mitad A / Mitad B [AL MOLDE]");
  // Pedidos de antes de poder elegir: no se inventa la masa.
  assert.equal(nombreCocina({ name: "Muzza", type: "pizza" }), "Muzza");
  assert.equal(nombreCocina({ name: "Caja x6", type: "empanadas", masa: "molde" }), "Caja x6");
  assert.equal(detalleCocina({ detail: "Masa al molde" }), "");
  assert.equal(detalleCocina({ detail: "Pizza mitad y mitad · Masa al molde" }), "Pizza mitad y mitad");
  assert.equal(detalleCocina({ detail: "6× Carne" }), "6× Carne");
});

test("contarMasas: suma unidades de pizzas que traen masa; las viejas no cuentan", () => {
  const conteo = contarMasas([
    { items: [{ type: "pizza", qty: 2, masa: "napoletana" }, { type: "pizza-half", qty: 1, masa: "molde" }, { type: "bebida", qty: 3 }] },
    { items: [{ type: "pizza", qty: 1, masa: "molde" }, { type: "pizza", qty: 5 }] },
  ]);
  assert.deepEqual(conteo, { napoletana: 2, molde: 2 });
});

test("cocina: el panel conserva la masa; la comanda y el aviso nombran las dos masas", async () => {
  const { adaptOrder } = await import("../lib/adapt-order");
  const { adminPrintJob } = await import("../lib/admin-print-job");
  const { plantillaLocal } = await import("../lib/aviso-local");
  const productos = [
    { name: "Muzza", qty: 1, price: 9000, type: "pizza", masa: "molde", detail: "Masa al molde" },
    { name: "Fugazza", qty: 2, price: 9500, type: "pizza", masa: "napoletana" },
    { name: "Mitad Muzza / Mitad Fugazza", qty: 1, price: 9500, type: "pizza-half", masa: "molde", detail: "Pizza mitad y mitad · Masa al molde" },
  ];
  const order = adaptOrder({ id: "db1", numero_pedido: 7, productos, total: 37500, status: "normal", created_at: "2026-10-17T23:00:00Z" });
  assert.equal(order.items[0].masa, "molde");
  assert.equal(order.items[1].masa, "napoletana");

  const cocina = adminPrintJob(order, "a1", false);
  assert.deepEqual(cocina.receipt.items.map(i => [i.name, i.detail]), [
    ["Muzza [AL MOLDE]", ""],
    ["Fugazza [NAPOLETANA]", ""],
    ["Mitad Muzza / Mitad Fugazza [AL MOLDE]", "Pizza mitad y mitad"],
  ]);
  const cliente = adminPrintJob(order, "a1", false, "cliente");
  assert.equal(cliente.receipt.items[0].name, "Muzza");
  assert.equal(cliente.receipt.items[0].detail, "Masa al molde");

  const texto = plantillaLocal({
    pedidoId: "db1", referencia: "IM-1", nombre: "Ana", email: "a@b.c", mode: "takeaway",
    items: productos as unknown as CartItem[], subtotal: 37500, shipping: 0, total: 37500, metodoPago: "efectivo",
  }, "pedido_recibido");
  const lineas = texto.split(String.fromCharCode(10));
  assert.ok(lineas.includes("1x Muzza [AL MOLDE]"));
  assert.ok(lineas.includes("2x Fugazza [NAPOLETANA]"));
  assert.ok(lineas.includes("1x Mitad Muzza / Mitad Fugazza [AL MOLDE] (Pizza mitad y mitad)"));
});

test("pedidos del POS: sin `type`, la masa igual se nombra y se cuenta", async () => {
  const { adaptOrder } = await import("../lib/adapt-order");
  const { adminPrintJob } = await import("../lib/admin-print-job");
  const productos = [
    { nombre: "Muzza", cantidad: 1, precio: 9000, extra: 0, masa: "molde" },
    { nombre: "Fugazza", cantidad: 2, precio: 9500, extra: 0, masa: "napoletana" },
    { nombre: "Coca-Cola", cantidad: 1, precio: 3000, extra: 0 },
  ];
  const order = adaptOrder({ id: "db2", numero_pedido: 3, productos, total: 31000, status: "normal", created_at: "2026-10-17T23:00:00Z" });
  assert.deepEqual(adminPrintJob(order, "a2", false).receipt.items.map(i => i.name), ["Muzza [AL MOLDE]", "Fugazza [NAPOLETANA]", "Coca-Cola"]);
  assert.deepEqual(contarMasas([order]), { napoletana: 2, molde: 1 });
});

/* ── masas agotadas desde el panel (22/10/2026) ── */
const sinMolde = estadoMasas({ masaNapoletanaActiva: true, masaMoldeActiva: false });
const sinNapo = estadoMasas({ masaNapoletanaActiva: false, masaMoldeActiva: true });

test("estadoMasas: las dos por defecto; una apagada trae el aviso; las dos apagadas no corta la venta", () => {
  assert.deepEqual(estadoMasas({}), TODAS_LAS_MASAS);
  assert.equal(masaUnica(TODAS_LAS_MASAS), undefined);
  assert.equal(masaUnica(sinMolde), "napoletana");
  assert.match(sinMolde.aviso, /terminó la masa al molde/);
  assert.equal(masaUnica(sinNapo), "molde");
  assert.match(sinNapo.aviso, /terminó la masa napoletana/);
  assert.deepEqual(estadoMasas({ masaNapoletanaActiva: false, masaMoldeActiva: false }), TODAS_LAS_MASAS);
});

test("ajustarMasas: pasa las pizzas a la masa que queda, junta líneas y no toca lo demás", () => {
  const items = [pizza({ cartId: "a", masa: "molde", qty: 2 }), pizza({ cartId: "b", masa: "napoletana" }), { ...pizza({ cartId: "c", key: "b" }), type: "bebida" as const, masa: undefined }];
  const ajustados = ajustarMasas(items, sinMolde);
  assert.equal(ajustados.filter((i) => i.type === "pizza").length, 1);
  assert.equal(ajustados.find((i) => i.type === "pizza")?.qty, 3);
  assert.equal(ajustados.find((i) => i.type === "pizza")?.masa, "napoletana");
  assert.equal(ajustados.find((i) => i.type === "bebida")?.masa, undefined);
  // Sin masa elegida vale napoletana: sin napoletana, pasa al molde.
  assert.equal(ajustarMasas([pizza()], sinNapo)[0].masa, "molde");
  // Si no hay nada que cambiar devuelve el mismo arreglo (el carrito no se vuelve a guardar).
  const ya = [pizza({ masa: "napoletana" })];
  assert.equal(ajustarMasas(ya, sinMolde), ya);
  assert.equal(ajustarMasas(items, TODAS_LAS_MASAS), items);
});

test("validarMasas: rechaza una pizza con la masa que se terminó, con un mensaje para el cliente", () => {
  assert.throws(() => validarMasas(sinMolde, [pizza({ masa: "molde" })]), /terminó la masa al molde.*pasan a napoletana/);
  assert.throws(() => validarMasas(sinNapo, [pizza()]), /terminó la masa napoletana/);
  assert.doesNotThrow(() => validarMasas(sinMolde, [pizza()]));
  assert.doesNotThrow(() => validarMasas(TODAS_LAS_MASAS, [pizza({ masa: "molde" })]));
  // Las bebidas no llevan masa: no se rechazan.
  assert.doesNotThrow(() => validarMasas(sinNapo, [{ type: "bebida" }]));
});
