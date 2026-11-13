/** Adaptación de las líneas de la web al motor compartido. Sin acceso al backend. */
import type { CartItem, CatalogData } from "../types";
import type { Oferta } from "./promos";
import { aplicarPromo, ofertasVigentes, type LineaPromo } from "./promos-aplicar";

export interface PedidoPromoSeleccion { ofertaId: string; regaloProductoId?: string }
export interface PedidoPromo { id: string; nombre: string; tipo: Oferta["tipo"]; ahorro: number }

export class PromoNoAplicableError extends Error {
  readonly status = 409;
  constructor(motivo: string) { super(motivo); this.name = "PromoNoAplicableError"; }
}

export function lineasPromo(items: readonly CartItem[]): LineaPromo[] {
  return items.map((item, idx) => ({
    idx, productoId: item.type === "pizza-half" || item.type === "empanadas" ? null : item.key,
    mitades: item.type === "pizza-half" && item.variant?.kind === "half" ? item.variant.ids : null,
    nombre: item.name, tipo: item.type === "pizza-half" ? "mitad" : item.type === "empanadas" ? "otro" : item.type,
    precio: item.price, cantidad: item.qty,
  }));
}

/** Disponibilidad manual, precio vendible y stock suficiente para el regalo completo más el carrito. */
export function bebidasParaRegalo(data: CatalogData, items: readonly CartItem[] = [], cantidad = 1) {
  return data.bebidas.filter(b => {
    const stock = data.stockBebidas?.[b.id] ?? b.stockUnidades;
    const compradas = items.filter(i => i.type === "bebida" && i.key === b.id).reduce((s, i) => s + i.qty, 0);
    return b.disponible && Number.isFinite(b.precio) && b.precio > 0 && !data.preciosNoDisponibles?.includes(b.id)
      && (stock == null || stock >= cantidad + compradas);
  }).map(b => ({ id: b.id, nombre: b.nombre, precio: b.precio }));
}

/** Recibe exclusivamente líneas ya cotizadas a lista. Nunca confía en marcas del cliente. */
export function cotizarPromo(items: CartItem[], data: CatalogData, seleccion: PedidoPromoSeleccion | null | undefined, ahora = new Date()): { items: CartItem[]; promo: PedidoPromo | null } {
  const lista = items.map(item => { const limpio = { ...item }; delete limpio.promo; return limpio; });
  if (seleccion == null) return { items: lista, promo: null };
  if (typeof seleccion !== "object" || typeof seleccion.ofertaId !== "string" || !seleccion.ofertaId) throw new PromoNoAplicableError("Elegí una promo válida.");
  const oferta = ofertasVigentes(data.ofertas ?? [], ahora).find(o => o.id === seleccion.ofertaId);
  if (!oferta) throw new PromoNoAplicableError("Esa promo ya no está vigente. Elegí otra o seguí sin promo.");
  const resultado = aplicarPromo(oferta, lineasPromo(lista), bebidasParaRegalo(data, lista, oferta.tipo === "regalo" ? oferta.config.cantidad : 1), seleccion.regaloProductoId ?? null);
  if ("error" in resultado) throw new PromoNoAplicableError(resultado.error);
  const tramos: CartItem[] = resultado.tramos.map((t, idx) => ({
    ...lista[t.idx], cartId: `${lista[t.idx].cartId}-tramo-${idx}`, qty: t.cantidad, price: t.precio,
    ...(t.promo ? { promo: t.promo } : {}),
  }));
  if (resultado.regalo) {
    const r = resultado.regalo;
    tramos.push({ key: r.bebida.id, cartId: `regalo-${oferta.id}-${r.bebida.id}`, type: "bebida", name: r.bebida.nombre, qty: r.cantidad, price: r.precio, promo: r.promo });
  }
  return { items: tramos, promo: { id: oferta.id, nombre: oferta.titulo || oferta.nombre, tipo: oferta.tipo, ahorro: resultado.ahorro } };
}

/** Lo que manda el navegador: solo el id de la promo y la bebida elegida. Nada de precios. */
export function normalizarSeleccionPromo(value: unknown): PedidoPromoSeleccion | null {
  if (value === null || value === undefined) return null;
  const v = value as Record<string, unknown>;
  const id = typeof v === "object" && typeof v.ofertaId === "string" ? v.ofertaId.trim() : "";
  if (!id || id.length > 64) throw new PromoNoAplicableError("Elegí una promo válida.");
  const regalo = typeof v.regaloProductoId === "string" && v.regaloProductoId.trim() && v.regaloProductoId.length <= 64 ? v.regaloProductoId.trim() : undefined;
  return regalo ? { ofertaId: id, regaloProductoId: regalo } : { ofertaId: id };
}
