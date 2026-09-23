import { PricingUnavailableError } from "./pricing-safety";

export function pricingHttpError(error: unknown): { status: number; error: string } {
  if (error instanceof PricingUnavailableError) return { status: 503, error: error.message };
  return { status: 400, error: error instanceof Error ? error.message : "No se pudo calcular el pedido" };
}
