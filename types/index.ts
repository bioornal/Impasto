export interface EtiquetaBadge {
  label: string;
  color: string;
}

export interface Pizza {
  id: string;
  nombre: string;
  categoria: "clasica" | "gourmet";
  precio: number;
  desc: string;
  tags: string[];
  disponible: boolean;
  popular?: boolean;
  /** Etiquetas del panel que se ven en pizzas, en su `orden`. */
  badges?: EtiquetaBadge[];
  /** Foto elegida en el servidor (`lib/fotos.ts`); sin ella, las ilustraciones usan el respaldo. */
  foto?: string;
}

export interface Empanada {
  id: string;
  nombre: string;
  precio?: number;
  desc: string;
  tags: string[];
  disponible: boolean;
  /** Etiquetas del panel que se ven en empanadas, en su `orden`. */
  badges?: EtiquetaBadge[];
  foto?: string;
}

export interface Bebida {
  id: string;
  nombre: string;
  precio: number;
  disponible: boolean;
  foto?: string;
}

export interface Promo {
  id: string;
  titulo: string;
  desc: string;
  badge: string;
}

export interface Review {
  nombre: string;
  texto: string;
  rating: number;
  /** Sobre qué opinó ("Diavola al Miele", "Empanadas") o vacío. */
  producto?: string;
}

export interface CatalogData {
  pizzas: Pizza[];
  empanadas: Empanada[];
  bebidas: Bebida[];
  empanadaBoxPrices: Record<6 | 12 | 24, number>;
  promos: Promo[];
  reviews: Review[];
  preciosNoDisponibles?: string[];
  empanadaBoxNoDisponibles?: Array<6 | 12 | 24>;
  /** Lo que suma cada caja de empanadas además de sus empanadas. Interno: no se muestra aparte. */
  empanadaBoxCharge?: Record<6 | 12 | 24, number>;
}

export interface CartItem {
  key: string;
  cartId: string;
  type: "pizza" | "pizza-half" | "empanadas" | "bebida";
  name: string;
  detail?: string;
  price: number;
  qty: number;
  illus?: string;
  unique?: boolean;
  variant?:
    | { kind: "half"; ids: [string, string] }
    | { kind: "empanadas-box"; size: 6 | 12 | 24; selections: Record<string, number> };
}
