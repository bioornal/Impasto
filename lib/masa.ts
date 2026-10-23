import type { CartItem, Masa } from "@/types";

/**
 * Masa de la pizza: napoletana (la de la casa) o al molde (desde el 17/10/2026).
 * Mismo precio. Se elige por pizza en el carrito; la napoletana es la de siempre.
 */
export const MASAS: ReadonlyArray<{ id: Masa; nombre: string }> = [
  { id: "napoletana", nombre: "Napoletana" },
  { id: "molde", nombre: "Al molde" },
];

export const DETALLE_MOLDE = "Masa al molde";

/** Lo que no sea exactamente "molde" es napoletana: el carrito viene del navegador. */
export const normalizarMasa = (valor: unknown): Masa => (valor === "molde" ? "molde" : "napoletana");

const llevaMasa = (type: unknown) => type === "pizza" || type === "pizza-half";
/**
 * Para pedidos ya guardados: los del POS (Carro Fogón) no guardan `type`, y solo sus pizzas
 * llevan `masa`. Sin `type` se confía en la masa; con `type`, tiene que ser una pizza.
 */
const puedeTenerMasa = (type: unknown) => !type || llevaMasa(type);

/** La masa de una línea de pizza; `undefined` si no es pizza. */
export const masaDe = (item: { type?: unknown; masa?: unknown }): Masa | undefined =>
  llevaMasa(item.type) ? normalizarMasa(item.masa) : undefined;

/** Misma pizza y misma masa: el carrito las junta en una línea. */
export const esMismaLinea = (a: Pick<CartItem, "key" | "type" | "masa">, b: Pick<CartItem, "key" | "type" | "masa">) =>
  a.key === b.key && a.type === b.type && masaDe(a) === masaDe(b);

/** Cambia la masa de la línea entera; si ya hay otra igual con esa masa, se juntan. */
export function cambiarMasa(items: CartItem[], cartId: string, masa: Masa): CartItem[] {
  const linea = items.find((i) => i.cartId === cartId);
  if (!linea || !llevaMasa(linea.type)) return items;
  const cambiada = { ...linea, masa };
  const destino = items.find((i) => i.cartId !== cartId && esMismaLinea(i, cambiada));
  if (!destino) return items.map((i) => (i.cartId === cartId ? cambiada : i));
  return items
    .filter((i) => i.cartId !== cartId)
    .map((i) => (i.cartId === destino.cartId ? { ...i, qty: i.qty + linea.qty } : i));
}

/**
 * El detalle sin la masa, para el carrito: ahí la masa ya se ve en el selector, y el detalle
 * que vino del servidor puede haber quedado viejo después de cambiarla.
 */
export const detalleSinMasa = (detail: string | undefined) =>
  (detail || "").replace(` · ${DETALLE_MOLDE}`, "").replace(DETALLE_MOLDE, "");

/**
 * Qué masas hay hoy (desde el 22/10/2026). El dueño las prende y apaga desde el Arranque.
 * - Sin napoletana (la de la casa): todas salen al molde y la web lo avisa.
 * - Sin molde (23/10/2026, pedido del dueño): la web no la muestra en ningún lado, ni avisa que
 *   falta; para el cliente la opción no existe. Todas salen napoletanas.
 */
export interface EstadoMasas {
  napoletana: boolean;
  molde: boolean;
  /** Frase para el cliente; vacía mientras están las dos y cuando el molde está oculto. */
  aviso: string;
}

export const TODAS_LAS_MASAS: EstadoMasas = { napoletana: true, molde: true, aviso: "" };

export const nombreMasa = (masa: Masa) => (masa === "molde" ? "al molde" : "napoletana");

/**
 * Sin las columnas (antes de la migración) cuentan como disponibles. Las dos apagadas no
 * debería pasar (el panel y la API no lo dejan): ante la duda, se ofrecen las dos.
 */
