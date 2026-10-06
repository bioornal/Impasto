import { esCategoriaImpasto } from "@/lib/categorias";
import type { Etiqueta } from "@/lib/etiquetas";
import type { Bebida, CatalogData, Empanada, EtiquetaBadge, Pizza, Promo, Review } from "@/types";

export interface DatabaseProduct {
  id?: string | number;
  nombre?: string;
  tipo?: string;
  categoria?: string;
  precio?: number;
  disponible?: boolean;
  desc?: string;
  tags?: unknown;
  popular?: boolean;
}

const asTags = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];

type ProductType = "pizza" | "empanada" | "bebida" | "combo" | "otro";

/**
 * La categorización sale solo de `categoria`. La columna `tipo` vale 'pizza'
 * en las 57 filas —la migración 002 la creó con `default 'pizza'`— así que no
 * informa nada.
 */
const productType = (product: DatabaseProduct): ProductType => {
  const categoria = String(product.categoria || "");
  if (!esCategoriaImpasto(categoria)) return "otro";
  if (/caja\s*(?:x|×)\s*(?:6|12|24)\b/i.test(String(product.nombre || ""))) return "combo";
  if (categoria === "pizzas") return "pizza";
  if (categoria === "empanadas") return "empanada";
  return "bebida";
};

type DestinoBadge = "pizzas" | "empanadas";

/**
 * Devuelve los cartelitos de un producto: todas las etiquetas que tiene y que
 * se muestran en ese destino, ordenadas por `orden`. Hasta el 05/10/2026 se
 * mostraba una sola (la de menor orden); el dueño pidió verlas todas sobre la
 * foto, para que, por ejemplo, Gourmet no quede tapada por Más pedida.
 */
function resolverBadges(tags: string[], etiquetas: Etiqueta[], destino: DestinoBadge): EtiquetaBadge[] {
  return etiquetas
    .filter((e) => tags.includes(e.slug) && (e.mostrar_badge === "ambos" || e.mostrar_badge === destino))
    .sort((a, b) => a.orden - b.orden)
    .map((e) => ({ label: e.label, color: e.color }));
}

function mapPizza(product: DatabaseProduct, etiquetas: Etiqueta[]): Pizza {
  const tags = asTags(product.tags);
  return {
    id: String(product.id ?? product.nombre),
    nombre: String(product.nombre || "Producto"),
    categoria: tags.includes("gourmet") ? "gourmet" : "clasica",
    precio: Number(product.precio ?? 0),
    desc: String(product.desc ?? ""),
    tags,
    disponible: product.disponible !== false,
    popular: product.popular,
    badges: resolverBadges(tags, etiquetas, "pizzas"),
  };
}

function mapEmpanada(product: DatabaseProduct, etiquetas: Etiqueta[]): Empanada {
  const tags = asTags(product.tags);
  return {
    id: String(product.id ?? product.nombre),
    nombre: String(product.nombre || "Empanada"),
    precio: product.precio == null ? undefined : Number(product.precio),
    desc: String(product.desc ?? ""),
    tags,
    disponible: product.disponible !== false,
    badges: resolverBadges(tags, etiquetas, "empanadas"),
  };
}

// Orden de la carta de bebidas (pedido del dueño, 06/10/2026): por tipo y, dentro
// de cada tipo, alfabético por marca. La base no guarda el tipo de bebida, así que
// sale del nombre; lo que no reconoce va con las gaseosas.
const TIPOS_DE_BEBIDA: RegExp[] = [
  /\bagua\b/i,
  /cerveza|quilmes|brahma|stella|corona|heineken|patagonia|andes/i,
  /\bvino\b|malbec|cabernet|torront|merlot|syrah|espumante|champ/i,
];

const tipoDeBebida = (nombre: string) => TIPOS_DE_BEBIDA.findIndex((tipo) => tipo.test(nombre)) + 1;

/** Gaseosas, aguas, cervezas y vinos; dentro de cada grupo, por nombre. */
export function ordenarBebidas<T extends { nombre: string }>(bebidas: T[]): T[] {
  return [...bebidas].sort((a, b) =>
    tipoDeBebida(a.nombre) - tipoDeBebida(b.nombre)
    || a.nombre.localeCompare(b.nombre, "es", { numeric: true, sensitivity: "base" }));
}

function mapBebida(product: DatabaseProduct): Bebida {
  return {
    id: String(product.id ?? product.nombre),
    nombre: String(product.nombre || "Bebida"),
    precio: Number(product.precio ?? 0),
    disponible: product.disponible !== false,
  };
}

function mapPromos(value: unknown): Promo[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  return value.map((item: Record<string, unknown>) => ({
    id: String(item.id),
    titulo: String(item.titulo || item.nombre || "Promoción"),
    desc: String(item.desc || item.descripcion || ""),
    badge: String(item.badge || "Promo"),
  }));
}

function mapReviews(value: unknown): Review[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  return value.map((item: Record<string, unknown>) => ({
    nombre: String(item.nombre || "Cliente"),
    texto: String(item.texto || item.comentario || ""),
    rating: Number(item.rating || 5),
    producto: String(item.producto || ""),
  }));
}

export function buildCatalog(
  products: DatabaseProduct[],
  promosRaw: unknown,
  reviewsRaw: unknown,
  etiquetas: Etiqueta[] = [],
): CatalogData {
  const clasificados = products.map((product) => ({ product, type: productType(product) }));

  const descartados = clasificados.filter((item) => item.type === "otro");
  if (descartados.length > 0) {
    const detalle = descartados.map((item) => `${item.product.nombre} (${item.product.categoria})`).join(", ");
    console.warn(`[catalog] ${descartados.length} producto(s) fuera de CATEGORIAS_IMPASTO: ${detalle}`);
  }

  const deTipo = (type: string) => clasificados.filter((item) => item.type === type).map((item) => item.product);

  // Los combos también son productos de la base. Si no existen, queda 0 y no
  // se muestra un precio inventado como fallback.
  const boxPrices = { 6: 0, 12: 0, 24: 0 };
  for (const box of deTipo("combo")) {
    const match = String(box.nombre || "").match(/(?:x|×)\s*(6|12|24)\b/i);
    if (match && Number(box.precio) > 0) boxPrices[Number(match[1]) as 6 | 12 | 24] = Number(box.precio);
  }

  return {
    pizzas: deTipo("pizza").map((p) => mapPizza(p, etiquetas)),
    empanadas: deTipo("empanada").map((p) => mapEmpanada(p, etiquetas)),
    bebidas: ordenarBebidas(deTipo("bebida").map(mapBebida)),
    empanadaBoxPrices: boxPrices,
    promos: mapPromos(promosRaw),
    reviews: mapReviews(reviewsRaw),
  };
}
