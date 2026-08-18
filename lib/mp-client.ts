import { loadMercadoPago } from "@mercadopago/sdk-js";

/** Tipos mínimos de MercadoPago.js v2, sólo lo que usa el formulario propio. */
export interface SecureField {
  mount: (containerId: string) => SecureField;
  unmount: () => void;
  on: (event: string, handler: (data: Record<string, unknown>) => void) => SecureField;
  update: (props: Record<string, unknown>) => SecureField;
}

export interface PayerCost {
  installments: number;
  recommended_message: string;
  total_amount: number;
}

export interface IdentificationType {
  id: string;
  name: string;
}

export interface MpInstance {
  fields: {
    create: (type: string, options?: Record<string, unknown>) => SecureField;
    createCardToken: (data: {
      cardholderName: string;
      identificationType: string;
      identificationNumber: string;
    }) => Promise<{ id: string }>;
  };
  getIdentificationTypes: () => Promise<IdentificationType[]>;
  getPaymentMethods: (params: { bin: string }) => Promise<{
    results: { id: string; payment_type_id: string; issuer?: { id: number } }[];
  }>;
  getInstallments: (params: { amount: string; bin: string; paymentTypeId: string }) => Promise<
    { payer_costs: PayerCost[] }[]
  >;
}

let instance: MpInstance | null = null;

/** Carga el SDK una sola vez por sesión de navegador. */
export async function getMercadoPago(publicKey: string): Promise<MpInstance> {
  if (instance) return instance;
  await loadMercadoPago();
  const MercadoPago = (window as unknown as { MercadoPago: new (key: string, opts?: Record<string, unknown>) => MpInstance }).MercadoPago;
  instance = new MercadoPago(publicKey, { locale: "es-AR" });
  return instance;
}