export function estadoMasas(config: { masaNapoletanaActiva?: boolean; masaMoldeActiva?: boolean }): EstadoMasas {
  const napoletana = config.masaNapoletanaActiva !== false;
  const molde = config.masaMoldeActiva !== false;
  if (napoletana === molde) return TODAS_LAS_MASAS;
  return napoletana
    ? { napoletana, molde, aviso: "" }
    : { napoletana, molde, aviso: "Hoy se nos terminó la masa napoletana: todas las pizzas salen al molde." };
}

/**
 * Si el cliente ve algo de las masas (bloque del home, selector del carrito, texto del asistente).
 * Con el molde apagado, no: la opción desaparece de la web.
 */
export const masasVisibles = (estado: Pick<EstadoMasas, "molde">) => estado.molde;

/** La masa que queda cuando falta una; `undefined` si están las dos. */
export const masaUnica = (estado: EstadoMasas): Masa | undefined =>
  estado.napoletana && estado.molde ? undefined : estado.napoletana ? "napoletana" : "molde";

/**
 * Pasa a la masa que queda las pizzas que tienen la que se terminó (también las que todavía
 * no eligieron: valen napoletana). Devuelve el mismo arreglo si no cambió nada.
 */
export function ajustarMasas(items: CartItem[], estado: EstadoMasas): CartItem[] {
  const queda = masaUnica(estado);
  if (!queda) return items;
  let resultado = items;
  for (const item of items) {
    const masa = masaDe(item);
    if (!masa || masa === queda) continue;
    resultado = cambiarMasa(resultado, item.cartId, queda);
  }
  return resultado;
}

/** Rechaza un pedido con una masa que se terminó. Corre en la cotización y en `createPedido`. */
export function validarMasas(estado: EstadoMasas, items: ReadonlyArray<{ type?: unknown; masa?: unknown }>): void {
  const queda = masaUnica(estado);
  if (!queda) return;
  const otra: Masa = queda === "napoletana" ? "molde" : "napoletana";
  if (!items.some((item) => masaDe(item) === otra)) return;
  throw new Error(`Hoy se nos terminó la masa ${nombreMasa(otra)}. Abrí el carrito: tus pizzas pasan a ${nombreMasa(queda)}.`);
}

/** La masa como la lee la cocina; vacío si la línea no es pizza o es de antes de poder elegir. */
export function masaCocina(item: { type?: unknown; masa?: unknown }): string {
  if (!puedeTenerMasa(item.type)) return "";
  return item.masa === "molde" ? "AL MOLDE" : item.masa === "napoletana" ? "NAPOLETANA" : "";
}

/**
 * Nombre para la comanda, el panel y el aviso del local: la masa va en la misma línea, porque
 * la impresora imprime el nombre en negrita y el detalle abajo en letra normal. Se nombran las
 * dos masas (pedido del dueño, 17/10/2026): que nunca haya que suponer cuál es.
 */
export const nombreCocina = (item: { name: string; type?: unknown; masa?: unknown }) => {
  const masa = masaCocina(item);
  return masa ? `${item.name} [${masa}]` : item.name;
};

/** El detalle para la cocina, sin la masa: ya va en el nombre. */
export const detalleCocina = (item: { detail?: string }) => detalleSinMasa(item.detail);

/**
 * Unidades de pizza por masa. Solo cuentan las líneas que traen `masa`:
 * los pedidos de antes del 17/10/2026 no podían elegir y falsearían la preferencia.
 */
export function contarMasas(pedidos: ReadonlyArray<{ items: ReadonlyArray<{ type?: string; qty: number; masa?: unknown }> }>) {
  const conteo: Record<Masa, number> = { napoletana: 0, molde: 0 };
  for (const pedido of pedidos) {
    for (const item of pedido.items) {
      if (!puedeTenerMasa(item.type) || (item.masa !== "napoletana" && item.masa !== "molde")) continue;
      conteo[item.masa] += item.qty;
    }
  }
  return conteo;
}
