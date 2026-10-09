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
  /** Baja de carta (la base lo llama archivado). Solo lo usa el orden del admin. */
  archivado?: boolean;
  /** Foto que ve el cliente (la más nueva del bucket, `lib/fotos.ts`). Sin ella, la miniatura usa el respaldo. */
  foto?: string;
}

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
  detail?: string;
  /** Recargo manual del POS sobre la línea (no unitario). */
  extra?: number;
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
  puedeDevolverMP?: boolean;
  puedeRegistrarDevolucionManual?: boolean;
  puedeConsultarMP?: boolean;
  pagoMpManual?: boolean;
  /** Nombre corto de la cuenta que vio el cliente, si pagó por transferencia. */
  cuentaTransferencia?: string;
  /** Cuándo el cliente subió el comprobante; vacío si no lo subió. */
  comprobanteSubidoAt?: string;
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
  notas: string;
  ultimo: string | null;
  comprasSinImporte: number;
}

export interface Testimonial {
  id: string;
  nombre: string;
  texto: string;
  rating: number;
  estado: "pendiente" | "aprobado" | "rechazado";
  fecha: string;
  /** Sobre qué opinó, o vacío. */
  producto: string;
  /** Referencia del pedido si vino del seguimiento (verificada); vacío si vino de la home. */
  pedidoRef: string;
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
  customersError: string | null;
  customersLoading: boolean;
  customersUpdatedAt: string | null;
  testimonials: Testimonial[];
  etiquetas: AdminEtiqueta[];
}
