# `/cocina` automática — Paso 3: la página lee el recetario

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `/cocina` se arme con las recetas de la base y se renueve sola cada minuto, sin deploy por cada cambio de receta.

**Architecture:** `lib/guia-cocina.ts` pasa de datos escritos a mano a funciones puras (`armarGuia`, `formatearCantidad`, `idDePreparacion`) que reciben filas del recetario. `lib/guia-cocina-datos.ts` lee esas filas con la clave de backend. `app/cocina/page.tsx` es async con `revalidate = 60`. Las fotos siguen saliendo de `REAL_PRODUCT_PHOTOS` (y de `FOTOS_EN_PRUEBA` para las 3 pizzas en prueba) hasta el paso 4.

**Tech Stack:** Next 16 (App Router, ISR en Netlify), `@insforge/sdk`, tests con `tsx`.

**Diseño:** `docs/superpowers/specs/2026-10-03-cocina-y-fotos-automaticas-design.md` (parte 2). Base de datos: paso 1 del recetario (`recetario-napolitano/docs/superpowers/plans/2026-10-03-cocina-paso-1-recetario.md`).

## Global Constraints

- En venta = `productos` con `proyecto_id = 'impasto'`, `categoria = 'pizzas'` y `archivado` distinto de `true`, vinculados a su receta por `precios_venta.nombre` **exacto** (como el resto del sitio). La Chipa (`categoria = 'otros'`) no entra.
- Próximamente / En prueba = recetas con `en_cocina`, salvo las que ya se muestran en venta.
- Orden en venta: `PIZZAS_DE_LA_CARTA` de `lib/orden-admin.ts`, después alfabético. Próximas y en prueba: alfabético.
- Base: "Salsa de tomate, 150 g" si `precio_salsa > 0`, más las líneas `base`; sin ninguna, "Sin salsa, base blanca".
- Cantidades: `kg` → g, `litro` → ml, `unidad` → unidad(es), `atado` → fracción (⅓, ½…) o atados. Nombres de ingredientes tal como están en la base.
- La página no pide ni muestra costos ni precios.
- Una pizza en venta sin receta muestra "Receta no cargada en el recetario".
- `revalidate = 60`; si la lectura falla al renovar, Next sigue sirviendo la última versión buena.

## Archivos

- Reescribir `lib/guia-cocina.ts` (funciones puras y tipos).
- Crear `lib/guia-cocina-datos.ts` (lectura).
- Reescribir `tests/guia-cocina.test.ts`.
- Modificar `app/cocina/page.tsx` y `app/cocina/cocina.css`.
- Modificar `CLAUDE.md`.

---

### Task 1: Armado puro de la guía

**Files:** `lib/guia-cocina.ts`, `tests/guia-cocina.test.ts`

**Interfaces — Produces:**
`armarGuia(filas: FilasGuia, fotoDe: (productoId: string | undefined, nombre: string) => string | undefined): Guia`,
`formatearCantidad(cantidad: number, unidad: string | null): string`, `idDePreparacion(nombre: string): string`,
tipos `FilasGuia`, `Guia`, `PizzaGuia`, `PreparacionGuia`, `LineaGuia`, constantes `BASE_DE_TODAS`, `SALSA`, `BLANCA`, `FOTOS_EN_PRUEBA`.

- [ ] **Step 1: Test que falla**

