export interface BusinessConfig {
  id: string;
  name: string;
  city: string;
  locationLabel: string;
  phone: string;
  whatsappPhone: string;
  email: string;
  address: string;
  instagram: string;
  facebook: string;
  hours: string;
  deliveryFee: number;
  /** Monto de subtotal a partir del cual el envío es gratis. */
  freeShippingFrom: number;
  /** Recargo por borde relleno de muzzarella en pizzas mitad y mitad. */
  bordeFee: number;
}

export const SUCURSAL_ID = "iguazu";

export const BUSINESS: BusinessConfig = {
  id: SUCURSAL_ID,
  name: "Impasto",
  city: "Puerto Iguazú",
  locationLabel: "Puerto Iguazú, Misiones",
  phone: "(03757) 42-1840",
  whatsappPhone: "543757421840",
  email: "hola@impastoiguazu.com.ar",
  address: "Santa María esq. Obispo Angelelli",
  instagram: "@impasto.iguazu",
  facebook: "Impasto Iguazú",
  hours: "Martes a Domingo · 19:30 — 00:00",
  deliveryFee: 3000,
  freeShippingFrom: 25000,
  bordeFee: 1500,
} as const;

export const DELIVERY_FEE = BUSINESS.deliveryFee;
export const FREE_SHIPPING_FROM = BUSINESS.freeShippingFrom;
export const BORDE_FEE = BUSINESS.bordeFee;
