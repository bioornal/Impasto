import type { CartItem, CatalogData, Masa } from "../types";
import { masaDe, nombreMasa } from "./masa";

/**
 * Masas de la noche (pedido del dueño, 24/10/2026; por tipo desde el 31/10/2026): cuántas pizzas de
 * cada masa se pueden vender esta noche. Una masa por pizza, entera o mitad y mitad, de la que eligió
 * el cliente. Va además de los cupos por sabor (`lib/cupos.ts`). El control que manda es el de la base
 * (`crear_pedido_costeado`, migración 20261031122631); esto adelanta el aviso en la carta y la cotización.
 */

/** Fila de `masas_noche`, una por masa: `cupo` null = sin cargar. */
export interface FilaMasas { masa: Masa; cupo: number | null; vendidas: number }

/** Masas que quedan para vender esta noche. Sin ningún número cargado no hay límite: se usa `null`. */
export type QuedanMasas = Record<Masa, number>;

const LAS_MASAS: ReadonlyArray<Masa> = ["napoletana", "molde"];
const POCAS = 3;

const otraMasa = (masa: Masa): Masa => (masa === "molde" ? "napoletana" : "molde");
const sinPizzas = (quedan: QuedanMasas) => quedan.napoletana + quedan.molde <= 0;

export const esMasa = (valor: unknown): valor is Masa => valor === "napoletana" || valor === "molde";

/** Con algún número cargado, la masa sin cargar vale 0: si el dueño cargó una sola, la otra no se vende. */
export function quedanMasas(filas?: ReadonlyArray<FilaMasas> | null): QuedanMasas | null {
  const cargadas = (filas ?? []).filter((fila) => fila.cupo !== null && fila.cupo !== undefined);
  if (cargadas.length === 0) return null;
  const quedan = (masa: Masa) => {
    const fila = cargadas.find((f) => f.masa === masa);
    return fila ? Math.max(0, (fila.cupo as number) - fila.vendidas) : 0;
  };
  return { napoletana: quedan("napoletana"), molde: quedan("molde") };
}

/** Con números cargados, manda el número y no el interruptor; sin números, mandan los interruptores. */
export const conMasasDeLaNoche = <T extends object>(config: T, quedan: QuedanMasas | null | undefined): T =>
  quedan ? { ...config, masaNapoletanaActiva: quedan.napoletana > 0, masaMoldeActiva: quedan.molde > 0 } : config;

/** Marca en la carta las masas que quedan; con las dos en 0, todas las pizzas salen agotadas. */
export function aplicarMasas(catalogo: CatalogData, quedan: QuedanMasas | null): CatalogData {
  if (quedan === null) return catalogo;
  return {
    ...catalogo,
    masasQuedan: quedan,
    pizzas: sinPizzas(quedan) ? catalogo.pizzas.map((p) => ({ ...p, disponible: false })) : catalogo.pizzas,
  };
}

/** Masas que usa el carrito: una por pizza entera o mitad y mitad, de la masa de cada línea. */
export function pizzasPorMasa(items: ReadonlyArray<Pick<CartItem, "type" | "qty" | "masa">>): QuedanMasas {
  const conteo: QuedanMasas = { napoletana: 0, molde: 0 };
  for (const item of items) {
    const masa = masaDe(item);
    if (masa) conteo[masa] += item.qty;
  }
  return conteo;
}

/** La masa en la que entran `cantidad` pizzas más: la que corresponde o, si está llena, la otra. */
export function masaParaSumar(items: ReadonlyArray<CartItem>, preferida: Masa, cantidad: number, quedan: QuedanMasas | null | undefined): Masa | null {
  if (!quedan) return preferida;
  const enCarrito = pizzasPorMasa(items);
  return [preferida, otraMasa(preferida)].find((masa) => enCarrito[masa] + cantidad <= quedan[masa]) ?? null;
}

/** La pizza entró en la otra masa porque la que le tocaba está llena. */
export const avisoOtraMasa = (masa: Masa) =>
  masa === "molde" ? "Esta pizza va al molde: no quedan más napoletanas." : "Esta pizza va con masa napoletana: no quedan más al molde.";

const pizzasDe = (cantidad: number, masa: Masa) =>
  masa === "molde" ? `${cantidad === 1 ? "pizza" : "pizzas"} al molde` : cantidad === 1 ? "pizza napoletana" : "pizzas napoletanas";

const nosQuedan = (quedan: number, masa: Masa) =>
  quedan === 1 ? `Esta noche nos queda solo 1 ${pizzasDe(1, masa)}` : `Esta noche nos quedan solo ${quedan} ${pizzasDe(quedan, masa)}`;

const terminada = (masa: Masa) => `Por esta noche se terminó la masa ${nombreMasa(masa)}`;

