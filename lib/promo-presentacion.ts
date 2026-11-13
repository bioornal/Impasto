import type { MarcaPromo } from "./promos-aplicar";
import type { PedidoPromo } from "./promos-web";
import { fmt } from "./utils";

/** La marca se conserva al leer pedidos históricos, sin alterar su nombre ni precio. */
export function marcaPromoGuardada(value: unknown): MarcaPromo | undefined {
  if (!value || typeof value !== "object") return undefined;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== "string" || typeof p.nombre !== "string" || !tipoPromo(p.tipo)
    || typeof p.precioLista !== "number" || !Number.isFinite(p.precioLista) || p.precioLista < 0) return undefined;
  return { id: p.id, nombre: p.nombre, tipo: p.tipo, precioLista: p.precioLista };
}

const tipoPromo = (tipo: unknown): tipo is MarcaPromo["tipo"] =>
  tipo === "combo" || tipo === "descuento_cantidad" || tipo === "regalo";

export function promoGuardada(value: unknown): PedidoPromo | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== "string" || typeof p.nombre !== "string" || !tipoPromo(p.tipo)
    || typeof p.ahorro !== "number" || !Number.isFinite(p.ahorro) || p.ahorro < 0) return null;
  return { id: p.id, nombre: p.nombre, tipo: p.tipo, ahorro: p.ahorro };
}

export const sufijoRegalo = (item: { promo?: MarcaPromo }) => item.promo?.tipo === "regalo" ? " (regalo)" : "";
export const textoPromo = (promo: PedidoPromo) => `Promo: ${promo.nombre} (−${fmt(promo.ahorro)})`;
