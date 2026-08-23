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
 * Devuelve el cartelito ganador para un producto: la etiqueta de menor `orden`
 * entre las que tiene y que se muestran en ese destino. Un solo badge por
 * tarjeta es decisión de diseño: cuando todo se destaca, nada se destaca.
 */
function resolverBadge(tags: string[], etiquetas: Etiqueta[], destino: DestinoBadge): EtiquetaBadge | undefined {
  const aplicables = etiquetas.filter((e) =>
    tags.includes(e.slug) &&
    (e.mostrar_badge === "ambos" || e.mostrar_badge === destino));
  if (aplicables.length === 0) return undefined;
  const gana = aplicables.reduce((a, b) => (b.orden < a.orden ? b : a));
  return { label: gana.label, color: gana.color };
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
    badge: resolverBadge(tags, etiquetas, "pizzas"),
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
    badge: resolverBadge(tags, etiquetas, "empanadas"),
  };
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
    bebidas: deTipo("bebida").map(mapBebida),
    empanadaBoxPrices: boxPrices,
    promos: mapPromos(promosRaw),
    reviews: mapReviews(reviewsRaw),
  };
}