<!-- archivo: tests/guia-cocina.test.ts -->
```ts
import { armarGuia, formatearCantidad, idDePreparacion, SALSA, type FilasGuia } from "../lib/guia-cocina";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}

/* ── formato de cantidades ── */
chequear("cantidad · kg en gramos", formatearCantidad(0.25, "kg") === "250 g");
chequear("cantidad · decimales con coma", formatearCantidad(0.0125, "kg") === "12,5 g");
chequear("cantidad · litro en ml", formatearCantidad(0.01, "litro") === "10 ml");
chequear("cantidad · una unidad", formatearCantidad(1, "unidad") === "1 unidad");
chequear("cantidad · varias unidades", formatearCantidad(2, "unidad") === "2 unidades");
chequear("cantidad · fracción de atado", formatearCantidad(0.365, "atado") === "⅓ de atado");
chequear("cantidad · atados enteros", formatearCantidad(2, "atado") === "2 atados");
chequear("cantidad · cero o inválida", formatearCantidad(0, "kg") === "—" && formatearCantidad(NaN, "kg") === "—");

/* ── filas de ejemplo ── */
const ing = (id: string, nombre: string, unidad = "kg") => ({ id, nombre, unidad, gramos_por_unidad: null });
const rec = (id: string, nombre: string, extra: Record<string, unknown> = {}) =>
  ({ id, nombre, precio_salsa: 330, en_cocina: null, indicaciones: null, conservacion: null, ...extra });
let n = 0;
const lin = (receta_id: string, ingrediente_id: string, cantidad_kg: number, momento = "horno") =>
  ({ id: `l${++n}`, receta_id, ingrediente_id, cantidad_kg, momento });

const filas: FilasGuia = {
  productos: [
    { id: "p-diavola", nombre: "Diavola al Miele Piccante", categoria: "pizzas", archivado: false },
    { id: "p-muzza", nombre: "Muzzarella Impasto", categoria: "pizzas", archivado: false },
    { id: "p-bianca", nombre: "Bianca all'Aglio Confit", categoria: "pizzas", archivado: true },
    { id: "p-chipa", nombre: "Chipa", categoria: "otros", archivado: false },
    { id: "p-nueva", nombre: "Pizza Nueva", categoria: "pizzas", archivado: false },
  ],
  precios: [
    { id: "v1", receta_id: "r-diavola", nombre: "Diavola al Miele Piccante" },
    { id: "v2", receta_id: "r-muzza", nombre: "Muzzarella Impasto" },
    { id: "v3", receta_id: "r-bianca", nombre: "Bianca all'Aglio Confit" },
    { id: "v4", receta_id: "r-chipa", nombre: "Chipa" },
  ],
  recetas: [
    rec("r-diavola", "Diavola al Miele Piccante", { indicaciones: "La miel va en hilo." }),
    rec("r-muzza", "Muzzarella Impasto", { en_cocina: "proximamente" }),
    rec("r-bianca", "Bianca all'Aglio Confit", { precio_salsa: 0, en_cocina: "proximamente" }),
    rec("r-chipa", "Chipa"),
    rec("r-puttanesca", "Puttanesca Impasto", { en_cocina: "prueba" }),
    rec("r-blanca", "Blanca Sola", { precio_salsa: 0, en_cocina: "prueba" }),
    rec("r-miel", "Miel Picante", { precio_salsa: 0, indicaciones: "Baño María.", conservacion: "Varias semanas." }),
    rec("r-manteca", "Manteca de Ajo Confitado", { precio_salsa: 0 }),
    rec("r-ajo", "Ajo Confitado", { precio_salsa: 0 }),
  ],
  ingredientes: [
    ing("i-muzza", "Muzzarela"), ing("i-cala", "Calabresa"), ing("i-miel", "Miel"), ing("i-aji", "Aji Molido"),
    ing("i-mielp", "Miel Picante"), ing("i-oliva", "Oliva", "litro"), ing("i-ajo", "Ajo"),
    ing("i-ajoc", "Ajo Confitado"), ing("i-manteca", "Manteca"), ing("i-mantecaajo", "Manteca de Ajo Confitado"),
    ing("i-rucula", "Rucula", "atado"), ing("i-huevo", "Huevo", "unidad"),
  ],
  lineas: [
    lin("r-diavola", "i-cala", 0.1), lin("r-diavola", "i-muzza", 0.25), lin("r-diavola", "i-mielp", 0.02, "despues"),
    lin("r-muzza", "i-muzza", 0.25),
    lin("r-bianca", "i-muzza", 0.25), lin("r-bianca", "i-mantecaajo", 0.056, "base"), lin("r-bianca", "i-oliva", 0.003, "despues"),
    lin("r-puttanesca", "i-muzza", 0.22), lin("r-puttanesca", "i-huevo", 1),
    lin("r-blanca", "i-rucula", 0.365, "despues"), lin("r-blanca", "i-muzza", 0.2),
    lin("r-miel", "i-miel", 0.125), lin("r-miel", "i-aji", 0.005),
    lin("r-manteca", "i-manteca", 0.24), lin("r-manteca", "i-ajoc", 0.095),
    lin("r-ajo", "i-ajo", 0.2), lin("r-ajo", "i-oliva", 0.1),
  ],
  preparaciones: [
    { receta_id: "r-miel", ingrediente_id: "i-mielp", rinde_kg: 0.125 },
    { receta_id: "r-manteca", ingrediente_id: "i-mantecaajo", rinde_kg: 0.341 },
    { receta_id: "r-ajo", ingrediente_id: "i-ajoc", rinde_kg: 0.3 },
  ],
};
const fotos: Record<string, string> = { "p-diavola": "/diavola.jpg", "p-bianca": "/bianca.jpg" };
const guia = armarGuia(filas, (id, nombre) => (id ? fotos[id] : undefined) ?? (nombre === "Puttanesca Impasto" ? "/puttanesca.webp" : undefined));
const pizza = (nombre: string) => guia.pizzas.find((p) => p.nombre === nombre)!;
const estados = (e: string) => guia.pizzas.filter((p) => p.estado === e).map((p) => p.nombre);

/* ── qué pizzas y en qué estado ── */
chequear("venta · las no archivadas de la categoría pizzas, en el orden de la carta",
  JSON.stringify(estados("venta")) === JSON.stringify(["Muzzarella Impasto", "Diavola al Miele Piccante", "Pizza Nueva"]));
chequear("venta · la Chipa (categoría otros) no entra", !guia.pizzas.some((p) => p.nombre === "Chipa"));
chequear("próximamente · las marcadas, sin repetir las que están en venta",
  JSON.stringify(estados("proximamente")) === JSON.stringify(["Bianca all'Aglio Confit"]));
chequear("prueba · las marcadas, alfabéticas", JSON.stringify(estados("prueba")) === JSON.stringify(["Blanca Sola", "Puttanesca Impasto"]));
chequear("venta · sin receta vinculada lo avisa", pizza("Pizza Nueva").sinReceta && pizza("Pizza Nueva").horno.length === 0);

/* ── armado de cada pizza ── */
const diavola = pizza("Diavola al Miele Piccante");
chequear("armado · salsa si la receta la costea", diavola.salsa && !pizza("Bianca all'Aglio Confit").salsa);
chequear("armado · horno ordenado por cantidad",
  JSON.stringify(diavola.horno) === JSON.stringify([{ nombre: "Muzzarela", cantidad: "250 g" }, { nombre: "Calabresa", cantidad: "100 g" }]));
chequear("armado · después del horno con enlace a la preparación",
  JSON.stringify(diavola.despues) === JSON.stringify([{ nombre: "Miel Picante", cantidad: "20 g", preparacion: "miel-picante" }]));
chequear("armado · nota desde las indicaciones", diavola.nota === "La miel va en hilo.");
const bianca = pizza("Bianca all'Aglio Confit");
chequear("armado · línea de base", bianca.base.length === 1 && bianca.base[0].nombre === "Manteca de Ajo Confitado" && bianca.base[0].cantidad === "56 g");
chequear("armado · unidades y atados", pizza("Puttanesca Impasto").horno.some((l) => l.cantidad === "1 unidad")
  && pizza("Blanca Sola").despues[0].cantidad === "⅓ de atado");
chequear("armado · fotos por producto o por nombre", diavola.foto === "/diavola.jpg" && pizza("Puttanesca Impasto").foto === "/puttanesca.webp"
  && pizza("Muzzarella Impasto").foto === undefined);
chequear("armado · productoId solo si hay producto", bianca.productoId === "p-bianca" && pizza("Puttanesca Impasto").productoId === undefined);

/* ── preparaciones ── */
const prep = (nombre: string) => guia.preparaciones.find((p) => p.nombre === nombre)!;
chequear("preparaciones · las que usan las pizzas mostradas, incluidas las anidadas",
  JSON.stringify(guia.preparaciones.map((p) => p.nombre)) === JSON.stringify(["Miel Picante", "Manteca de Ajo Confitado", "Ajo Confitado"]));
chequear("preparaciones · para quién", JSON.stringify(prep("Ajo Confitado").para) === JSON.stringify(["Manteca de Ajo Confitado"])
  && JSON.stringify(prep("Manteca de Ajo Confitado").para) === JSON.stringify(["Bianca all'Aglio Confit"]));
chequear("preparaciones · próximamente si ninguna pizza en venta la usa",
  !prep("Miel Picante").proximamente && prep("Ajo Confitado").proximamente && prep("Manteca de Ajo Confitado").proximamente);
chequear("preparaciones · rinde, ingredientes, indicaciones y conservación",
  prep("Miel Picante").rinde === "125 g" && prep("Miel Picante").ingredientes[0].nombre === "Miel"
  && prep("Miel Picante").indicaciones === "Baño María." && prep("Miel Picante").conservacion === "Varias semanas.");
chequear("preparaciones · enlace entre preparaciones", prep("Manteca de Ajo Confitado").ingredientes.some((l) => l.preparacion === "ajo-confitado"));
chequear("preparaciones · ids de ancla únicos y sin espacios",
  new Set(guia.preparaciones.map((p) => p.id)).size === guia.preparaciones.length && guia.preparaciones.every((p) => /^[a-z0-9-]+$/.test(p.id)));
chequear("ancla · sin tildes", idDePreparacion("Pesto de Morrón") === "pesto-de-morron");

/* ── nada interno en lo que se ve ── */
const visible = JSON.stringify(guia);
chequear("visible · sin precios ni costos", !/\$|precio|costo|rinde_kg|cantidad_kg/i.test(visible.replace(/"rinde":/g, "")));
chequear("visible · la salsa por defecto", SALSA === "Salsa de tomate, 150 g");

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
```

