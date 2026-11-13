/**
 * Motor de promociones (etapa 2). Puro: sin base, sin React. Lo usan la cotización de la web, el carrito
 * (para mostrar el ahorro) y el POS (copia en carroFogon/next-app/src/lib/promos-aplicar.ts: mantenerlas iguales).
 *
 * Contrato: el pedido se describe como líneas normalizadas; el motor devuelve, por línea, cuántas unidades
 * van a qué precio. El descuento SIEMPRE queda dentro del precio de las líneas (nunca una línea negativa),
 * así el recetario reparte bien lo cobrado entre comida, bebidas y envío.
 */
import type { Oferta } from "./promos";

export type TipoLinea = "pizza" | "mitad" | "bebida" | "otro";
export interface LineaPromo {
  /** Posición de la línea en el pedido original. */
  idx: number;
  /** Id de `productos`. Mitad y mitad: null (cuenta como pizza solo en descuentos "todas las pizzas"). */
  productoId: string | null;
  nombre: string;
  tipo: TipoLinea;
  /** Precio de lista por unidad. */
  precio: number;
  cantidad: number;
  /** Solo mitad y mitad: ids de las dos mitades, para saber si cuenta en un regalo con pizzas excluidas. */
  mitades?: [string, string] | null;
}
export interface BebidaRegalo { id: string; nombre: string; precio: number }
export interface MarcaPromo { id: string; nombre: string; tipo: Oferta["tipo"]; precioLista: number }
/** Una porción de una línea: `cantidad` unidades a `precio` cada una. Una línea puede partirse en varias. */
export interface TramoPromo { idx: number; cantidad: number; precio: number; promo: MarcaPromo | null }
export interface ResultadoPromo {
  oferta: { id: string; nombre: string; titulo: string; tipo: Oferta["tipo"] };
  tramos: TramoPromo[];
  /** Línea nueva de regalo (solo tipo regalo). */
  regalo: { bebida: BebidaRegalo; cantidad: number; precio: number; promo: MarcaPromo } | null;
  /** Lo que el cliente se ahorra contra precio de lista (incluye el regalo). */
  ahorro: number;
  /** Veces que se aplicó (combos repetidos). */
  veces: number;
}
export type ErrorPromo = { error: string };

/** Noche de negocio (06:00 a 05:59, hora argentina) como fecha y día de la semana (0 = domingo). */
export function nocheLocal(ahora: Date): { fecha: string; dia: number } {
  const ar = new Date(ahora.getTime() - 3 * 3600_000 - 6 * 3600_000);
  const fecha = ar.toISOString().slice(0, 10);
  return { fecha, dia: ar.getUTCDay() };
}

/** Aprobadas, del día y dentro de las fechas. */
export function ofertasVigentes<T extends Pick<Oferta, "estado" | "dias" | "desde" | "hasta">>(ofertas: readonly T[], ahora: Date): T[] {
  const { fecha, dia } = nocheLocal(ahora);
  return ofertas.filter(o => o.estado === "aprobada" && o.dias.includes(dia) && (!o.desde || o.desde <= fecha) && (!o.hasta || o.hasta >= fecha));
}

interface Unidad { idx: number; productoId: string | null; tipo: TipoLinea; precio: number; usada: boolean; mitades?: [string, string] | null }
const unidades = (lineas: readonly LineaPromo[]): Unidad[] =>
  lineas.flatMap(l => Array.from({ length: Math.max(0, Math.floor(l.cantidad)) }, () => ({ idx: l.idx, productoId: l.productoId, tipo: l.tipo, precio: l.precio, usada: false, mitades: l.mitades ?? null })));
const marca = (o: Oferta, precioLista: number): MarcaPromo => ({ id: o.id, nombre: o.titulo || o.nombre, tipo: o.tipo, precioLista });
const esPizza = (u: { tipo: TipoLinea }) => u.tipo === "pizza" || u.tipo === "mitad";

