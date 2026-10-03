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