- [ ] **Step 2:** `npx tsx tests/guia-cocina.test.ts` → falla (no existen `armarGuia` ni `formatearCantidad`).

- [ ] **Step 3: Implementación**

<!-- archivo: lib/guia-cocina.ts -->
```ts
/**
 * Guía de armado para la cocina (`/cocina`), armada con el recetario.
 *
 * Funciones puras: reciben las filas de la base (`guia-cocina-datos.ts` las lee) y
 * devuelven las pizzas y las preparaciones. Sin base ni React, para testearse con
 * `tsx`. Nunca reciben precios ni costos: la página no los muestra.
 *
 * El recetario es la única fuente: cada línea dice si va en la base, en el horno o
 * después (`receta_ingredientes.momento`), y cada receta trae sus indicaciones,
 * conservación y estado para la cocina (`recetas.en_cocina`).
 * Diseño: docs/superpowers/specs/2026-10-03-cocina-y-fotos-automaticas-design.md.
 */
import { PIZZAS_DE_LA_CARTA } from "./orden-admin";

export type EstadoPizza = "venta" | "proximamente" | "prueba";

export interface FilaProducto { id: string; nombre: string; categoria: string | null; archivado: boolean | null }
export interface FilaPrecio { id: string; receta_id: string | null; nombre: string }
export interface FilaReceta {
  id: string; nombre: string; precio_salsa: number | string | null;
  en_cocina: string | null; indicaciones: string | null; conservacion: string | null;
}
export interface FilaLinea { id: string; receta_id: string; ingrediente_id: string; cantidad_kg: number | string; momento: string | null }
export interface FilaIngrediente { id: string; nombre: string; unidad: string | null; gramos_por_unidad: number | string | null }
export interface FilaPreparacion { receta_id: string; ingrediente_id: string; rinde_kg: number | string }
export interface FilasGuia {
  productos: FilaProducto[]; precios: FilaPrecio[]; recetas: FilaReceta[];
  lineas: FilaLinea[]; ingredientes: FilaIngrediente[]; preparaciones: FilaPreparacion[];
}

export interface LineaGuia {
  nombre: string;
  cantidad: string;
  /** Ancla de la tarjeta, si el ingrediente es una preparación. */
  preparacion?: string;
}
export interface PizzaGuia {
  nombre: string;
  estado: EstadoPizza;
  /** Id en `productos`; las pizzas en prueba no tienen. */
  productoId?: string;
  foto?: string;
  salsa: boolean;
  base: LineaGuia[];
  horno: LineaGuia[];
  despues: LineaGuia[];
  nota?: string;
  sinReceta: boolean;
}
export interface PreparacionGuia {
  id: string;
  nombre: string;
  /** Pizzas (o preparaciones) que la usan, en el orden de la guía. */
  para: string[];
  rinde: string;
  ingredientes: LineaGuia[];
  indicaciones?: string;
  conservacion?: string;
  /** Verdadero cuando ninguna pizza en venta la usa, ni directa ni a través de otra preparación. */
  proximamente: boolean;
}
export interface Guia { pizzas: PizzaGuia[]; preparaciones: PreparacionGuia[] }

export const SALSA = "Salsa de tomate, 150 g";
export const BLANCA = "Sin salsa, base blanca";
export const BASE_DE_TODAS: string[] = [
  "Bollo de unos 300 g.",
  "Salsa de tomate: 150 g de tomate triturado por pizza, en las que la llevan. Las que van en blanco no la llevan.",
];

/** Fotos de las pizzas en prueba, que todavía no son productos. Hasta el paso 4 (fotos automáticas). */
export const FOTOS_EN_PRUEBA: Record<string, string> = {
  "Pomodorini Confit e Ricotta": "/images/cocina/pomodorini-confit-ricotta-v1.webp",
  "Pesto Rosso e Ricotta": "/images/cocina/pesto-rosso-ricotta-v1.webp",
  "Puttanesca Impasto": "/images/cocina/puttanesca-impasto-v1.webp",
};

/** Id para el ancla de cada preparación: minúsculas, sin tildes ni espacios. */
export function idDePreparacion(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const numero = (n: number, decimales = 1) => n.toLocaleString("es-AR", { maximumFractionDigits: decimales });
const FRACCIONES: [number, string][] = [[1 / 4, "¼"], [1 / 3, "⅓"], [1 / 2, "½"], [2 / 3, "⅔"], [3 / 4, "¾"]];

/** Cantidad para leer en la cocina: gramos, mililitros, unidades o fracción de atado. */
export function formatearCantidad(cantidad: number, unidad: string | null): string {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return "—";
  switch (unidad) {
    case "kg": return `${numero(cantidad * 1000)} g`;
    case "litro": return `${numero(cantidad * 1000)} ml`;
    // Una fracción chica se muestra entera: redondearla a "0" escondería un error de carga.
    case "unidad": return `${numero(cantidad, cantidad < 1 ? 3 : 2)} ${cantidad === 1 ? "unidad" : "unidades"}`;
    case "atado": {
      const fraccion = FRACCIONES.find(([valor]) => Math.abs(valor - cantidad) < 0.04);
      if (fraccion) return `${fraccion[1]} de atado`;
      return `${numero(cantidad, 2)} ${cantidad === 1 ? "atado" : "atados"}`;
    }
    default: return `${numero(cantidad, 3)} ${unidad ?? ""}`.trim();
  }
}

function agrupar<T>(filas: T[], clave: (f: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const f of filas) mapa.set(clave(f), [...(mapa.get(clave(f)) ?? []), f]);
  return mapa;
}

const momentoDe = (l: FilaLinea) => (l.momento === "base" || l.momento === "despues" ? l.momento : "horno");

export function armarGuia(
  filas: FilasGuia,
  fotoDe: (productoId: string | undefined, nombre: string) => string | undefined,
): Guia {
  const ingredientes = new Map(filas.ingredientes.map((i) => [i.id, i]));
  const recetas = new Map(filas.recetas.map((r) => [r.id, r]));
  const prepPorIngrediente = new Map(filas.preparaciones.map((p) => [p.ingrediente_id, p]));
  const prepPorReceta = new Map(filas.preparaciones.map((p) => [p.receta_id, p]));
  const lineasPorReceta = agrupar(filas.lineas, (l) => l.receta_id);
  // Exacto, como la carta y Carro Fogón: el producto encuentra su precio por nombre.
  const precioPorNombre = new Map(filas.precios.map((p) => [p.nombre, p]));
  const precioPorReceta = new Map(filas.precios.filter((p) => p.receta_id).map((p) => [p.receta_id!, p]));
  const productoPorNombre = new Map(filas.productos.map((p) => [p.nombre, p]));

  // Para ordenar: lo que más pesa primero. Unidades con gramaje cuentan su peso; los atados, al final.
  const peso = (l: FilaLinea) => {
    const i = ingredientes.get(l.ingrediente_id);
    const cantidad = Number(l.cantidad_kg) || 0;
    if (i?.unidad === "kg" || i?.unidad === "litro") return cantidad;
    const gramos = Number(i?.gramos_por_unidad);
    return gramos > 0 ? (cantidad * gramos) / 1000 : 0;
  };
  const nombreDe = (l: FilaLinea) => ingredientes.get(l.ingrediente_id)?.nombre ?? "";
  const ordenar = (ls: FilaLinea[]) => [...ls].sort((a, b) => peso(b) - peso(a) || nombreDe(a).localeCompare(nombreDe(b), "es"));
  const linea = (l: FilaLinea): LineaGuia => {
    const nombre = nombreDe(l) || "Ingrediente sin nombre";
    const cantidad = formatearCantidad(Number(l.cantidad_kg), ingredientes.get(l.ingrediente_id)?.unidad ?? null);
    return prepPorIngrediente.has(l.ingrediente_id) ? { nombre, cantidad, preparacion: idDePreparacion(nombre) } : { nombre, cantidad };
  };

  const recetaDePizza = new Map<PizzaGuia, FilaReceta>();
  const armarPizza = (nombre: string, estado: EstadoPizza, receta: FilaReceta | undefined, productoId: string | undefined): PizzaGuia => {
    const ls = receta ? ordenar(lineasPorReceta.get(receta.id) ?? []) : [];
    const de = (momento: string) => ls.filter((l) => momentoDe(l) === momento).map(linea);
    const pizza: PizzaGuia = {
      nombre, estado, salsa: !!receta && Number(receta.precio_salsa) > 0,
      base: de("base"), horno: de("horno"), despues: de("despues"), sinReceta: !receta,
    };
    if (productoId) pizza.productoId = productoId;
    const foto = fotoDe(productoId, nombre);
    if (foto) pizza.foto = foto;
    const nota = receta?.indicaciones?.trim();
    if (nota) pizza.nota = nota;
    if (receta) recetaDePizza.set(pizza, receta);
    return pizza;
  };

  const posicion = (nombre: string) => {
    const i = PIZZAS_DE_LA_CARTA.findIndex((n) => n.toLowerCase() === nombre.trim().toLowerCase());
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const enVenta = filas.productos
    .filter((p) => p.categoria === "pizzas" && p.archivado !== true)
    .sort((a, b) => posicion(a.nombre) - posicion(b.nombre) || a.nombre.localeCompare(b.nombre, "es"))
    .map((p) => {
      const precio = precioPorNombre.get(p.nombre);
      return armarPizza(p.nombre, "venta", precio?.receta_id ? recetas.get(precio.receta_id) : undefined, p.id);
    });
  const recetasEnVenta = new Set([...recetaDePizza.values()].map((r) => r.id));
  const marcadas = (estado: EstadoPizza) => filas.recetas
    .filter((r) => r.en_cocina === estado && !recetasEnVenta.has(r.id))
    .map((r) => {
      const precio = precioPorReceta.get(r.id);
      const nombre = precio?.nombre ?? r.nombre;
      return armarPizza(nombre, estado, r, productoPorNombre.get(nombre)?.id);
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const pizzas = [...enVenta, ...marcadas("proximamente"), ...marcadas("prueba")];

  // Preparaciones que usan las pizzas mostradas, directas o a través de otra preparación.
  const usos = new Map<string, { para: Set<string>; venta: boolean }>();
  const visitar = (recetaId: string, quien: string, venta: boolean, profundidad: number) => {
    if (profundidad > 8) return;
    for (const l of ordenar(lineasPorReceta.get(recetaId) ?? [])) {
      const prep = prepPorIngrediente.get(l.ingrediente_id);
      if (!prep) continue;
      const uso = usos.get(prep.receta_id) ?? { para: new Set<string>(), venta: false };
      uso.para.add(quien);
      uso.venta ||= venta;
      usos.set(prep.receta_id, uso);
      const receta = recetas.get(prep.receta_id);
      if (receta) visitar(prep.receta_id, ingredientes.get(prep.ingrediente_id)?.nombre ?? receta.nombre, venta, profundidad + 1);
    }
  };
  for (const p of pizzas) {
    const receta = recetaDePizza.get(p);
    if (receta) visitar(receta.id, p.nombre, p.estado === "venta", 0);
  }

  const preparaciones = [...usos].flatMap(([recetaId, uso]) => {
    const receta = recetas.get(recetaId);
    const prep = prepPorReceta.get(recetaId);
    if (!receta || !prep) return [];
    const nombre = ingredientes.get(prep.ingrediente_id)?.nombre ?? receta.nombre;
    const tarjeta: PreparacionGuia = {
      id: idDePreparacion(nombre), nombre, para: [...uso.para],
      rinde: formatearCantidad(Number(prep.rinde_kg), "kg"),
      ingredientes: ordenar(lineasPorReceta.get(recetaId) ?? []).map(linea),
      proximamente: !uso.venta,
    };
    const indicaciones = receta.indicaciones?.trim();
    if (indicaciones) tarjeta.indicaciones = indicaciones;
    const conservacion = receta.conservacion?.trim();
    if (conservacion) tarjeta.conservacion = conservacion;
    return [tarjeta];
  });
  // Orden estable: dentro de cada grupo queda el orden en que aparecen al recorrer la guía.
  preparaciones.sort((a, b) => Number(a.proximamente) - Number(b.proximamente));
  return { pizzas, preparaciones };
}
```

