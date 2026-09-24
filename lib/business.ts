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
  /** Texto que se muestra al cliente: el horario en que se trabaja. */
  hours: string;
  /** Días abiertos con numeración de JS: 0 = domingo … 6 = sábado. */
  diasApertura: number[];
  horaApertura: string;
  /**
   * Hora del último pedido, que no es la de cierre del local: se trabaja
   * hasta las 00:00 pero se deja de tomar pedidos a las 23:45.
   */
  horaCierre: string;
  zonaHoraria: string;
  /** Interruptor manual: manda por encima del horario. */
  ventasActivas: boolean;
  /** Motivo mostrado al cliente cuando las ventas están cortadas a mano. */
  mensajeCierre: string;
  deliveryFee: number;
  /** Monto de subtotal a partir del cual el envío es gratis. */
  freeShippingFrom: number;
  /**
   * Rango estimado de entrega, para delivery y para retiro. Se muestra **como
   * estimado, nunca como promesa**: el local no puede garantizar una hora exacta.
   * Antes había tres tiempos distintos hardcodeados en el carrito y el checkout,
   * y se contradecían entre sí.
   */
  deliveryEstimate: string;
  /** Datos bancarios para transferencias directas */
  cbu?: string;
  aliasCbu?: string;
  banco?: string;
  titularCuenta?: string;
}

export const SUCURSAL_ID = "iguazu";

export const BUSINESS: BusinessConfig = {
  id: SUCURSAL_ID,
  name: "Impasto",
  city: "Puerto Iguazú",
  locationLabel: "Puerto Iguazú, Misiones",
  phone: "(03757) 42-1840",
  whatsappPhone: "543757652003",
  email: "impastopizzas.pedidos@gmail.com",
  address: "Santa María esq. Obispo Angelelli",
  instagram: "@impasto.iguazu",
  facebook: "Impasto Iguazú",
  hours: "Martes a Domingo · 19:30 — 00:00",
  diasApertura: [2, 3, 4, 5, 6, 0],
  horaApertura: "19:30",
  horaCierre: "23:45",
  zonaHoraria: "America/Argentina/Buenos_Aires",
  ventasActivas: true,
  mensajeCierre: "",
  deliveryFee: 3000,
  freeShippingFrom: 35000,
  deliveryEstimate: "30 a 50 min",
  // **Vacíos a propósito, y no tocar.** Son los únicos datos del negocio a los
  // que un cliente le manda plata. `getBusinessConfig()` cae a este objeto ante
  // cualquier error de base, así que un valor de ejemplo acá se convierte, en
  // un mal momento, en un alias real mostrado a alguien que está por transferir.
  // Los datos verdaderos viven en `sucursales` y se cargan desde el panel; si
  // faltan, la pantalla de transferencia no se muestra.
  cbu: "",
  aliasCbu: "",
  banco: "",
  titularCuenta: "",
} as const;

export const DELIVERY_FEE = BUSINESS.deliveryFee;
export const FREE_SHIPPING_FROM = BUSINESS.freeShippingFrom;
