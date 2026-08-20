import { buildCatalog, type DatabaseProduct } from "../lib/catalog-build";

// Réplica reducida de lo que hay en la base: 3 productos de Impasto y 3 del
// proyecto paralelo, con los mismos valores de `tipo` y `categoria` reales.
const fixture: DatabaseProduct[] = [
  { id: "1", nombre: "Pizza Muzzarela",     tipo: "pizza", categoria: "pizzas",       precio: 15000, disponible: true, desc: "", tags: [] },
  { id: "2", nombre: "Empanadas de Pollo",  tipo: "pizza", categoria: "empanadas",    precio: 3200,  disponible: true, desc: "", tags: [] },
  { id: "3", nombre: "Coca-Cola 1.5L",      tipo: "pizza", categoria: "bebidas",      precio: 2500,  disponible: true, desc: "", tags: [] },
  { id: "4", nombre: "Hamburguesa Simple",  tipo: "pizza", categoria: "hamburguesas", precio: 8000,  disponible: true, desc: "", tags: [] },
  { id: "5", nombre: "Lomo Completo",       tipo: "pizza", categoria: "lomos",        precio: 15000, disponible: true, desc: "", tags: [] },
  { id: "6", nombre: "Calzone Napolitano",  tipo: "pizza", categoria: "calzones",     precio: 1622,  disponible: true, desc: "", tags: [] },
];

let fallos = 0;
const check = (nombre: string, real: unknown, esperado: unknown) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) { fallos++; console.log(`FALLA  ${nombre}: esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(real)}`); }
  else console.log(`PASA   ${nombre}`);
};

const catalogo = buildCatalog(fixture, null, null);

check("solo la pizza de Impasto llega a pizzas",     catalogo.pizzas.map((p) => p.nombre),    ["Pizza Muzzarela"]);
check("solo la empanada de Impasto llega a empanadas", catalogo.empanadas.map((e) => e.nombre), ["Empanadas de Pollo"]);
check("solo la bebida de Impasto llega a bebidas",   catalogo.bebidas.map((b) => b.nombre),   ["Coca-Cola 1.5L"]);

const todos = [...catalogo.pizzas, ...catalogo.empanadas, ...catalogo.bebidas].map((p) => p.nombre);
check("ningún producto del proyecto paralelo se filtra", todos.filter((n) => ["Hamburguesa Simple", "Lomo Completo", "Calzone Napolitano"].includes(n)), []);

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