Orden de las preparaciones: primero las de pizzas en venta, en el orden en que aparecen al recorrer la guía; después las próximas, igual.

- [ ] **Step 4:** `npx tsx tests/guia-cocina.test.ts` → "Todos los casos pasan".
- [ ] **Step 5:** Commit `feat(cocina): la guía se arma con las filas del recetario`.

### Task 2: Lectura y página

**Files:** `lib/guia-cocina-datos.ts`, `app/cocina/page.tsx`, `app/cocina/cocina.css`

<!-- archivo: lib/guia-cocina-datos.ts -->
```ts
import { db } from "@/lib/insforge";
import { readPages } from "@/lib/read-pages";
import type { FilasGuia } from "@/lib/guia-cocina";

/**
 * Lee del recetario lo que arma `/cocina`, con la clave de backend. No pide precios
 * ni costos (solo `precio_salsa`, para saber si la pizza lleva salsa). Si una lectura
 * falla, tira: con `revalidate`, Next sigue sirviendo la última versión buena.
 */
export async function leerFilasGuia(): Promise<FilasGuia> {
  const t = db.database;
  const [productos, precios, recetas, lineas, ingredientes, preparaciones] = await Promise.all([
    readPages((s, e) => t.from("productos").select("id,nombre,categoria,archivado")
      .eq("proyecto_id", "impasto").eq("categoria", "pizzas").order("id", { ascending: true }).range(s, e)),
    readPages((s, e) => t.from("precios_venta").select("id,receta_id,nombre").order("id", { ascending: true }).range(s, e)),
    readPages((s, e) => t.from("recetas").select("id,nombre,precio_salsa,en_cocina,indicaciones,conservacion").order("id", { ascending: true }).range(s, e)),
    readPages((s, e) => t.from("receta_ingredientes").select("id,receta_id,ingrediente_id,cantidad_kg,momento").order("id", { ascending: true }).range(s, e)),
    readPages((s, e) => t.from("ingredientes").select("id,nombre,unidad,gramos_por_unidad").order("id", { ascending: true }).range(s, e)),
    // `preparaciones` no tiene columna id (readPages la exige) y son pocas filas.
    t.from("preparaciones").select("receta_id,ingrediente_id,rinde_kg").limit(1000),
  ]);
  const leidas = { productos, precios, recetas, lineas, ingredientes, preparaciones };
  for (const [nombre, r] of Object.entries(leidas)) {
    if (r.error || !Array.isArray(r.data)) throw new Error(`/cocina: no se pudo leer ${nombre}`);
  }
  return {
    productos: productos.data as FilasGuia["productos"],
    precios: precios.data as FilasGuia["precios"],
    recetas: recetas.data as FilasGuia["recetas"],
    lineas: lineas.data as FilasGuia["lineas"],
    ingredientes: ingredientes.data as FilasGuia["ingredientes"],
    preparaciones: preparaciones.data as FilasGuia["preparaciones"],
  };
}
```

