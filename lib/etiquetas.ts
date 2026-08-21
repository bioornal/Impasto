/**
 * Las etiquetas viven en la tabla `etiquetas` y se administran desde el panel.
 * Este módulo solo define su forma y la paleta: no toca la base, para que
 * lib/catalog-build.ts lo pueda importar sin arrastrar el SDK.
 */
export const COLORES_ETIQUETA = ["dorado", "rojo", "verde", "oliva", "gris", "negro"] as const;

export type ColorEtiqueta = (typeof COLORES_ETIQUETA)[number];

/** Dónde se muestra el cartelito. `ninguno` = la etiqueta sirve para filtrar, pero no se ve. */
export const MOSTRAR_BADGE = ["ambos", "pizzas", "empanadas", "ninguno"] as const;

export type MostrarBadge = (typeof MOSTRAR_BADGE)[number];

export interface Etiqueta {
  id?: string;
  slug: string;
  label: string;
  color: ColorEtiqueta;
  orden: number;
  mostrar_badge: MostrarBadge;
  sistema?: boolean;
}

export const esColorValido = (valor: unknown): valor is ColorEtiqueta =>
  typeof valor === "string" && (COLORES_ETIQUETA as readonly string[]).includes(valor);

export const esMostrarValido = (valor: unknown): valor is MostrarBadge =>
  typeof valor === "string" && (MOSTRAR_BADGE as readonly string[]).includes(valor);

/** Genera el slug de un label. Solo se usa al crear: después el slug es inmutable. */
export const slugificar = (label: string): string =>
  label
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