/** Junta unidades con la misma línea, precio y marca en tramos. Las líneas sin tocar quedan a lista. */
function tramos(lineas: readonly LineaPromo[], conPromo: { idx: number; precio: number; promo: MarcaPromo }[]): TramoPromo[] {
  const out: TramoPromo[] = [];
  for (const l of lineas) {
    const propias = conPromo.filter(u => u.idx === l.idx);
    const grupos = new Map<number, number>();
    for (const u of propias) grupos.set(u.precio, (grupos.get(u.precio) ?? 0) + 1);
    for (const [precio, cantidad] of [...grupos].sort((a, b) => b[0] - a[0])) out.push({ idx: l.idx, cantidad, precio, promo: propias.find(u => u.precio === precio)!.promo });
    const resto = Math.floor(l.cantidad) - propias.length;
    if (resto > 0) out.push({ idx: l.idx, cantidad: resto, precio: l.precio, promo: null });
  }
  return out;
}

function aplicarCombo(o: Oferta & { tipo: "combo" }, lineas: readonly LineaPromo[]): ResultadoPromo | ErrorPromo {
  const us = unidades(lineas);
  // Primero los lugares con menos opciones; en cada uno, la unidad elegible más cara (más ahorro para el cliente).
  const lugares = [...o.config.lugares].sort((a, b) => a.productos.length - b.productos.length);
  const conPromo: { idx: number; precio: number; promo: MarcaPromo }[] = [];
  let veces = 0;
  for (;;) {
    const tomadas: Unidad[] = [];
    let completo = true;
    for (const l of lugares) {
      for (let k = 0; k < l.cantidad; k++) {
        const u = us.filter(x => !x.usada && !tomadas.includes(x) && x.productoId !== null && l.productos.includes(x.productoId)).sort((a, b) => b.precio - a.precio)[0];
        if (!u) { completo = false; break; }
        tomadas.push(u);
      }
      if (!completo) break;
    }
    if (!completo) break;
    tomadas.forEach(u => { u.usada = true; });
    const lista = tomadas.reduce((s, u) => s + u.precio, 0);
    let asignado = 0;
    tomadas.forEach((u, i) => {
      const precio = i === tomadas.length - 1 ? o.config.precio - asignado : Math.round(u.precio * o.config.precio / lista);
      asignado += precio;
      conPromo.push({ idx: u.idx, precio, promo: marca(o, u.precio) });
    });
    veces++;
  }
  if (!veces) return { error: `Tu pedido no tiene todo lo que lleva el combo ${o.titulo || o.nombre}.` };
  const t = tramos(lineas, conPromo);
  const ahorro = conPromo.reduce((s, u) => s + u.promo.precioLista - u.precio, 0);
  return { oferta: { id: o.id, nombre: o.nombre, titulo: o.titulo, tipo: o.tipo }, tramos: t, regalo: null, ahorro, veces };
}

function aplicarDescuento(o: Oferta & { tipo: "descuento_cantidad" }, lineas: readonly LineaPromo[]): ResultadoPromo | ErrorPromo {
  const c = o.config;
  const elegibles = unidades(lineas).filter(u => esPizza(u) && (c.productos === null || (u.productoId !== null && c.productos.includes(u.productoId))))
    .sort((a, b) => b.precio - a.precio);
  const grupos = Math.floor(elegibles.length / c.cada);
  if (!grupos) return { error: `Para ${o.titulo || o.nombre} necesitás ${c.cada} pizzas en el pedido.` };
  const conPromo: { idx: number; precio: number; promo: MarcaPromo }[] = [];
  for (let g = 0; g < grupos; g++) {
    const u = elegibles[(g + 1) * c.cada - 1];
    conPromo.push({ idx: u.idx, precio: Math.round(u.precio * (1 - c.porcentaje / 100)), promo: marca(o, u.precio) });
  }
  const ahorro = conPromo.reduce((s, u) => s + u.promo.precioLista - u.precio, 0);
  return { oferta: { id: o.id, nombre: o.nombre, titulo: o.titulo, tipo: o.tipo }, tramos: tramos(lineas, conPromo), regalo: null, ahorro, veces: grupos };
}