- [ ] **Step 1: Página** — `app/cocina/page.tsx` completo:

<!-- archivo: app/cocina/page.tsx -->
```tsx
import {
  BASE_DE_TODAS,
  BLANCA,
  FOTOS_EN_PRUEBA,
  SALSA,
  armarGuia,
  type LineaGuia,
  type PizzaGuia,
  type PreparacionGuia,
} from "@/lib/guia-cocina";
import { leerFilasGuia } from "@/lib/guia-cocina-datos";
import { REAL_PRODUCT_PHOTOS } from "@/lib/stock-images";

// Se arma con el recetario y se renueva cada minuto. Si la base falla al renovar,
// Next sigue mostrando la última versión buena.
export const revalidate = 60;

const fotoDe = (productoId: string | undefined, nombre: string) =>
  (productoId ? REAL_PRODUCT_PHOTOS[productoId] : undefined) ?? FOTOS_EN_PRUEBA[nombre];

function Nombre({ l }: { l: LineaGuia }) {
  return l.preparacion ? <a href={`#prep-${l.preparacion}`}>{l.nombre}</a> : <>{l.nombre}</>;
}

function Lista({ lineas }: { lineas: LineaGuia[] }) {
  return (
    <ul className="ck-ing">
      {lineas.map((l) => (
        <li key={l.nombre}>
          <span><Nombre l={l} /></span>
          <b>{l.cantidad}</b>
        </li>
      ))}
    </ul>
  );
}

