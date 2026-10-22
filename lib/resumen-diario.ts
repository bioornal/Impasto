import type { AdminOrder, OrderItem } from "../app/admin/components/types";
import { esPedidoValidoParaVentas } from "./pedido-visible";

/**
 * Resumen diario del panel (pedido del dueño, 17/10/2026): por noche de trabajo,
 * unidades, pedidos y plata, separados por medio de pago. Web y POS juntos.
 * Unidad = una pizza (entera o mitad y mitad) o una docena de empanadas (pedido del dueño).
 */

export type Medio = "efectivo" | "transferencia" | "mercadopago" | "otro";
export const MEDIOS: ReadonlyArray<{ id: Medio; nombre: string }> = [
  { id: "efectivo", nombre: "Efectivo" },
  { id: "transferencia", nombre: "Transferencia" },
  { id: "mercadopago", nombre: "Mercado Pago" },
  { id: "otro", nombre: "Sin medio" },
];

export interface FilaMedio { pedidos: number; pizzas: number; docenas: number; total: number }

/** Los nombres de la carta por tipo: el POS no guarda `type` y se reconoce por nombre. */
export interface CartaResumen { pizzas: ReadonlySet<string>; empanadas: ReadonlySet<string> }

export interface ResumenDia {
  /** Fecha de la noche, AAAA-MM-DD. */
  dia: string;
  pedidos: number;
  /** Pedidos del POS esa noche (el resto son de la web). */
  pedidosPos: number;
  pizzas: number;
  docenas: number;
  /** Pizzas + docenas de empanadas. */
  unidades: number;
  pizzasWeb: number;
  pizzasPos: number;
  total: number;
  medios: Record<Medio, FilaMedio>;
}

/** Argentina no tiene horario de verano: UTC-3 fijo. */
const OFFSET_ARGENTINA_MS = -3 * 3_600_000;
/** Como el POS (`CORTE_DIA_NEGOCIO_HORAS`): un pedido de las 00:30 es de la noche anterior. */
const CORTE_MS = 6 * 3_600_000;

export function diaDeNegocio(iso: string): string {
  const t = Date.parse(iso);
  return new Date(t + OFFSET_ARGENTINA_MS - CORTE_MS).toISOString().slice(0, 10);
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export function etiquetaDia(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

const MITAD_Y_MITAD = /^Mitad .+ \/ Mitad .+/;

/**
 * Pizzas de un pedido: una entera o una mitad y mitad cuenta 1. La web guarda `type`;
 * el POS no, así que ahí se reconoce por el nombre de la carta o por "Mitad … / Mitad …".
 */
export function pizzasDeItems(items: ReadonlyArray<OrderItem>, nombresDePizzas: ReadonlySet<string>): number {
  let total = 0;
  for (const item of items) {
    const esPizza = item.type
      ? item.type === "pizza" || item.type === "pizza-half"
      : nombresDePizzas.has(item.name) || MITAD_Y_MITAD.test(item.name);
    if (esPizza) total += item.qty;
  }
  return total;
}

const CAJA = /^Caja x([0-9]+)$/;

/**
 * Docenas de empanadas: la web vende cajas ("Caja x6/x12/x24", la de 6 es media docena);
 * el POS, empanadas sueltas con el nombre de la carta.
 */
export function docenasDeItems(items: ReadonlyArray<OrderItem>, nombresDeEmpanadas: ReadonlySet<string>): number {
  let empanadas = 0;
  for (const item of items) {
    const caja = item.type === "empanadas" ? CAJA.exec(item.name) : null;
    if (caja) empanadas += Number(caja[1]) * item.qty;
    else if (!item.type && nombresDeEmpanadas.has(item.name)) empanadas += item.qty;
  }
  return empanadas / 12;
}

/** "3", o "2,5" con media docena. */
export const formatoUnidades = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 1 });

const medioDe = (pago: string): Medio =>
  pago === "efectivo" || pago === "transferencia" || pago === "mercadopago" ? pago : "otro";

const vacio = (): FilaMedio => ({ pedidos: 0, pizzas: 0, docenas: 0, total: 0 });

/** Una fila por noche con ventas, la más nueva primero. Misma regla de venta que el Dashboard. */
export function resumenPorDia(orders: ReadonlyArray<AdminOrder>, carta: CartaResumen): ResumenDia[] {
  const porDia = new Map<string, ResumenDia>();
  for (const o of orders) {
    if (!esPedidoValidoParaVentas(o) || !Number.isFinite(Date.parse(o.fecha))) continue;
    const dia = diaDeNegocio(o.fecha);
    let r = porDia.get(dia);
    if (!r) {
      r = { dia, pedidos: 0, pedidosPos: 0, pizzas: 0, docenas: 0, unidades: 0, pizzasWeb: 0, pizzasPos: 0, total: 0,
        medios: { efectivo: vacio(), transferencia: vacio(), mercadopago: vacio(), otro: vacio() } };
      porDia.set(dia, r);
    }
    const pizzas = pizzasDeItems(o.items, carta.pizzas);
    const docenas = docenasDeItems(o.items, carta.empanadas);
    const fila = r.medios[medioDe(o.pago)];
    r.pedidos++; if (o.canal === "pos") r.pedidosPos++; r.pizzas += pizzas; r.docenas += docenas; r.unidades += pizzas + docenas; r.total += o.total;
    if (o.canal === "pos") r.pizzasPos += pizzas; else r.pizzasWeb += pizzas;
    fila.pedidos++; fila.pizzas += pizzas; fila.docenas += docenas; fila.total += o.total;
  }
  return [...porDia.values()].sort((a, b) => b.dia.localeCompare(a.dia));
}
