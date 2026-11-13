import type { Bebida, CartItem, CatalogData } from '../types';

export interface FilaStockBebida { producto_id: string; unidades: number | null }
export type StockBebidas = Record<string, number | null>;

/** Mismo reconocimiento que el POS; la ausencia de fila y NULL son sin control. */
export const esBebida = (producto: { tipo?: string; categoria?: string }) =>
  producto.tipo === 'bebida' || /bebida/i.test(producto.categoria ?? '');

export const stockPorId = (filas: ReadonlyArray<FilaStockBebida>): StockBebidas =>
  Object.fromEntries(filas.map(f => [f.producto_id, f.unidades]));

export function aplicarStockBebidas(catalogo: CatalogData, filas: ReadonlyArray<FilaStockBebida>): CatalogData {
  const stockBebidas = stockPorId(filas);
  return { ...catalogo, stockBebidas, bebidas: catalogo.bebidas.map(b => ({ ...b, stockUnidades: stockBebidas[b.id] ?? null })) };
}

/** Mantiene la disponibilidad manual y permite recuperar stock después de un refresco. */
export function bebidasConStock(bebidas: Bebida[], stock?: StockBebidas): Bebida[] {
  return bebidas.map(b => {
    const stockUnidades = stock ? stock[b.id] ?? null : b.stockUnidades;
    return { ...b, stockUnidades, disponible: b.disponible !== false && stockUnidades !== 0 };
  });
}

export function bebidasConsumidas(items: ReadonlyArray<Pick<CartItem, 'key' | 'type' | 'qty'>>): Record<string, number> {
  const consumo: Record<string, number> = {};
  for (const item of items) if (item.type === 'bebida') consumo[item.key] = (consumo[item.key] ?? 0) + item.qty;
  return consumo;
}

export class StockAgotadoError extends Error {
  constructor(readonly nombre: string, readonly quedan: number) {
    super(quedan === 0 ? `Se agotó ${nombre}. Sacala del pedido para guardarlo.` : `Nos ${quedan === 1 ? 'queda' : 'quedan'} ${quedan} ${nombre}: ajustá la cantidad.`);
    this.name = 'StockAgotadoError';
  }
}

export function errorDeStockDeLaBase(error: unknown): StockAgotadoError | null {
  const texto = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error ?? '');
  const match = /STOCK_AGOTADO\|([^|]+)\|(\d+)/.exec(texto);
  return match ? new StockAgotadoError(match[1], Number(match[2])) : null;
}

export function validarStockBebidas(items: ReadonlyArray<CartItem>, catalogo: CatalogData): void {
  const consumo = bebidasConsumidas(items);
  for (const bebida of catalogo.bebidas) {
    const quedan = bebida.stockUnidades;
    if (quedan != null && (consumo[bebida.id] ?? 0) > quedan) throw new StockAgotadoError(bebida.nombre, quedan);
  }
}

export function topeDeBebidas(items: ReadonlyArray<CartItem>, item: Pick<CartItem,'key'|'type'|'name'>, cantidad: number, stock?: StockBebidas): string | null {
  if (item.type !== 'bebida') return null;
  const quedan = stock?.[item.key];
  return quedan != null && (bebidasConsumidas(items)[item.key] ?? 0) + cantidad > quedan ? new StockAgotadoError(item.name, quedan).message : null;
}

export function excesoDeBebidas(items: ReadonlyArray<CartItem>, stock?: StockBebidas): string | null {
  for (const item of items) {
    const aviso = topeDeBebidas(items, item, 0, stock);
    if (aviso) return aviso;
  }
  return null;
}

export const avisoStock = (unidades?: number | null): string | null =>
  unidades === 0 ? 'Agotado' : unidades != null && unidades <= 3 ? `¡Quedan ${unidades}!` : null;

/** NULL es explícito: un cuerpo sin unidades o un campo vacío nunca quitan el control. */
export function stockDesdeTexto(valor: unknown): number | null | undefined {
  if (valor === null) return null;
  if ((typeof valor !== 'number' && typeof valor !== 'string') || String(valor).trim() === '') return undefined;
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 && n <= 2147483647 ? n : undefined;
}
