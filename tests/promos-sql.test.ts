import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { validarOferta, type OfertaInput, type ProductoOferta } from "../lib/promos";

test("migración local: cinco pendientes, IDs correctos, checks y RLS sin políticas", async () => {
  const sql = readFileSync(new URL("../migrations/20261113150000_ofertas.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /create\s+policy|owner\s+to|\bDO\s+\$/i);
  const db = new PGlite();
  try {
    await db.exec("create table productos(id uuid primary key default gen_random_uuid(), proyecto_id text, nombre text, archivado boolean default false)");
    const nombres = ["Muzzarella Impasto", "Muzzarela y Jamon", "Pepsi 1.5 L", "7-Up 1.5 L", "Coca-Cola 1.5 L", "Napoletana all'Aglio", "Diavola al Miele Piccante", "Palmitos y Salsa Golf", "Provoleta Impasto", "Fugazzetta"];
    for (const nombre of nombres) await db.query("insert into productos(proyecto_id,nombre) values ('impasto',$1),('otro',$1)", [nombre]);
    await db.exec(sql);
    const productos = (await db.query<{ id: string; nombre: string }>("select id,nombre from productos where proyecto_id='impasto'")).rows.map(p => ({ ...p, categoria: /1.5 L/.test(p.nombre) ? "bebidas" : "pizzas", precio: 15500, costo: 3791 })) as ProductoOferta[];
    const ofertas = (await db.query<OfertaInput & { estado: string; proyecto_id: string; aprobada_en: null }>("select * from ofertas order by orden")).rows;
    assert.equal(ofertas.length, 5); assert.equal(ofertas[0].nombre, "Dúo Muzza");
    for (const oferta of ofertas) { assert.equal(oferta.estado, "pendiente"); assert.equal(oferta.proyecto_id, "impasto"); assert.equal(oferta.aprobada_en, null); assert.deepEqual(oferta.dias, [5, 6, 0]); assert.deepEqual(validarOferta(oferta, productos), []); }
    assert.equal((await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname='ofertas'")).rows[0].relrowsecurity, true);
    assert.equal((await db.query("select * from pg_policies where tablename='ofertas'")).rows.length, 0);
    await assert.rejects(db.exec("update ofertas set estado='publicada'"), /check constraint/);
    await assert.rejects(db.exec("update ofertas set tipo='otro'"), /check constraint/);
  } finally { await db.close(); }
});
