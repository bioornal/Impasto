import type {EstadoPago} from './mercadopago';
export function classifyPaymentCreateFailure(status:unknown):EstadoPago {
  const code=Number(status);
  // Timeout, reused/locked idempotency key and throttling cannot establish
  // that the same attempt was not accepted earlier. Preserve its identity.
  return Number.isInteger(code) && code>=400 && code<500 && ![408,409,423,429].includes(code) ? 'rechazado' : 'pendiente';
}
