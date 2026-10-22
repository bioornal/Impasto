import type { AdminOrder } from "../app/admin/components/types";
import { docenasDeItems, etiquetaDia, pizzasDeItems, type CartaResumen, type ResumenDia } from "./resumen-diario";
import { esPedidoValidoParaVentas } from "./pedido-visible";

const MITAD_Y_MITAD = /^Mitad .+ \/ Mitad .+/;

export function restarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Las últimas `cantidad` noches con ventas, para el gráfico: sin barras en cero de lunes a jueves. */
export function nochesParaGrafico(dias: ReadonlyArray<ResumenDia>, cantidad: number) {
  return dias.slice(0, cantidad).reverse().map((d) => ({ dia: d.dia, etiqueta: etiquetaDia(d.dia), total: d.total }));
}

/** Esta noche (06:00 a 05:59) contra la misma noche de la semana anterior. */
export function comparacionNoche(dias: ReadonlyArray<ResumenDia>, hoy: string) {
  const actual = dias.find((d) => d.dia === hoy);
  const previa = dias.find((d) => d.dia === restarDias(hoy, 7));
  const total = actual?.total ?? 0;
  const anterior = previa ? previa.total : null;
  return {
    actual: total,
    pedidos: actual?.pedidos ?? 0,
    web: actual ? actual.pedidos - actual.pedidosPos : 0,
    pos: actual?.pedidosPos ?? 0,
    anterior,
    pct: anterior ? Math.round(((total - anterior) / anterior) * 100) : null,
  };
}

/** Top de pizzas (por nombre; las mitad y mitad juntas) y empanadas (en docenas). Sin bebidas. */
export function masVendidas(orders: ReadonlyArray<AdminOrder>, carta: CartaResumen, n = 5) {
  const cuenta = new Map<string, number>();
  const sumar = (nombre: string, cantidad: number) => { if (cantidad > 0) cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + cantidad); };
  for (const o of orders) {
    if (!esPedidoValidoParaVentas(o)) continue;
    for (const item of o.items) {
      const pizzas = pizzasDeItems([item], carta.pizzas);
      if (pizzas > 0) { sumar(MITAD_Y_MITAD.test(item.name) ? "Mitad y mitad" : item.name, pizzas); continue; }
      sumar("Empanadas (docenas)", docenasDeItems([item], carta.empanadas));
    }
  }
  return [...cuenta.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre))
    .slice(0, n);
}
