import { buildCatalog, type DatabaseProduct } from "../lib/catalog-build";
import { slugificar, type Etiqueta } from "../lib/etiquetas";

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

// La clasificación tiene que salir de `categoria`, no de `tipo`: las 57 filas
// de la base tienen tipo = 'pizza' porque la migración 002 lo backfilleó así.
const tipoMentiroso: DatabaseProduct[] = [
  { id: "7", nombre: "Hamburguesa BBQ", tipo: "pizza", categoria: "hamburguesas", precio: 10000, disponible: true, desc: "", tags: [] },
];
check("tipo='pizza' no alcanza para entrar al catálogo", buildCatalog(tipoMentiroso, null, null).pizzas, []);

// Una categoría desconocida se descarta sin tumbar la carga.
const categoriaRara: DatabaseProduct[] = [
  { id: "8", nombre: "Producto Raro", tipo: "pizza", categoria: "sushi", precio: 1000, disponible: true, desc: "", tags: [] },
  { id: "9", nombre: "Pizza Napolitana", tipo: "pizza", categoria: "pizzas", precio: 18000, disponible: true, desc: "", tags: [] },
];
check("una categoría desconocida no rompe el resto", buildCatalog(categoriaRara, null, null).pizzas.map((p) => p.nombre), ["Pizza Napolitana"]);

// El filtrado de disponibles conserva la semántica actual (`!== false`).
const disponibilidad: DatabaseProduct[] = [
  { id: "10", nombre: "Pizza Oculta",  tipo: "pizza", categoria: "pizzas", precio: 15000, disponible: false, desc: "", tags: [] },
  { id: "11", nombre: "Pizza Sin Dato", tipo: "pizza", categoria: "pizzas", precio: 15000, desc: "", tags: [] },
];
check("disponible=false se descarta y disponible ausente se conserva", buildCatalog(disponibilidad, null, null).pizzas.map((p) => p.nombre), ["Pizza Sin Dato"]);

// Divergencia deliberada respecto del código viejo: antes la detección de
// combo por nombre (/caja x 6|12|24/) se evaluaba ANTES de mirar categoria,
// así que un producto de OTRO proyecto con un nombre tipo "Caja x 6" podía
// clasificarse como combo y pisar el precio de caja x6 de Impasto. Ahora la
// allowlist corta primero: un producto fuera de CATEGORIAS_IMPASTO nunca
// llega a "combo", sin importar el nombre. Este test fija esa divergencia a
// propósito para que nadie la revierta creyendo que restaura la equivalencia.
const cajasEnConflicto: DatabaseProduct[] = [
  { id: "12", nombre: "Caja x 6", tipo: "pizza", categoria: "empanadas",    precio: 9100, disponible: true, desc: "", tags: [] },
  { id: "13", nombre: "Caja x 6", tipo: "pizza", categoria: "hamburguesas", precio: 5000, disponible: true, desc: "", tags: [] },
];
check("el precio de caja x6 sale del producto de Impasto, no del proyecto paralelo", buildCatalog(cajasEnConflicto, null, null).empanadaBoxPrices[6], 9100);

// `categoria` significa dos cosas distintas: en la base es la línea de
// producto ('pizzas'), en TypeScript es el estilo ('clasica' | 'gourmet').
// El estilo se resuelve por tags, que es contra lo que PizzaList ya filtra.
const estilos: DatabaseProduct[] = [
  { id: "12", nombre: "Pizza Muzzarela",          tipo: "pizza", categoria: "pizzas", precio: 15000, disponible: true, desc: "", tags: [] },
  { id: "13", nombre: "Pizza Rucula y Jamon Crudo", tipo: "pizza", categoria: "pizzas", precio: 25000, disponible: true, desc: "", tags: ["gourmet"] },
];
const conEstilos = buildCatalog(estilos, null, null);
check("una pizza sin tags es clasica",        conEstilos.pizzas.find((p) => p.nombre === "Pizza Muzzarela")?.categoria,          "clasica");
check("una pizza con tag gourmet es gourmet", conEstilos.pizzas.find((p) => p.nombre === "Pizza Rucula y Jamon Crudo")?.categoria, "gourmet");

// ── resolución del badge ──────────────────────────────────────────────
// Gana la etiqueta de menor `orden` entre las que el producto tiene y que
// aplican a su tipo. `mostrar_badge` decide dónde se ve, no dónde se marca.
const etiquetas: Etiqueta[] = [
  { slug: "mas-pedida",  label: "Más pedida",  color: "rojo",   orden: 1, mostrar_badge: "ambos" },
  { slug: "gourmet",     label: "Gourmet",     color: "dorado", orden: 4, mostrar_badge: "ambos" },
  { slug: "vegetariana", label: "Vegetariana", color: "verde",  orden: 6, mostrar_badge: "empanadas" },
  { slug: "interna",     label: "Interna",     color: "gris",   orden: 2, mostrar_badge: "ninguno" },
];

const conTags = (nombre: string, categoria: string, tags: string[]): DatabaseProduct =>
  ({ id: nombre, nombre, tipo: "pizza", categoria, precio: 1000, disponible: true, desc: "", tags });

const bc = (p: DatabaseProduct[]) => buildCatalog(p, null, null, etiquetas);

check("gana la etiqueta de menor orden",
  bc([conTags("A", "pizzas", ["gourmet", "mas-pedida"])]).pizzas[0].badge?.label, "Más pedida");

check("una etiqueta de empanadas no aparece en una pizza",
  bc([conTags("B", "pizzas", ["vegetariana"])]).pizzas[0].badge, undefined);

check("la misma etiqueta sí aparece en una empanada",
  bc([conTags("C", "empanadas", ["vegetariana"])]).empanadas[0].badge?.label, "Vegetariana");

check("mostrar_badge=ninguno nunca genera badge, aunque gane por orden",
  bc([conTags("D", "pizzas", ["interna", "gourmet"])]).pizzas[0].badge?.label, "Gourmet");

check("un producto sin etiquetas no tiene badge",
  bc([conTags("E", "pizzas", [])]).pizzas[0].badge, undefined);

check("un slug que no existe en etiquetas se ignora sin romper",
  bc([conTags("F", "pizzas", ["fantasma", "gourmet"])]).pizzas[0].badge?.label, "Gourmet");

check("el badge trae el color de la etiqueta",
  bc([conTags("G", "pizzas", ["gourmet"])]).pizzas[0].badge?.color, "dorado");

// El badge es independiente de Pizza.categoria, que alimenta la pestaña Clásicas.
check("categoria sigue derivandose de tags, no del badge",
  bc([conTags("H", "pizzas", ["gourmet"])]).pizzas[0].categoria, "gourmet");

check("sin etiquetas cargadas, buildCatalog sigue funcionando",
  buildCatalog([conTags("I", "pizzas", ["gourmet"])], null, null).pizzas[0].badge, undefined);

// El slug se genera del label y tiene que sacar los acentos. Si el regex de
// diacríticos se rompe, "Más pedida" da "m-s-pedida" y nada lo delata.
check("slugificar saca acentos",   slugificar("Más pedida"),          "mas-pedida");
check("slugificar saca la eñe",    slugificar("Con Ñoquis"),          "con-noquis");
check("slugificar limpia bordes",  slugificar("  ¡Nueva!  "),         "nueva");
check("slugificar junta espacios", slugificar("Clásica de la casa"),  "clasica-de-la-casa");

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
