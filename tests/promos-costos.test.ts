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
  sucursales: [{ id: "iguazu", delivery_fee: 3000, envio_gratis_desde: 35000 }], pedidos: [],
};
let fallaTabla = "";
const db = { database: { from(table: string) {
  let rows = [...tables[table]];
  const q = {
    select() { return q; }, order() { return q; }, returns() { return q; },
    eq(k: string, v: unknown) { rows = rows.filter(r => r[k] === v); return q; },
    neq(k: string, v: unknown) { rows = rows.filter(r => r[k] !== v); return q; },
    gte(k: string, v: string) { rows = rows.filter(r => String(r[k]) >= v); return q; },
    lt(k: string, v: string) { rows = rows.filter(r => String(r[k]) < v); return q; },
    not(k: string, _op: string, v: unknown) { rows = rows.filter(r => r[k] !== v); return q; },
    in(k: string, vs: unknown[]) { rows = rows.filter(r => vs.includes(r[k])); return q; },
    range(a: number, b: number) { rows = rows.slice(a, b + 1); return q; }, limit(n: number) { rows = rows.slice(0, n); return q; },
    then(resolve: (r: unknown) => unknown) { return Promise.resolve(resolve(table === fallaTabla ? { data: null, error: new Error("simulado") } : { data: rows, error: null })); },
  }; return q;
} } };
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }, original = loader._load;
loader._load = (id, ...args) => id === "server-only" ? {} : id === "./insforge" ? { db } : original.call(loader, id, ...args);
const require = createRequire(import.meta.url);
const { productosParaOfertas, camposOferta, contextoNegocio } = require("../lib/ofertas-admin") as typeof import("../lib/ofertas-admin");
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

test("contexto: costos mensuales, 28 noches a las 06 y fallos independientes", async () => {
  tables.costos_fijos = [{ id: "d", monto: 455000, monto_por_noche: 35000, activo: true }, { id: "l", monto: 250003, activo: true }, { id: "x", monto: 999999, activo: false }];
  tables.pedidos = [
    { id: "a", proyecto_id: "impasto", status: "entregado", total: 20000, created_at: "2026-11-12T08:59:59Z" },
    { id: "b", proyecto_id: "impasto", status: "entregado", total: 30000, created_at: "2026-11-12T09:00:00Z" },
    { id: "c", proyecto_id: "impasto", status: "pendiente", total: 40000, created_at: "2026-11-13T01:00:00Z" },
    { id: "otra", proyecto_id: "otro", status: "entregado", total: 90000, created_at: "2026-11-12T22:00:00Z" },
    { id: "cancelada", proyecto_id: "impasto", status: "cancelado", total: 90000, created_at: "2026-11-12T22:00:00Z" },
    { id: "vieja", proyecto_id: "impasto", status: "entregado", total: 90000, created_at: "2026-10-17T08:59:59Z" },
  ];
  const ahora = new Date("2026-11-13T20:00:00Z");
  const c = await contextoNegocio(ahora);
  assert.equal(c.gastoFijoNoche, 54231); assert.equal(c.envio, 3000); assert.equal(c.envioGratisDesde, 35000);
  assert.equal(c.pedidosPorNoche, 1.5); assert.equal(c.ticketPromedio, 30000); assert.equal(c.comisionPct, 10);
  for (const [tabla, campos] of [["costos_fijos", ["gastoFijoNoche"]], ["sucursales", ["envio", "envioGratisDesde"]], ["config_negocio", ["comisionPct"]], ["pedidos", ["pedidosPorNoche", "ticketPromedio"]]] as const) {
    fallaTabla = tabla;
    const parcial = await contextoNegocio(ahora);
    for (const campo of campos) assert.equal(parcial[campo], null);
    assert.equal(parcial[tabla === "sucursales" ? "comisionPct" : "envio"], tabla === "sucursales" ? 10 : 3000);
  }
  fallaTabla = ""; tables.pedidos = []; tables.costos_fijos = [{ id: "l", monto: 1000, activo: true }];
  const vacio = await contextoNegocio(ahora);
  assert.equal(vacio.gastoFijoNoche, null); assert.equal(vacio.pedidosPorNoche, null); assert.equal(vacio.ticketPromedio, null);
  tables.pedidos = Array.from({ length: 501 }, (_, i) => ({ id: `p${i}`, proyecto_id: "impasto", status: "entregado", total: 10000, created_at: "2026-11-12T22:00:00Z" }));
  const paginado = await contextoNegocio(ahora);
  assert.equal(paginado.pedidosPorNoche, 501); assert.equal(paginado.ticketPromedio, 10000);
  tables.pedidos = [
    { id: "dentro", proyecto_id: "impasto", status: "entregado", total: 10000, created_at: "2026-10-17T09:00:00.000Z" },
    { id: "fuera", proyecto_id: "impasto", status: "entregado", total: 90000, created_at: "2026-10-17T08:59:59.999Z" },
    { id: "futuro", proyecto_id: "impasto", status: "entregado", total: 90000, created_at: "2026-11-13T21:00:00.000Z" },
  ];
  const limite = await contextoNegocio(ahora);
  assert.equal(limite.pedidosPorNoche, 1); assert.equal(limite.ticketPromedio, 10000);
  tables.pedidos.push({ id: "cero", proyecto_id: "impasto", status: "entregado", total: 0, created_at: "2026-10-17T10:00:00.000Z" });
  const conCero = await contextoNegocio(ahora);
  assert.equal(conCero.pedidosPorNoche, 2); assert.equal(conCero.ticketPromedio, 5000);
});