export class MasasAgotadasError extends Error {
  constructor(readonly quedan: number, readonly masa: Masa, ninguna = false) {
    super(ninguna
      ? "Por esta noche se terminaron las pizzas. Sacalas del carrito para seguir."
      : quedan <= 0
        ? `${terminada(masa)}. Cambiala en el carrito o sacá esas pizzas para seguir.`
        : `${nosQuedan(quedan, masa)}. Bajá la cantidad o cambiá la masa para seguir.`);
    this.name = "MasasAgotadasError";
  }
}

/** Antes de guardar: si el carrito pide más pizzas de una masa que las que quedan, el cliente se entera en la cotización. */
export function validarMasasNoche(items: ReadonlyArray<CartItem>, catalogo: CatalogData): void {
  const quedan = catalogo.masasQuedan;
  if (!quedan) return;
  const pedidas = pizzasPorMasa(items);
  for (const masa of LAS_MASAS) {
    if (pedidas[masa] > quedan[masa]) throw new MasasAgotadasError(quedan[masa], masa, sinPizzas(quedan));
  }
}

/** La base rechaza con 'MASAS_AGOTADAS|<masas que quedan>|<masa>'. */
export function errorDeMasasDeLaBase(error: unknown): MasasAgotadasError | null {
  const texto = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error ?? "");
  const m = /MASAS_AGOTADAS\|(\d+)\|(napoletana|molde)/.exec(texto);
  return m ? new MasasAgotadasError(Number(m[1]), m[2] as Masa) : null;
}

/** Aviso arriba de las pizzas: con 3 o menos de una masa, o cuando se terminaron. La masa en 0 no se nombra. */
export function avisoMasas(quedan: QuedanMasas | null | undefined, hayEmpanadas = false): string | null {
  if (!quedan) return null;
  if (sinPizzas(quedan)) return `Por esta noche se terminaron las pizzas.${hayEmpanadas ? " Todavía podés pedir empanadas." : ""}`;
  const pocas = LAS_MASAS.filter((masa) => quedan[masa] > 0 && quedan[masa] <= POCAS);
  if (pocas.length === 2) return `¡Quedan solo ${quedan.napoletana} ${quedan.napoletana === 1 ? "napoletana" : "napoletanas"} y ${quedan.molde} al molde esta noche!`;
  if (pocas.length === 0) return null;
  const masa = pocas[0];
  return quedan[masa] === 1 ? `¡Queda la última ${pizzasDe(1, masa)} de la noche!` : `¡Quedan solo ${quedan[masa]} ${pizzasDe(quedan[masa], masa)} esta noche!`;
}

/**
 * Carrito (25/10/2026, el dueño vio que se podían sumar más pizzas que las masas): null si se pueden
 * sumar `cantidad` pizzas de esa masa; si no, el aviso para el cliente.
 */
export function topeDePizzas(items: ReadonlyArray<CartItem>, masa: Masa, cantidad: number, quedan: QuedanMasas | null | undefined): string | null {
  if (!quedan || pizzasPorMasa(items)[masa] + cantidad <= quedan[masa]) return null;
  if (sinPizzas(quedan)) return "Por esta noche se terminaron las pizzas.";
  return quedan[masa] <= 0 ? `${terminada(masa)}.` : `${nosQuedan(quedan[masa], masa)}: no se pueden sumar más.`;
}

/** El carrito ya tiene más pizzas de una masa que las que quedan (bajaron mientras armaba el pedido). */
export function excesoEnCarrito(items: ReadonlyArray<CartItem>, quedan: QuedanMasas | null | undefined): string | null {
  if (!quedan) return null;
  const enCarrito = pizzasPorMasa(items);
  const masa = LAS_MASAS.find((m) => enCarrito[m] > quedan[m]);
  if (!masa) return null;
  if (sinPizzas(quedan)) return "Por esta noche se terminaron las pizzas. Sacalas del pedido para seguir.";
  const sobran = enCarrito[masa] - quedan[masa];
  const otra = otraMasa(masa);
  const inicio = quedan[masa] <= 0 ? terminada(masa) : nosQuedan(quedan[masa], masa);
  if (quedan[otra] - enCarrito[otra] < sobran) return `${inicio}. Sacá ${sobran} del pedido para seguir.`;
  return `${inicio}. Pasá ${sobran} a ${nombreMasa(otra)} o ${sobran === 1 ? "sacala" : "sacalas"} del pedido para seguir.`;
}

/** Lo que carga el panel: entero de 0 a 2000; vacío = sin límite (null); inválido = undefined. */
export function masasDesdeTexto(valor: unknown): number | null | undefined {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).trim());
  return Number.isInteger(n) && n >= 0 && n <= 2000 ? n : undefined;
}
