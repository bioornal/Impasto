import type { CartItem, CatalogData } from "../types";

/**
 * Masas de la noche (pedido del dueño, 24/10/2026): cuántas pizzas en total se pueden vender esta
 * noche según las masas que hay. Una masa por pizza, entera o mitad y mitad. Va además de los cupos
 * por sabor (`lib/cupos.ts`). El control que manda es el de la base (`crear_pedido_costeado`,
 * migración 20261025000845); esto adelanta el aviso en la carta y en la cotización.
 */

/** Fila de `masas_noche`: `cupo` null = sin límite (el dueño no cargó nada). */
export interface FilaMasas { cupo: number | null; vendidas: number }

/** Masas que quedan para vender esta noche; null = sin límite. */
export const quedanMasas = (fila?: FilaMasas | null): number | null =>
  fila && fila.cupo !== null && fila.cupo !== undefined ? Math.max(0, fila.cupo - fila.vendidas) : null;

/** Marca en la carta las masas que quedan; en 0 todas las pizzas salen agotadas. */
export function aplicarMasas(catalogo: CatalogData, quedan: number | null): CatalogData {
  if (quedan === null) return catalogo;
  return {
    ...catalogo,
    masasQuedan: quedan,
    pizzas: quedan > 0 ? catalogo.pizzas : catalogo.pizzas.map((p) => ({ ...p, disponible: false })),
  };
}

/** Masas que usa el carrito: una por pizza entera o mitad y mitad. */
export const pizzasDelCarrito = (items: ReadonlyArray<CartItem>) =>
  items.reduce((n, item) => (item.type === "pizza" || item.type === "pizza-half" ? n + item.qty : n), 0);

export class MasasAgotadasError extends Error {
  constructor(readonly quedan: number) {
    super(quedan <= 0
      ? "Por esta noche se terminaron las pizzas. Sacalas del carrito para seguir."
      : quedan === 1
        ? "Esta noche nos queda solo 1 pizza. Bajá la cantidad para seguir."
        : `Esta noche nos quedan solo ${quedan} pizzas. Bajá la cantidad para seguir.`);
    this.name = "MasasAgotadasError";
  }
}

/** Antes de guardar: si el carrito pide más pizzas que las masas que quedan, el cliente se entera en la cotización. */
export function validarMasasNoche(items: ReadonlyArray<CartItem>, catalogo: CatalogData): void {
  if (catalogo.masasQuedan === undefined) return;
  const pedidas = pizzasDelCarrito(items);
  if (pedidas > catalogo.masasQuedan) throw new MasasAgotadasError(catalogo.masasQuedan);
}

/** La base rechaza con 'MASAS_AGOTADAS|<masas que quedan>'. */
export function errorDeMasasDeLaBase(error: unknown): MasasAgotadasError | null {
  const texto = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error ?? "");
  const m = /MASAS_AGOTADAS\|(\d+)/.exec(texto);
  return m ? new MasasAgotadasError(Number(m[1])) : null;
}

/** Aviso arriba de las pizzas: con 3 o menos, o cuando se terminaron. Sin límite o con más, nada. */
export function avisoMasas(quedan: number | undefined, hayEmpanadas = false): string | null {
  if (quedan === undefined || quedan > 3) return null;
  if (quedan <= 0) return `Por esta noche se terminaron las pizzas.${hayEmpanadas ? " Todavía podés pedir empanadas." : ""}`;
  return quedan === 1 ? "¡Queda la última pizza de la noche!" : `¡Quedan solo ${quedan} pizzas esta noche!`;
}

/** Lo que carga el panel: entero de 0 a 2000; vacío = sin límite (null); inválido = undefined. */
export function masasDesdeTexto(valor: unknown): number | null | undefined {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).trim());
  return Number.isInteger(n) && n >= 0 && n <= 2000 ? n : undefined;
}
