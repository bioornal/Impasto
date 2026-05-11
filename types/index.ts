export interface Pizza {
  id: string;
  nombre: string;
  categoria: "clasica" | "gourmet";
  precio: number;
  desc: string;
  tags: string[];
  popular?: boolean;
}

export interface Empanada {
  id: string;
  nombre: string;
  desc: string;
  tags: string[];
}

export interface Bebida {
  id: string;
  nombre: string;
  precio: number;
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
}

export interface CatalogData {
  pizzas: Pizza[];
  empanadas: Empanada[];
  bebidas: Bebida[];
  promos: Promo[];
  reviews: Review[];
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
}
