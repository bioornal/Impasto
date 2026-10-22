import { diaDeNegocio } from "./resumen-diario";

export type SeccionAdmin =
  | "arranque" | "pedidos" | "resumen"
  | "productos" | "etiquetas"
  | "dashboard" | "clientes" | "testimonios"
  | "configuracion";

export const SECCIONES_ADMIN: readonly SeccionAdmin[] = [
  "arranque", "pedidos", "resumen", "productos", "etiquetas", "dashboard", "clientes", "testimonios", "configuracion",
];

export const esSeccionAdmin = (valor: unknown): valor is SeccionAdmin =>
  typeof valor === "string" && (SECCIONES_ADMIN as readonly string[]).includes(valor);

/**
 * Dónde abre el panel: la última sección de esta sesión; si no hay, el Arranque en una noche de
 * apertura (la noche va de 06:00 a 05:59, como el Resumen diario) y el Dashboard el resto.
 */
export function seccionInicial(diasApertura: string | null | undefined, ahora: Date, guardada: string | null): SeccionAdmin {
  if (esSeccionAdmin(guardada)) return guardada;
  if (Number.isNaN(ahora.getTime())) return "dashboard";
  // Solo cuentan los tokens que son exactamente un día 0-6: "" o " " no son el domingo.
  const dias = String(diasApertura || "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => /^[0-6]$/.test(d))
    .map(Number);
  const noche = diaDeNegocio(ahora.toISOString());
  const diaSemana = new Date(`${noche}T12:00:00Z`).getUTCDay();
  return dias.includes(diaSemana) ? "arranque" : "dashboard";
}
