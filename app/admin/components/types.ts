export interface AdminProduct {
  _dbId: string;
  id: string;
  nombre: string;
  precio: number;
  active: boolean;
  type: "pizza" | "empanada" | "bebida";
  categoria: string;
  desc: string;
  tags: string[];
  popular: boolean;
  stock: number;
}

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface AdminOrder {
  _dbId: string;
  id: string;
  cliente: string;
  tel: string;
  mode: "delivery" | "takeaway";
  dir: string;
  zona: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  pago: string;
  pagoEstado: string;
  cambio: string;
  referencia: string;
  cuando: string;
  estado: string;
  fecha: string;
  notas: string;
}

export interface AdminCustomer {
  _dbId: string;
  id: string;
  nombre: string;
  tel: string;
  email: string;
  dir: string;
  zona: string;
  pedidos: number;
  total: number;
  fav: string;
  ultimo: string;
}

export interface Testimonial {
  id: string;
  nombre: string;
  texto: string;
  rating: number;
  estado: "pendiente" | "aprobado" | "rechazado";
  fecha: string;
}

export interface AdminEtiqueta {
  _dbId: string;
  slug: string;
  label: string;
  color: string;
  orden: number;
  mostrar_badge: string;
  sistema: boolean;
  usos: number;
}

export interface AdminState {
  loading: boolean;
  error: string | null;
  products: AdminProduct[];
  orders: AdminOrder[];
  customers: AdminCustomer[];
  testimonials: Testimonial[];
  etiquetas: AdminEtiqueta[];
}
