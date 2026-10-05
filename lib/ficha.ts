/**
 * Ficha de producto: la foto en grande con lo necesario para pedir.
 * Spec: docs/superpowers/specs/2026-09-28-ficha-producto-design.md
 *
 * Sin React ni `db`: se testea con `tsx` (tests/ficha.test.ts).
 */
import { fmt } from "./utils";
import type { Bebida, CartItem, Empanada, Pizza } from "../types";

export type TipoFicha = "pizza" | "empanada" | "bebida";

/** `clase` es la misma que usa la tarjeta, para que el cartelito se vea igual. */
export interface BadgeFicha { texto: string; clase: string }

export interface FichaItem {
  id: string;
  tipo: TipoFicha;
  nombre: string;
  desc: string;
  precio: number;
  /** Lo que muestra la tarjeta como precio (en empanadas sin precio, el peso). */
  precioTexto: string;
  badges: BadgeFicha[];
  agotado: boolean;
  tags: string[];
  foto?: string;
}

/* ── normalización: mismos cartelitos y precio que la tarjeta ── */

export function fichaDePizza(p: Pizza): FichaItem {
  const agotado = p.disponible === false;
  const badges: BadgeFicha[] = [];
  if (p.popular && !agotado) badges.push({ texto: "★ Más pedida", clase: "p-badge top" });
  if (p.tags.includes("vegetariana")) badges.push({ texto: "Veggie", clase: "p-badge veg" });
  if (p.tags.includes("picante")) badges.push({ texto: "Picante", clase: "p-badge hot" });
  return {
    id: p.id, tipo: "pizza", nombre: p.nombre, desc: p.desc, foto: p.foto,
    precio: p.precio, precioTexto: fmt(p.precio), badges, agotado, tags: p.tags,
  };
}

/** `pesoTexto`: lo que muestra la tarjeta cuando la empanada no tiene precio unitario. */
export function fichaDeEmpanada(e: Empanada, pesoTexto: string): FichaItem {
  const precio = Number(e.precio) || 0;
  return {
    id: e.id, tipo: "empanada", nombre: e.nombre, desc: e.desc, foto: e.foto,
    precio, precioTexto: precio > 0 ? fmt(precio) : pesoTexto,
    badges: e.badge ? [{ texto: e.badge.label, clase: `p-badge-tag c-${e.badge.color}` }] : [],
    agotado: e.disponible === false, tags: e.tags,
  };
}

export function fichaDeBebida(b: Bebida): FichaItem {
  return {
    id: b.id, tipo: "bebida", nombre: b.nombre, desc: "", foto: b.foto,
    precio: b.precio, precioTexto: fmt(b.precio), badges: [], agotado: b.disponible === false, tags: [],
  };
}

/* ── líneas del carrito: las usan la tarjeta y la ficha, así no pueden diferir ── */

export type LineaCarrito = Omit<CartItem, "cartId">;

export function lineaDePizza(p: { id: string; nombre: string; precio: number }): LineaCarrito {
  return { key: p.id, type: "pizza", name: p.nombre, price: p.precio, illus: p.id, qty: 1 };
}

export function lineaDeBebida(b: { id: string; nombre: string; precio: number }): LineaCarrito {
  return { key: b.id, type: "bebida", name: b.nombre, price: b.precio, qty: 1 };
}

/* ── navegación y gestos ── */

/** Índice anterior o siguiente; `null` en los bordes (no hay vuelta circular). */
export function vecino(indice: number, total: number, sentido: 1 | -1): number | null {
  const destino = indice + sentido;
  return destino >= 0 && destino < total ? destino : null;
}

export type Eje = "horizontal" | "vertical";

/** Distancia mínima antes de decidir el eje: un temblor del dedo no mueve nada. */
export const UMBRAL_EJE = 10;
/** Mismo umbral que la hoja del carrito (CartDrawer). */
export const UMBRAL_CIERRE = 120;
/**
 * px/ms, promedio de todo el gesto. Un gesto más rápido que esto cuenta aunque
 * sea corto… Con 0,5 no pasaba un deslizamiento corto y decidido medido en
 * Chrome (70 px en 163 ms): el promedio incluye el instante en que se apoya el dedo.
 */
export const VELOCIDAD_RAPIDA = 0.3;
/** …siempre que recorra al menos esto: si no, un toque nervioso cerraría la ficha. */
export const DISTANCIA_MINIMA_RAPIDA = 30;

/**
 * `null` hasta que el dedo se mueve UMBRAL_EJE; después, el eje que domina.
 * Quien lo llama lo fija durante todo el gesto: un deslizamiento en diagonal
 * no mueve la foto en dos direcciones.
 */
export function ejeDelGesto(dx: number, dy: number): Eje | null {
  if (Math.hypot(dx, dy) < UMBRAL_EJE) return null;
  return Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
}

export type Soltar = "anterior" | "siguiente" | "cerrar" | "quedarse";

export interface GestoSoltado {
  eje: Eje | null;
  dx: number;
  dy: number;
  /** ms entre apoyar y soltar. */
  dt: number;
  /** Ancho de la foto en px. */
  ancho: number;
  hayAnterior: boolean;
  haySiguiente: boolean;
}

function esRapido(distancia: number, dt: number): boolean {
  return distancia >= DISTANCIA_MINIMA_RAPIDA && distancia / Math.max(1, dt) >= VELOCIDAD_RAPIDA;
}

export function resolverSoltar(g: GestoSoltado): Soltar {
  if (g.eje === "horizontal") {
    const distancia = Math.abs(g.dx);
    if (distancia <= g.ancho / 4 && !esRapido(distancia, g.dt)) return "quedarse";
    if (g.dx < 0) return g.haySiguiente ? "siguiente" : "quedarse";
    return g.hayAnterior ? "anterior" : "quedarse";
  }
  if (g.eje === "vertical" && g.dy > 0 && (g.dy > UMBRAL_CIERRE || esRapido(g.dy, g.dt))) return "cerrar";
  return "quedarse";
}

/** En un borde la foto se resiste: se mueve un tercio de lo que se mueve el dedo. */
export function resistencia(dx: number, hayVecino: boolean): number {
  return hayVecino ? dx : dx / 3;
}

/* ── entorno (no se testea: depende del navegador) ── */

/** Mismo corte que `@media (max-width:760px)` en impasto.css. */
export const CORTE_MOBILE = "(max-width: 760px)";
export const esMobile = () => typeof window !== "undefined" && window.matchMedia(CORTE_MOBILE).matches;
export const sinAnimaciones = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
