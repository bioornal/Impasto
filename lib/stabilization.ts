export function nonNegativeRate(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export class QuoteChangedError extends Error {
  constructor() {
    super('El total cambió. Volvé al resumen para actualizarlo antes de pagar.');
    this.name = 'QuoteChangedError';
  }
}

export function assertExpectedTotal(expected: unknown, actual: number): void {
  if (typeof expected !== 'number' || !Number.isFinite(expected) || expected <= 0 || expected !== actual) {
    throw new QuoteChangedError();
  }
}

export async function confirmAdminMutation(send: () => Promise<Response>): Promise<void> {
  const response = await send();
  const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!response.ok || result?.ok !== true) throw new Error(result?.error || 'No se pudo guardar el cambio.');
}
