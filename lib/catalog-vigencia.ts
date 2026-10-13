/** La carta que se muestra puede venir del caché hasta 5 minutos; más vieja, se vuelve a leer (y si la base no responde, error como siempre). */
export const CATALOGO_MAX_VIEJO_MS = 5 * 60_000;

export function catalogoVigente(leidoAt: number, ahora: number, maxMs = CATALOGO_MAX_VIEJO_MS): boolean {
  return Number.isFinite(leidoAt) && Math.abs(ahora - leidoAt) <= maxMs;
}
