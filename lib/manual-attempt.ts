/** Only UUIDv4 browser secrets are accepted. Never fall back to a new attempt. */
export function manualAttemptKey(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ? value.toUpperCase() : null;
}
export class ManualAttemptConflict extends Error {
  constructor() { super('Este intento corresponde a otros datos de pedido. Recuperá el pedido original.'); }
}
export async function executeManualAttempt<T>(options: {
  lookup: () => Promise<T | null>; matches: (order: T) => boolean; create: () => Promise<T>;
}): Promise<{ order: T; recovered: boolean }> {
  const recover = (order: T) => {
    if (!options.matches(order)) throw new ManualAttemptConflict();
    return { order, recovered: true };
  };
  const existing = await options.lookup(); // Precedes pricing, hours and side effects.
  if (existing) return recover(existing);
  try { return { order: await options.create(), recovered: false }; }
  catch (error) {
    // A conflict or network error may follow a committed INSERT. Read once;
    // never create again automatically, and never rotate the browser secret.
    const committed = await options.lookup();
    if (committed) return recover(committed);
    throw error;
  }
}
type AttemptStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function durableManualAttempt<T>(storage: AttemptStorage, name: string, payload: T, create: () => string = () => globalThis.crypto.randomUUID()): { key: string; payload: T } {
  const raw = storage.getItem(name);
  if (raw) {
    // A damaged pending attempt may already be committed: do not discard it.
    const existing = JSON.parse(raw) as { key: string; payload: T };
    if (!manualAttemptKey(existing.key) || !existing.payload) throw new Error('No se pudo recuperar el intento pendiente');
    return existing;
  }
  const key = create();
  if (!manualAttemptKey(key)) throw new Error('No se pudo generar el intento de pedido');
  const attempt = { key, payload };
  storage.setItem(name, JSON.stringify(attempt)); // Fail closed if persistence unavailable.
  return attempt;
}
export function completeManualAttempt(storage: AttemptStorage, name: string, key: string) {
  const raw = storage.getItem(name);
  if (raw && JSON.parse(raw).key === key) storage.removeItem(name);
}