function TarjetaPizza({ p, primera }: { p: PizzaGuia; primera: boolean }) {
  return (
    <article className="ck-pizza">
      {p.foto ? (
        // Las fotos del bucket redirigen al CDN: el sitio las muestra con <img>
        // y no con next/image, que solo acepta el host del bucket.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="ck-foto"
          src={p.foto}
          alt={`Foto de ${p.nombre}`}
          width={1200}
          height={896}
          loading={primera ? "eager" : "lazy"}
          decoding="async"
        />
      ) : (
        <div className="ck-sinfoto">Sin foto todavía</div>
      )}
      <div className="ck-cuerpo">
        <h3>{p.nombre}</h3>
        {p.sinReceta ? (
          <p className="ck-nota">Receta no cargada en el recetario.</p>
        ) : (
          <>
            <p className="ck-base-pizza">
              <span>Base</span>
              {!p.salsa && p.base.length === 0 && BLANCA}
              {p.salsa && SALSA}
              {p.base.map((l, i) => (
                <span key={l.nombre} className="ck-base-linea">
                  {(p.salsa || i > 0) && " + "}
                  <Nombre l={l} />, {l.cantidad}
                </span>
              ))}
            </p>
            {p.horno.length > 0 && <Lista lineas={p.horno} />}
            {p.despues.length > 0 && (
              <div className="ck-despues">
                <h4>Después del horno</h4>
                <Lista lineas={p.despues} />
              </div>
            )}
          </>
        )}
        {p.nota && <p className="ck-nota">{p.nota}</p>}
      </div>
    </article>
  );
}

