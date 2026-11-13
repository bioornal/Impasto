import assert from "node:assert/strict";
import { test } from "node:test";
import Module, { createRequire } from "node:module";
import { NextRequest, NextResponse } from "next/server";
import { type Oferta, type ProductoOferta } from "../lib/promos";

// Adaptador en memoria: ejecuta los handlers reales sin auth ni base remota.
const productos: ProductoOferta[] = [{ id: "m", nombre: "Muzza", categoria: "pizzas", precio: 15500, costo: 3791 }];
const base: Oferta = { id: "oferta-1", tipo: "combo", nombre: "Dúo", titulo: "Dúo Muzza", descripcion: "", estado: "pendiente", config: { precio: 26900, lugares: [{ cantidad: 2, productos: ["m"] }] }, dias: [5, 6, 0], desde: null, hasta: null, orden: 0, creada_en: "2026-11-13T00:00:00Z", actualizada_en: "2026-11-13T00:00:00Z", aprobada_en: null };
type Fila = Oferta & { proyecto_id: string };
let filas: Fila[] = [], autorizado = true, falla = false, consultas = 0, sinContexto = false;
const db = { database: { from(tabla: string) {
  assert.equal(tabla, "ofertas"); consultas++;
  let operacion = "select", cambio: Record<string, unknown> = {}, inserts: Fila[] = [], inicio = 0, fin = Infinity;
  const filtros: [string, unknown][] = [];
  const q = {
    select() { return q; }, order() { return q; }, limit(n: number) { fin = n - 1; return q; },
    range(a: number, b: number) { inicio = a; fin = b; return q; },
    eq(campo: string, valor: unknown) { filtros.push([campo, valor]); return q; },
    insert(v: Fila[]) { operacion = "insert"; inserts = v; return q; },
    update(v: Record<string, unknown>) { operacion = "update"; cambio = v; return q; },
    delete() { operacion = "delete"; return q; },
    then(resolve: (r: { data: Fila[] | null; error: unknown }) => unknown) {
      if (falla) return Promise.resolve(resolve({ data: null, error: new Error("base desconectada") }));
      let seleccion = filas.filter(f => filtros.every(([k, v]) => (f as unknown as Record<string, unknown>)[k] === v)).slice(inicio, fin + 1);
      if (operacion === "insert") { seleccion = inserts.map(f => ({ ...base, ...f, id: "nueva" })); filas.push(...seleccion); }
      if (operacion === "update") seleccion.forEach(f => Object.assign(f, cambio));
      if (operacion === "delete") filas = filas.filter(f => !seleccion.includes(f));
      return Promise.resolve(resolve({ data: seleccion, error: null }));
    },
  };
  return q;
} } };
const require = createRequire(import.meta.url);
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
const original = loader._load;
loader._load = (id, ...args) => {
  if (id === "@/lib/insforge") return { db };
  if (id === "@/lib/admin-auth") return { requireAdmin: async () => autorizado ? null : NextResponse.json({ ok: false }, { status: 401 }) };
  if (id === "@/lib/ofertas-admin") return {
    contextoNegocio: async () => sinContexto
      ? { gastoFijoNoche: null, envio: null, envioGratisDesde: null, comisionPct: null, pedidosPorNoche: null, ticketPromedio: null }
      : { gastoFijoNoche: 54231, envio: 3000, envioGratisDesde: 35000, comisionPct: 7.99, pedidosPorNoche: 4, ticketPromedio: 28000 },
    COLUMNAS_OFERTAS: "id,tipo,nombre,titulo,descripcion,estado,config,dias,desde,hasta,orden,aprobada_en,creada_en,actualizada_en",
    productosParaOfertas: async () => ({ productos, comisionPct: 7.99 }),
    camposOferta: (o: Oferta) => Object.fromEntries(["tipo", "nombre", "titulo", "descripcion", "config", "dias", "desde", "hasta", "orden"].map(k => [k, (o as unknown as Record<string, unknown>)[k]])),
  };
  return original.call(loader, id, ...args);
};
const listado = require("../app/api/admin/ofertas/route") as typeof import("../app/api/admin/ofertas/route");
const detalle = require("../app/api/admin/ofertas/[id]/route") as typeof import("../app/api/admin/ofertas/[id]/route");
const estado = require("../app/api/admin/ofertas/[id]/estado/route") as typeof import("../app/api/admin/ofertas/[id]/estado/route");
loader._load = original;
const contexto = (id = "oferta-1") => ({ params: Promise.resolve({ id }) });
const req = (method: string, body?: unknown) => new NextRequest("http://localhost/api/admin/ofertas", { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const reset = () => { filas = [{ ...structuredClone(base), proyecto_id: "impasto" }, { ...structuredClone(base), id: "ajena", proyecto_id: "otro" }]; autorizado = true; falla = false; consultas = 0; };

test("ofertas API: autorización, aislamiento, validación, CRUD y estados", async () => {
  reset(); autorizado = false;
  for (const respuesta of [await listado.GET(), await listado.POST(req("POST", base)), await detalle.PUT(req("PUT", base), contexto()), await detalle.DELETE(req("DELETE"), contexto()), await estado.POST(req("POST", { accion: "aprobar" }), contexto())]) assert.equal(respuesta.status, 401);
  assert.equal(consultas, 0);
  reset();
  const get = await (await listado.GET()).json();
  assert.equal(get.data.length, 1); assert.equal(get.data[0].margen.peor, 19318); assert.equal(get.productos[0].costo, 3791);
  assert.equal(get.contexto.gastoFijoNoche, 54231); assert.equal(get.data[0].analisis.resumen.teQueda, 19318);
  assert.equal(get.data[0].analisis.combosParaCubrirNoche, 3);
  sinContexto = true;
  const parcial = await listado.GET(); assert.equal(parcial.status, 200);
  const sinDatos = await parcial.json();
  assert.equal(sinDatos.data[0].analisis.resumen.teQueda, 19318);
  assert.equal(sinDatos.data[0].analisis.envio, null);
  assert.equal(sinDatos.data[0].analisis.totales.conTarjeta, null);
  assert.equal(sinDatos.contexto.gastoFijoNoche, null);
  sinContexto = false;
  assert.equal((await listado.POST(req("POST", {}))).status, 400);
  assert.equal((await listado.POST(req("POST", { ...base, estado: "aprobada", proyecto_id: "otro", aprobada_en: "ayer" }))).status, 201);
  const creada = filas.find(f => f.id === "nueva")!; assert.equal(creada.estado, "pendiente"); assert.equal(creada.proyecto_id, "impasto"); assert.equal(creada.aprobada_en, null);
  assert.equal((await estado.POST(req("POST", { accion: "reanudar" }), contexto())).status, 400);
  assert.equal((await estado.POST(req("POST", { accion: "aprobar" }), contexto("ajena"))).status, 404);
  assert.equal((await estado.POST(req("POST", { accion: "aprobar" }), contexto())).status, 200);
  assert.equal(filas[0].estado, "aprobada"); assert.ok(filas[0].aprobada_en);
  const versionAnterior = filas[0].actualizada_en;
  assert.equal((await detalle.PUT(req("PUT", { ...base, actualizada_en: versionAnterior, nombre: "Editada", estado: "pendiente", proyecto_id: "otro" }), contexto())).status, 200);
  assert.equal(filas[0].estado, "aprobada"); assert.equal(filas[0].nombre, "Editada"); assert.equal(filas[0].proyecto_id, "impasto"); assert.ok(filas[0].aprobada_en);
  assert.equal((await detalle.PUT(req("PUT", { ...base, actualizada_en: versionAnterior, nombre: "Edición vieja" }), contexto())).status, 409);
  assert.equal(filas[0].nombre, "Editada");
  assert.equal((await estado.POST(req("POST", { accion: "pausar" }), contexto())).status, 200);
  assert.equal(filas[0].estado, "pausada");
  filas[0].config = { precio: 7000, lugares: [{ cantidad: 2, productos: ["m"] }] };
  assert.equal((await estado.POST(req("POST", { accion: "reanudar" }), contexto())).status, 400);
  filas[0].config = base.config;
  assert.equal((await estado.POST(req("POST", { accion: "reanudar" }), contexto())).status, 200);
  filas[0].estado = "pendiente"; filas[0].config = { precio: 50000, lugares: [{ cantidad: 2, productos: ["archivado"] }] };
  assert.equal((await estado.POST(req("POST", { accion: "aprobar" }), contexto())).status, 400);
  assert.equal((await detalle.PUT(req("PUT", base), contexto("ajena"))).status, 404);
  assert.equal((await detalle.DELETE(req("DELETE"), contexto("ajena"))).status, 404);
  assert.equal((await detalle.DELETE(req("DELETE"), contexto())).status, 200);
  assert.ok(filas.some(f => f.id === "ajena"));
  falla = true; assert.equal((await listado.GET()).status, 500);
});