/**
 * Regalo: con N pizzas, la(s) bebida(s) que el cliente YA sumó al pedido quedan a precio = suplemento (0 = gratis).
 * No se elige nada aparte: si hay varias bebidas elegibles, se regala la más cara. Sin bebida, avisa que la sume.
 */
function aplicarRegalo(o: Oferta & { tipo: "regalo" }, lineas: readonly LineaPromo[]): ResultadoPromo | ErrorPromo {
  const c = o.config;
  const us = unidades(lineas);
  const excluidas = c.excluidas ?? [];
  // Una pizza excluida (p. ej. la Muzzarella, que tiene su Dúo) no cuenta; la mitad y mitad cuenta salvo que las dos mitades lo estén.
  const cuenta = (u: Unidad) => u.tipo === "pizza" ? !(u.productoId && excluidas.includes(u.productoId))
    : u.tipo === "mitad" ? !(u.mitades && u.mitades.every(id => excluidas.includes(id))) : false;
  const pizzas = us.filter(cuenta).length;
  if (pizzas < c.minimoPizzas) {
    const faltan = c.minimoPizzas - pizzas;
    const afuera = lineas.find(l => l.tipo === "pizza" && l.productoId && excluidas.includes(l.productoId));
    return { error: afuera
      ? `La ${afuera.nombre} no entra en el regalo: sumá ${faltan} pizza${faltan > 1 ? "s" : ""} más de la carta y la bebida te la regalamos.`
      : `Sumá ${faltan} pizza${faltan > 1 ? "s" : ""} más y la bebida te la regalamos.` };
  }
  const suplemento = (id: string | null) => c.opciones.find(op => op.producto === id)?.suplemento;
  const elegibles = us.filter(u => u.tipo === "bebida" && suplemento(u.productoId) !== undefined)
    .sort((a, b) => (b.precio - Math.min(b.precio, suplemento(b.productoId)!)) - (a.precio - Math.min(a.precio, suplemento(a.productoId)!)));
  if (!elegibles.length) return { error: "Agregá una bebida a tu pedido y te la regalamos." };
  const regaladas = elegibles.slice(0, c.cantidad).map(u => ({ idx: u.idx, precio: Math.min(u.precio, suplemento(u.productoId)!), promo: marca(o, u.precio) }));
  const ahorro = regaladas.reduce((s, u) => s + u.promo.precioLista - u.precio, 0);
  return { oferta: { id: o.id, nombre: o.nombre, titulo: o.titulo, tipo: o.tipo }, tramos: tramos(lineas, regaladas), regalo: null, ahorro, veces: 1 };
}

/**
 * Aplica UNA promo (no son acumulables). `bebidas`: bebidas vendibles ahora (disponibles y con stock), para el regalo.
 */
/** `_bebidas` y `_regaloElegido` quedan por compatibilidad: el regalo ahora sale de las bebidas del pedido. */
export function aplicarPromo(oferta: Oferta, lineas: readonly LineaPromo[], _bebidas: readonly BebidaRegalo[] = [], _regaloElegido: string | null = null): ResultadoPromo | ErrorPromo {
  if (oferta.estado !== "aprobada") return { error: "Esa promo no está activa." };
  if (oferta.tipo === "combo") return aplicarCombo(oferta, lineas);
  if (oferta.tipo === "descuento_cantidad") return aplicarDescuento(oferta, lineas);
  return aplicarRegalo(oferta, lineas);
}

/** Las promos vigentes que aplican al pedido, de mayor a menor ahorro. La primera es la que se aplica sola. */
export function promosAplicables(ofertas: readonly Oferta[], lineas: readonly LineaPromo[], bebidas: readonly BebidaRegalo[], ahora: Date) {
  return ofertasVigentes(ofertas, ahora).flatMap(o => {
    const r = aplicarPromo(o, lineas, bebidas);
    return "error" in r ? [] : [{ oferta: o, resultado: r }];
  }).sort((a, b) => b.resultado.ahorro - a.resultado.ahorro);
}

export const esErrorPromo = (r: ResultadoPromo | ErrorPromo): r is ErrorPromo => "error" in r;