function TarjetaPreparacion({ p }: { p: PreparacionGuia }) {
  return (
    <article className="ck-prep" id={`prep-${p.id}`}>
      <h3>{p.nombre}</h3>
      <p className="ck-para">Para: {p.para.join(", ")} · Tanda: rinde {p.rinde}</p>
      <Lista lineas={p.ingredientes} />
      {p.indicaciones && <p>{p.indicaciones}</p>}
      {p.conservacion && (
        <p className="ck-cons">
          <span>Se guarda</span>
          {p.conservacion}
        </p>
      )}
    </article>
  );
}

export default async function CocinaPage() {
  const { pizzas, preparaciones } = armarGuia(await leerFilasGuia(), fotoDe);
  const enVenta = pizzas.filter((p) => p.estado === "venta");
  const proximas = pizzas.filter((p) => p.estado === "proximamente");
  const enPrueba = pizzas.filter((p) => p.estado === "prueba");
  const prepsHoy = preparaciones.filter((p) => !p.proximamente);
  const prepsProximas = preparaciones.filter((p) => p.proximamente);

  return (
    <main className="ck">
      <header className="ck-top">
        <p className="ck-kicker">Impasto · Cocina</p>
        <h1>Armado de pizzas</h1>
        <ul className="ck-base">
          {BASE_DE_TODAS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </header>

      <nav className="ck-nav" aria-label="Secciones">
        <a href="#venta">En venta ({enVenta.length})</a>
        {proximas.length > 0 && <a href="#proximamente">Próximamente ({proximas.length})</a>}
        {enPrueba.length > 0 && <a href="#prueba">En prueba ({enPrueba.length})</a>}
        <a href="#preparaciones">Preparaciones ({preparaciones.length})</a>
      </nav>

      <section id="venta">
        <h2>En venta</h2>
        <div className="ck-grid">
          {enVenta.map((p, i) => (
            <TarjetaPizza key={p.nombre} p={p} primera={i < 2} />
          ))}
        </div>
      </section>

      {proximas.length > 0 && (
        <section id="proximamente">
          <h2>Próximamente</h2>
          <p className="ck-aviso">Todavía no están en la carta. Pueden cambiar antes de salir.</p>
          <div className="ck-grid">
            {proximas.map((p) => (
              <TarjetaPizza key={p.nombre} p={p} primera={false} />
            ))}
          </div>
        </section>
      )}

      {enPrueba.length > 0 && (
        <section id="prueba">
          <h2>En prueba</h2>
          <p className="ck-aviso">
            Pizzas nuevas que todavía se están probando. Los gramos pueden cambiar. Las imágenes son ilustrativas.
          </p>
          <div className="ck-grid">
            {enPrueba.map((p) => (
              <TarjetaPizza key={p.nombre} p={p} primera={false} />
            ))}
          </div>
        </section>
      )}

      <section id="preparaciones">
        <h2>Preparaciones</h2>
        <p className="ck-aviso">
          Lo que lleva ajo, hierbas o verduras en aceite va tapado en la heladera y se usa en 4 días, o se congela en
          porciones.
        </p>
        <h3 className="ck-subtitulo">Para las pizzas en venta</h3>
        <div className="ck-grid ck-grid-preps">
          {prepsHoy.map((p) => (
            <TarjetaPreparacion key={p.id} p={p} />
          ))}
        </div>
        {prepsProximas.length > 0 && (
          <>
            <h3 className="ck-subtitulo">Para las que todavía no están en la carta</h3>
            <div className="ck-grid ck-grid-preps">
              {prepsProximas.map((p) => (
                <TarjetaPreparacion key={p.id} p={p} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: CSS** — en `app/cocina/cocina.css`, después de `.ck-base-pizza span, .ck-cons span {…}`, para que las líneas de base no tomen el estilo de etiqueta:

```css
.ck-base-pizza .ck-base-linea {
  font-size: inherit;
  letter-spacing: normal;
  text-transform: none;
  color: inherit;
}
```

y `.ck-despues .ck-ing li { border-bottom-color: rgba(0, 0, 0, 0.12); }` si el punteado no se distingue sobre el fondo dorado (verificar en el navegador).

- [ ] **Step 3: Verificación local**
  - `npx tsx tests/guia-cocina.test.ts`, `npx tsc --noEmit`, `npx eslint app/cocina lib/guia-cocina.ts lib/guia-cocina-datos.ts tests/guia-cocina.test.ts`, `pnpm test`, `pnpm build` (con `.env.local`; `/cocina` debe salir como ISR, no como estática pura).
  - `pnpm dev` y abrir `/cocina`: 9 en venta (sin Chipa), 8 próximas, 3 en prueba; Porteña con Pesto de Morrón y Provenzal después del horno y Morrones Asados enlazado; Bianca all'Aglio con base "Manteca de Ajo Confitado, 56 g"; tarjetas de preparaciones con ingredientes y rinde; enlaces a anclas; vista de celular.
  - Comparar con producción (`www.impastopizzas.com/cocina`): mismos nombres de pizzas por sección; las diferencias son las del recetario (nombres de ingredientes de la base, gramos, preparaciones con receta).

- [ ] **Step 4:** Commit `feat(cocina): /cocina se arma con el recetario y se renueva cada minuto`, actualizar `CLAUDE.md` (sección `/cocina`), push y verificar en producción que un cambio de indicación en Recetas aparece en `/cocina` en menos de 2 minutos (y restaurarlo).
