import assert from "node:assert/strict";
import { test } from "node:test";
import Module, { createRequire } from "node:module";
import { margenOferta, type OfertaInput } from "../lib/promos";

const tables: Record<string, Record<string, unknown>[]> = {
  productos: [
    { id: "m", nombre: "Muzzarella Impasto", categoria: "pizzas", precio: 1, proyecto_id: "impasto", archivado: false, disponible: true },
    { id: "p", nombre: "Pepsi", categoria: "bebidas", precio: 1, proyecto_id: "impasto", archivado: false, disponible: true },
    { id: "sin", nombre: "Sin receta", categoria: "pizzas", precio: 24000, proyecto_id: "impasto", archivado: false, disponible: true },
    { id: "agotada", nombre: "Agotada", categoria: "pizzas", precio: 15500, proyecto_id: "impasto", archivado: false, disponible: false },
    { id: "archivo", nombre: "Archivo", categoria: "pizzas", precio: 15500, proyecto_id: "impasto", archivado: true, disponible: true },
    { id: "ajena", nombre: "Ajena", categoria: "pizzas", precio: 15500, proyecto_id: "otro", archivado: false, disponible: true },
  ],
  recetas: [{ id: "r", precio_prepizza: 0, precio_salsa: 0 }, { id: "b" }],
  receta_ingredientes: [{ id: "ri", receta_id: "r", ingrediente_id: "i", cantidad_kg: 1 }, { id: "bi", receta_id: "b", ingrediente_id: "bp", cantidad_kg: 1 }],
  ingredientes: [{ id: "i", precio_kg: 3291, multiplo_rendimiento: 1 }, { id: "bp", precio_kg: 2550, multiplo_rendimiento: 1 }, { id: "caja", nombre: "Caja de pizza", unidad: "unidad", precio_kg: 500 }],
  precios_venta: [{ id: "v", receta_id: "r", nombre: "Muzzarella Impasto", markup: 4.5, subcategoria: "Pizzas" }, { id: "bv", receta_id: "b", nombre: "Pepsi", markup: 1.7, subcategoria: "Bebidas" }],
  config_negocio: [{ pizzas_objetivo_mes: 100, comision_tarjeta_pct: 10 }], costos_fijos: [], costos_variables: [],
};
const db = { database: { from(table: string) {
  let rows = [...tables[table]];
  const q = {
    select() { return q; }, order() { return q; }, returns() { return q; },
    eq(k: string, v: unknown) { rows = rows.filter(r => r[k] === v); return q; },
    not(k: string, _op: string, v: unknown) { rows = rows.filter(r => r[k] !== v); return q; },
    in(k: string, vs: unknown[]) { rows = rows.filter(r => vs.includes(r[k])); return q; },
    range(a: number, b: number) { rows = rows.slice(a, b + 1); return q; }, limit(n: number) { rows = rows.slice(0, n); return q; },
    then(resolve: (r: unknown) => unknown) { return Promise.resolve(resolve({ data: rows, error: null })); },
  }; return q;
} } };
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }, original = loader._load;
loader._load = (id, ...args) => id === "server-only" ? {} : id === "./insforge" ? { db } : original.call(loader, id, ...args);
const require = createRequire(import.meta.url);
const { productosParaOfertas, camposOferta } = require("../lib/ofertas-admin") as typeof import("../lib/ofertas-admin");
loader._load = original;

test("costos admin usa precios efectivos + caja, aísla carta e informa costos ausentes", async () => {
  const { productos, comisionPct } = await productosParaOfertas();
  assert.equal(comisionPct, 10);
  assert.deepEqual(productos.map(p => p.id), ["m", "p", "sin"]);
  assert.equal(productos[0].precio, 15500); assert.equal(productos[0].costo, 3791);
  assert.equal(productos[1].precio, 4500); assert.equal(productos[1].costo, 2550);
  assert.equal(productos[2].costo, null);
  const o: OfertaInput = { tipo: "descuento_cantidad", nombre: "Segunda", titulo: "Segunda al 50%", descripcion: "", dias: [5], desde: null, hasta: null, orden: 0, config: { cada: 2, porcentaje: 50, productos: null } };
  assert.equal(margenOferta(o, productos).semaforo, "rojo");
  assert.deepEqual(Object.keys(camposOferta(o)).sort(), ["tipo", "nombre", "titulo", "descripcion", "config", "dias", "desde", "hasta", "orden"].sort());
});
