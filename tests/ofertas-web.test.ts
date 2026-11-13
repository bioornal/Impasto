import assert from "node:assert/strict";
import { test } from "node:test";
import Module, { createRequire } from "node:module";
import type { Oferta } from "../lib/promos";

const base: Oferta = { id: "duo", nombre: "Dúo", titulo: "Dúo Muzza", descripcion: "Dos pizzas", tipo: "combo", config: { precio: 26900, lugares: [{ cantidad: 2, productos: ["m"] }] }, estado: "aprobada", dias: [5, 6, 0], desde: null, hasta: null, orden: 0, aprobada_en: null, creada_en: "", actualizada_en: "" };
let falla = false;
const columnas: string[] = [], filtros: [string, unknown][] = [];
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
const original = loader._load;
loader._load = (id, ...args) => {
  if (id === "server-only") return {};
  if (id === "./insforge") return { db: { database: { from(tabla: string) {
    assert.equal(tabla, "ofertas");
    const q = {
      select(c: string) { columnas.push(c); return q; }, eq(k: string, v: unknown) { filtros.push([k, v]); return q; }, order() { return q; },
      range() { return q; }, then(resolve: (value: unknown) => unknown) {
        if (falla) return Promise.reject(new Error("sin conexión"));
        return Promise.resolve(resolve({ error: null, data: [
          { ...base, costo: 999, margen: { secreto: 1 }, config: { ...base.config, costo: 999 } },
          { ...base, id: "vencida", hasta: "2026-11-12" }, { ...base, id: "pausada", estado: "pausada" },
        ] }));
      },
    }; return q;
  } } } };
  return original.call(loader, id, ...args);
};
const { leerOfertasVigentes } = createRequire(import.meta.url)("../lib/ofertas-web") as typeof import("../lib/ofertas-web");
loader._load = original;

test("lectura comercial de ofertas: backend, proyecto, vigencia y lista blanca sin costos", async () => {
  const ofertas = await leerOfertasVigentes(new Date("2026-11-14T03:30:00Z"));
  assert.deepEqual(ofertas.map(o => o.id), ["duo"]);
  assert.ok(columnas.every(c => !/costo|margen|\*/.test(c)));
  assert.ok(filtros.some(([k, v]) => k === "proyecto_id" && v === "impasto"));
  assert.ok(filtros.some(([k, v]) => k === "estado" && v === "aprobada"));
  assert.equal(/costo|margen|secreto/.test(JSON.stringify(ofertas)), false);
  falla = true;
  assert.deepEqual(await leerOfertasVigentes(), [], "una falla de ofertas no bloquea la venta");
});
