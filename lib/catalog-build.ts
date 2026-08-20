import { STATIC_DATA } from "@/lib/data";
import type { Bebida, CatalogData, Empanada, Pizza, Promo, Review } from "@/types";

export interface DatabaseProduct {
  id?: string | number;
  nombre?: string;
  tipo?: string;
  type?: string;
  categoria?: string;
  precio?: number;
  disponible?: boolean;
  desc?: string;
  descripcion?: string;
  tags?: unknown;
  popular?: boolean;
}

const asTags = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];

const productType = (product: DatabaseProduct) => {
  const type = String(product.tipo || product.type || "").toLowerCase();
  const category = String(product.categoria || "").toLowerCase();
  if (type.includes("empan")) return "empanada";
  if (type.includes("bebida") || type.includes("drink")) return "bebida";
  if (type.includes("combo") || type.includes("caja")) return "combo";
  if (/caja\s*(x|×)\s*(6|12|24)\b/i.test(String(product.nombre || ""))) return "combo";
  if (category.includes("empan")) return "empanada";
  if (category.includes("bebida") || category.includes("drink")) return "bebida";
  if (category.includes("pizza")) return "pizza";
  if (STATIC_DATA.bebidas.some((item) => item.nombre === product.nombre)) return "bebida";
  if (STATIC_DATA.pizzas.some((item) => item.nombre === product.nombre)) return "pizza";
  return "otro";
};

function mapPizza(product: DatabaseProduct): Pizza {
  const fallback = STATIC_DATA.pizzas.find((item) => item.nombre === product.nombre);
  const tags = asTags(product.tags);
  return {
    id: String(product.id ?? fallback?.id ?? product.nombre),
    nombre: String(product.nombre || fallback?.nombre || "Producto"),
    categoria: product.categoria === "gourmet" ? "gourmet" : fallback?.categoria || "clasica",
    precio: Number(product.precio ?? fallback?.precio ?? 0),
    desc: String(product.desc ?? product.descripcion ?? fallback?.desc ?? ""),
    tags: tags.length ? tags : fallback?.tags || [],
    popular: product.popular ?? fallback?.popular,
  };
}

function mapEmpanada(product: DatabaseProduct): Empanada {
  const fallback = STATIC_DATA.empanadas.find((item) => item.nombre === product.nombre);
  const tags = asTags(product.tags);
  return {
    id: String(product.id ?? fallback?.id ?? product.nombre),
    nombre: String(product.nombre || fallback?.nombre || "Empanada"),
    precio: product.precio == null ? fallback?.precio : Number(product.precio),
    desc: String(product.desc ?? product.descripcion ?? fallback?.desc ?? ""),
    tags: tags.length ? tags : fallback?.tags || [],
  };
}

function mapBebida(product: DatabaseProduct): Bebida {
  const fallback = STATIC_DATA.bebidas.find((item) => item.nombre === product.nombre);
  return {
    id: String(product.id ?? fallback?.id ?? product.nombre),
    nombre: String(product.nombre || fallback?.nombre || "Bebida"),
    precio: Number(product.precio ?? fallback?.precio ?? 0),
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
