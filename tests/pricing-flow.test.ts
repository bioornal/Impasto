import assert from "node:assert/strict";
import { test } from "node:test";
import { assembleCatalogFromResults, publicSaleProducts, settleCatalogQuery } from "../lib/catalog-source";
import { quoteItemsWithCatalog } from "../lib/order-quote";
import { PricingUnavailableError } from "../lib/pricing-safety";
import type { CartItem } from "../types";

const rows = (data: unknown[] = []) => ({ data, error: null });
const ok = () => ({
  productos: rows([
    { id: "p", nombre: "Muzza", categoria: "pizzas", precio: 9000, disponible: true },
    { id: "q", nombre: "Fugazza", categoria: "pizzas", precio: 9500, disponible: true },
    { id: "e", nombre: "Palmito", categoria: "empanadas", precio: 2500, disponible: true },
    { id: "b", nombre: "Agua", categoria: "bebidas", precio: 2000, disponible: true },
  ]),
  promociones: rows(), testimonios: rows(), etiquetas: rows(),
  recetas: rows(), receta_ingredientes: rows(), ingredientes: rows(), precios_venta: rows(),
  config_negocio: rows([{ pizzas_objetivo_mes: 800 }]),
  costos_fijos: rows(), costos_variables: rows(), gastos: rows(),
});

test("cada fuente crítica fallida o nula bloquea el catálogo", () => {
  const critical = ["productos", "recetas", "receta_ingredientes", "ingredientes", "precios_venta", "config_negocio", "costos_fijos", "costos_variables", "gastos"] as const;
  for (const source of critical) {
    for (const failure of [{ data: null, error: new Error("DB") }, { data: null, error: null }]) {
      assert.throws(() => assembleCatalogFromResults({ ...ok(), [source]: failure }), PricingUnavailableError, source);
    }
  }
});

test("una promesa rechazada se convierte en resultado fallido", async () => {
  const result = await settleCatalogQuery(Promise.reject(new Error("red")));
  assert.throws(() => assembleCatalogFromResults({ ...ok(), ingredientes: result }), PricingUnavailableError);
});

test("fallas decorativas no bloquean precios", () => {
  for (const source of ["promociones", "testimonios", "etiquetas"] as const) {
    const catalog = assembleCatalogFromResults({ ...ok(), [source]: { data: null, error: new Error("red") } });
    assert.equal(catalog.pizzas[0]?.precio, 9000);
  }
});

test("una regla rota oculta solo su producto y conserva su ID", () => {
  const input = ok();
  input.precios_venta = rows([{ receta_id: "falta", nombre: "Palmito", markup: 2, subcategoria: "Empanadas" }]);
  const catalog = assembleCatalogFromResults(input);
  assert.deepEqual(catalog.empanadas, []);
  assert.deepEqual(catalog.preciosNoDisponibles, ["e"]);
  assert.equal(catalog.pizzas.length, 2);
});

test("un carrito anterior no puede usar pizza, mitad, bebida o caja con precio omitido", () => {
  const catalog = assembleCatalogFromResults(ok());
  const items: CartItem[] = [
    { key: "p", cartId: "1", type: "pizza", name: "Muzza", price: 9000, qty: 1 },
    { key: "half-p-q", cartId: "2", type: "pizza-half", name: "Mitad", price: 9500, qty: 1, variant: { kind: "half", ids: ["p", "q"] } },
    { key: "b", cartId: "3", type: "bebida", name: "Agua", price: 2000, qty: 1 },
    { key: "emp-6-e", cartId: "4", type: "empanadas", name: "Caja x6", price: 15000, qty: 1, variant: { kind: "empanadas-box", size: 6, selections: { e: 6 } } },
  ];
  for (const [item, id] of [[items[0], "p"], [items[1], "q"], [items[2], "b"], [items[3], "e"]] as const) {
    assert.throws(() => quoteItemsWithCatalog([item], { ...catalog, preciosNoDisponibles: [id] }), /precio no disponible/i);
  }
});

test("ningún combo puede ocultar un sabor con precio cero", () => {
  const catalog = assembleCatalogFromResults(ok());
  catalog.empanadas[0].precio = 0;
  catalog.empanadaBoxPrices[6] = 15000;
  const item: CartItem = { key: "emp-6-e", cartId: "4", type: "empanadas", name: "Caja x6", price: 15000, qty: 1, variant: { kind: "empanadas-box", size: 6, selections: { e: 6 } } };
  assert.throws(() => quoteItemsWithCatalog([item], catalog), /precio no disponible/i);
});
test("una caja con regla propia rota no se vende aunque sus sabores tengan precio", () => {
  const input = ok();
  input.productos.data.push({ id: "c6", nombre: "Caja x6", categoria: "empanadas", precio: 15000, disponible: true });
  input.precios_venta = rows([{ receta_id: "ausente", nombre: "Caja x6", markup: 2, subcategoria: "Empanadas" }]);
  const catalog = assembleCatalogFromResults(input);
  assert.deepEqual(catalog.empanadaBoxNoDisponibles, [6]);
  const item: CartItem = { key: "emp-6-e", cartId: "viejo", type: "empanadas", name: "Caja x6", price: 15000, qty: 1, variant: { kind: "empanadas-box", size: 6, selections: { e: 6 } } };
  assert.throws(() => quoteItemsWithCatalog([item], catalog), /precio no disponible/i);
});
test("la API pública conserva campos pero publica solo precios seguros", () => {
  const catalog = assembleCatalogFromResults(ok());
  const rows = [
    { id: "p", nombre: "Muzza", categoria: "pizzas", precio: 1000, disponible: true, desc: "original" },
    { id: "e", nombre: "Palmito", categoria: "empanadas", precio: 2500, disponible: true, archivado: true },
    { id: "mal", nombre: "Mala", categoria: "pizzas", precio: 0, disponible: true },
  ];
  assert.deepEqual(publicSaleProducts(rows, catalog), [
    { id: "p", nombre: "Muzza", categoria: "pizzas", precio: 9000, disponible: true, desc: "original" },
  ]);
});
test("la API pública conserva la caja válida con su precio de catálogo", () => {
  const input = ok();
  input.productos.data.push({ id: "c6", nombre: "Caja x6", categoria: "empanadas", precio: 15000, disponible: true });
  const catalog = assembleCatalogFromResults(input);
  const products = publicSaleProducts([{ id: "c6", nombre: "Caja x6", categoria: "empanadas", precio: 1000 }], catalog);
  assert.equal(products[0]?.precio, 15000);
});
