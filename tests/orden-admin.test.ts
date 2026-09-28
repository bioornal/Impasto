import assert from "node:assert/strict";
import { ordenarProductosAdmin, PIZZAS_DE_LA_CARTA } from "../lib/orden-admin";

const p = (nombre: string, type: string, archivado = false) => ({ nombre, type, archivado });

const mezcla = [
  p("Pizza Anchoas", "pizza", true),
  p("Coca-Cola 1.5 L", "bebida"),
  p("Empanadas Arabe", "empanada"),
  p("Carbonada Criolla", "pizza", true), // de la carta aunque este archivada
  p("Bianca ai Funghi", "pizza", true), // blanca nueva: tambien fija
  p("Muzzarella Impasto", "pizza"),
  p("Pizza Prueba", "pizza"),
  p("Empanadas Caprese", "empanada", true), // empanada archivada: sigue arriba
];
const r = ordenarProductosAdmin(mezcla).map((x) => x.nombre);

assert.deepEqual(r, [
  "Muzzarella Impasto",
  "Carbonada Criolla",
  "Bianca ai Funghi",
  "Empanadas Arabe",
  "Empanadas Caprese",
  "Coca-Cola 1.5 L",
  "Pizza Prueba",
  "Pizza Anchoas",
]);
assert.equal(PIZZAS_DE_LA_CARTA.length, 22);
assert.equal(new Set(PIZZAS_DE_LA_CARTA).size, 22);
assert.equal(mezcla[0].nombre, "Pizza Anchoas", "no muta la lista original");
console.log("orden-admin ok");
