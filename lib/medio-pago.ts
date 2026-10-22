import type { AdminOrder } from "../app/admin/components/types";
import { diaDeNegocio } from "./resumen-diario";

/**
 * Corregir el medio de pago desde el Resumen diario (pedido del dueño, 18/10/2026): el POS a veces
 * lo carga mal y la rendición del efectivo del delivery no cierra. Lo hace la base
 * (`corregir_medio_pago`, migración 20261019021530), que además pasa el cobro ya registrado al
 * medio nuevo. Los pagos con tarjeta de la web no se tocan.
 */
export const MEDIOS_PAGO = [
  { id: "efectivo", nombre: "Efectivo" },
  { id: "transferencia", nombre: "Transferencia" },
  { id: "mercadopago", nombre: "Mercado Pago" },
] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number]["id"];
export const esMedioPago = (v: unknown): v is MedioPago => MEDIOS_PAGO.some((m) => m.id === v);
export const nombreMedio = (v: string) => MEDIOS_PAGO.find((m) => m.id === v)?.nombre ?? "Sin medio";

/** Pedidos de una noche (06:00 a 05:59), sin cancelados, en orden de llegada. */
export function pedidosDeLaNoche(orders: ReadonlyArray<AdminOrder>, dia: string): AdminOrder[] {
  return orders
    .filter((o) => o.estado !== "cancelado" && Number.isFinite(Date.parse(o.fecha)) && diaDeNegocio(o.fecha) === dia)
    .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha));
}

/** Errores de `corregir_medio_pago` para el panel. */
export function errorDeMedio(error: unknown): { status: number; error: string } {
  const texto = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error ?? "");
  if (texto.includes("MEDIO_NO_EDITABLE")) return { status: 409, error: "Los pagos con tarjeta de la web los confirma Mercado Pago: ese medio no se puede cambiar." };
  if (texto.includes("PEDIDO_NO_ENCONTRADO")) return { status: 404, error: "Pedido no encontrado" };
  if (texto.includes("MEDIO_INVALIDO")) return { status: 400, error: "Medio de pago inválido" };
  return { status: 500, error: "No se pudo cambiar el medio de pago" };
}
