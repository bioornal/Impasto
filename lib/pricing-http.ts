import { PricingUnavailableError } from "./pricing-safety";
import { CupoAgotadoError } from "./cupos";

export function pricingHttpError(error: unknown): { status: number; error: string } {
  if (error instanceof PricingUnavailableError) return { status: 503, error: error.message };
  if (error instanceof CupoAgotadoError) return { status: 409, error: error.message };
  return { status: 400, error: error instanceof Error ? error.message : "No se pudo calcular el pedido" };
}
