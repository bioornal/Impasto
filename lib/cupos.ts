import type { CartItem, CatalogData } from "../types";

/**
 * Cupos por noche (pedido del dueño, 18/10/2026): cuántas pizzas de cada sabor se pueden vender
 * esta noche. Se cuentan en MITADES (una entera usa 2, una mitad y mitad 1 de cada sabor).
 * El control que manda es el de la base (`crear_pedido_costeado`, migración 20261018202351);
 * esto adelanta el aviso en la carta y en la cotización.
 */

export interface FilaCupo { producto_id: string; cupo_mitades: number; vendidas_mitades: number }

export const quedanMitades = (fila: FilaCupo) => Math.max(0, fila.cupo_mitades - fila.vendidas_mitades);

/** Marca en cada pizza con cupo lo que queda; en 0 queda agotada. Sin fila, sin límite. */
export function aplicarCupos(catalogo: CatalogData, filas: ReadonlyArray<FilaCupo>): CatalogData {
  if (filas.length === 0) return catalogo;
  const porId = new Map(filas.map((f) => [String(f.producto_id), quedanMitades(f)]));
  return {
    ...catalogo,
    pizzas: catalogo.pizzas.map((p) => {
      const quedan = porId.get(p.id);
      if (quedan === undefined) return p;
      return { ...p, quedanMitades: quedan, disponible: p.disponible && quedan > 0 };
    }),
  };
}

/** Mitades que pide el carrito, por id de pizza. */
export function consumoDeItems(items: ReadonlyArray<CartItem>): Map<string, number> {
  const consumo = new Map<string, number>();
  const sumar = (id: string, mitades: number) => consumo.set(id, (consumo.get(id) ?? 0) + mitades);
  for (const item of items) {
    if (item.type === "pizza") sumar(item.key, 2 * item.qty);
    else if (item.type === "pizza-half" && item.variant?.kind === "half") for (const id of item.variant.ids) sumar(id, item.qty);
  }
  return consumo;
}

/** "media", "1", "1 y media", "2"… */
export function cantidadCliente(mitades: number): string {
  const enteras = Math.floor(mitades / 2);
  if (enteras === 0) return "media";
  return mitades % 2 ? `${enteras} y media` : String(enteras);
}

export class CupoAgotadoError extends Error {
  constructor(readonly nombre: string, readonly quedan: number) {
    super(quedan <= 0
      ? `Se agotó la ${nombre} por esta noche. Sacala del carrito para seguir.`
      : quedan === 1
        ? `De la ${nombre} queda solo media: pedila en una mitad y mitad.`
        : `De la ${nombre} quedan ${cantidadCliente(quedan)} por esta noche. Bajá la cantidad para seguir.`);
    this.name = "CupoAgotadoError";
  }
}

/** Antes de guardar: si el carrito pide más de lo que queda, el cliente se entera en la cotización. */
export function validarCupos(items: ReadonlyArray<CartItem>, catalogo: CatalogData): void {
  for (const [id, pedidas] of consumoDeItems(items)) {
    const pizza = catalogo.pizzas.find((p) => p.id === id);
    if (pizza?.quedanMitades !== undefined && pedidas > pizza.quedanMitades) {
      throw new CupoAgotadoError(pizza.nombre, pizza.quedanMitades);
    }
  }
}

/** La base rechaza con 'CUPO_AGOTADO|<nombre>|<mitades que quedan>'. */
export function errorDeCupoDeLaBase(error: unknown): CupoAgotadoError | null {
  const texto = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error ?? "");
  const m = /CUPO_AGOTADO\|([^|]+)\|(\d+)/.exec(texto);
  return m ? new CupoAgotadoError(m[1], Number(m[2])) : null;
}

/**
 * Franja de la tarjeta cuando quedan 2 pizzas o menos (`components/ui/AvisoCupo.tsx`).
 * Va dentro de la tarjeta y no como cartelito sobre la foto: así no se veía (dueño, 18/10/2026).
 */
export function avisoQuedan(mitades: number | undefined, corto = false): string | null {
  if (mitades === undefined || mitades <= 0 || mitades > 4) return null;
  if (mitades === 1) return corto ? "¡Última media!" : "¡Queda la última media de la noche!";
  return `¡Queda${mitades >= 3 ? "n" : ""} solo ${cantidadCliente(mitades)}${corto ? "" : " esta noche"}!`;
}

/** El panel carga pizzas de a media: 0, 0,5, 1, 1,5… hasta 1000. Devuelve mitades o null. */
export function mitadesDesdePizzas(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : Number(String(valor ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1000) return null;
  const mitades = n * 2;
  return Number.isInteger(mitades) ? mitades : null;
}

/**
 * En el panel el cupo se maneja como "cuántas me quedan para vender esta noche" (18/10/2026):
 * cada pizza arranca la noche en 100 (sin fila = sin límite) y el dueño baja las que no tiene.
 */
export const SIN_LIMITE_PIZZAS = 100;

/** Pizzas que quedan para vender esta noche; sin cupo cargado, 100. */
export const quedanPizzas = (fila?: FilaCupo) => (fila ? quedanMitades(fila) / 2 : SIN_LIMITE_PIZZAS);

/** Flechitas: de a media pizza, entre 0 y 100. */
export const pasoCupo = (pizzas: number, sentido: 1 | -1) =>
  Math.min(SIN_LIMITE_PIZZAS, Math.max(0, Math.round((pizzas + sentido * 0.5) * 2) / 2));
