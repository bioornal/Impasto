import { STATIC_DATA } from "@/lib/data";
import { esCategoriaImpasto } from "@/lib/categorias";
import type { Bebida, CatalogData, Empanada, Pizza, Promo, Review } from "@/types";

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
  const categoria = String(product.categoria || "").toLowerCase();
  if (!esCategoriaImpasto(categoria)) return "otro";
  if (/caja\s*(?:x|×)\s*(?:6|12|24)\b/i.test(String(product.nombre || ""))) return "combo";
  if (categoria === "pizzas") return "pizza";
  if (categoria === "empanadas") return "empanada";
  return "bebida";
};

function mapPizza(product: DatabaseProduct): Pizza {
  const tags = asTags(product.tags);
  return {
    id: String(product.id ?? product.nombre),
    nombre: String(product.nombre || "Producto"),
    categoria: tags.includes("gourmet") ? "gourmet" : "clasica",
    precio: Number(product.precio ?? 0),
    desc: String(product.desc ?? ""),
    tags,
    popular: product.popular,
  };
}

function mapEmpanada(product: DatabaseProduct): Empanada {
  return {
    id: String(product.id ?? product.nombre),
    nombre: String(product.nombre || "Empanada"),
    precio: product.precio == null ? undefined : Number(product.precio),
    desc: String(product.desc ?? ""),
    tags: asTags(product.tags),
  };
}

function mapBebida(product: DatabaseProduct): Bebida {
  return {
    id: String(product.id ?? product.nombre),
    nombre: String(product.nombre || "Bebida"),
    precio: Number(product.precio ?? 0),
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
): CatalogData {
  const disponibles = products.filter((product) => product.disponible !== false);
  const clasificados = disponibles.map((product) => ({ product, type: productType(product) }));

  const descartados = clasificados.filter((item) => item.type === "otro");
  if (descartados.length > 0) {
    const detalle = descartados.map((item) => `${item.product.nombre} (${item.product.categoria})`).join(", ");
    console.warn(`[catalog] ${descartados.length} producto(s) fuera de CATEGORIAS_IMPASTO: ${detalle}`);
  }

  const deTipo = (type: string) => clasificados.filter((item) => item.type === type).map((item) => item.product);

  const boxPrices = { ...STATIC_DATA.empanadaBoxPrices };
  for (const box of deTipo("combo")) {
    const match = String(box.nombre || "").match(/(?:x|×)\s*(6|12|24)\b/i);
    if (match && Number(box.precio) > 0) boxPrices[Number(match[1]) as 6 | 12 | 24] = Number(box.precio);
  }

  return {
    pizzas: deTipo("pizza").map(mapPizza),
    empanadas: deTipo("empanada").map(mapEmpanada),
    bebidas: deTipo("bebida").map(mapBebida),
    empanadaBoxPrices: boxPrices,
    promos: mapPromos(promosRaw),
    reviews: mapReviews(reviewsRaw),
  };
}
