import {
  PIZZAS,
  PREPARACIONES,
  BASE_DE_TODAS,
  idDePreparacion,
} from "../lib/guia-cocina";
import { REAL_PRODUCT_PHOTOS } from "../lib/stock-images";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}

/* ── cantidades ── */
chequear("pizzas · son 18", PIZZAS.length === 18);
chequear("pizzas · 10 en venta", PIZZAS.filter((p) => p.estado === "venta").length === 10);
chequear("pizzas · 8 próximamente", PIZZAS.filter((p) => p.estado === "proximamente").length === 8);
chequear("preparaciones · hay al menos una", PREPARACIONES.length > 0);

/* ── integridad de cada pizza ── */
const nombres = PIZZAS.map((p) => p.nombre);
chequear("pizzas · nombres únicos", new Set(nombres).size === nombres.length);
chequear(
  "pizzas · todas tienen base",
  PIZZAS.every((p) => p.base.trim().length > 0),
);
chequear(
  "pizzas · todas tienen al menos un ingrediente con cantidad",
  PIZZAS.every((p) => p.ingredientes.length > 0 && p.ingredientes.every((i) => i.nombre.trim() && /\d|[⅓½¼]|a gusto|1 unidad/.test(i.cantidad))),
);
chequear(
  "pizzas · cada foto existe en REAL_PRODUCT_PHOTOS",
  PIZZAS.every((p) => typeof REAL_PRODUCT_PHOTOS[p.productoId] === "string"),
);
chequear(
  "pizzas · los productoId no se repiten",
  new Set(PIZZAS.map((p) => p.productoId)).size === PIZZAS.length,
);

/* ── preparaciones enlazadas ── */
const preps = new Set(PREPARACIONES.map((p) => p.nombre));
chequear("preparaciones · nombres únicos", preps.size === PREPARACIONES.length);
chequear(
  "preparaciones · cada una nombrada por una pizza existe",
  PIZZAS.every((p) => p.preparaciones.every((n) => preps.has(n))),
);
const usadas = new Set(PIZZAS.flatMap((p) => p.preparaciones));
chequear(
  "preparaciones · cada una la usa alguna pizza",
  PREPARACIONES.every((p) => usadas.has(p.nombre)),
);
chequear(
  "preparaciones · todas tienen receta y conservación",
  PREPARACIONES.every((p) => p.receta.trim().length > 0 && p.conservacion.trim().length > 0),
);
chequear(
  "preparaciones · marcan próximamente solo si ninguna pizza en venta la usa",
  PREPARACIONES.every((prep) => {
    const enVenta = PIZZAS.some((pz) => pz.estado === "venta" && pz.preparaciones.includes(prep.nombre));
    return prep.proximamente === !enVenta;
  }),
);
chequear(
  "preparaciones · ids de ancla únicos y sin espacios",
  new Set(PREPARACIONES.map((p) => idDePreparacion(p.nombre))).size === PREPARACIONES.length &&
    PREPARACIONES.every((p) => /^[a-z0-9-]+$/.test(idDePreparacion(p.nombre))),
);

/* ── nada interno en lo que se ve ── */
const visible: string[] = [...BASE_DE_TODAS];
for (const p of PIZZAS) {
  visible.push(p.nombre, p.base, p.despues ?? "", p.nota ?? "");
  for (const i of p.ingredientes) visible.push(i.nombre, i.cantidad);
}
for (const p of PREPARACIONES) visible.push(p.nombre, p.para, p.receta, p.conservacion);
const PROHIBIDO = /\$|costo|precio|recetario|a probar|decime|propuesta|pendiente/i;
chequear(
  "visible · sin costos, precios ni notas internas",
  visible.every((t) => !PROHIBIDO.test(t)),
);
chequear(
  "visible · escribe napoletana, no napolitana",
  visible.every((t) => !/napolitana/i.test(t)),
);

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
