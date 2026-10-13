// Sondeo del panel: trae solo los pedidos que cambiaron desde el último
// `updated_at` visto (migración 20261013200000). Ver el spec del 13/10/2026.

/** 40 sondeos de 15 s = cada 10 minutos la lista completa, que reconcilia pedidos eliminados desde otro dispositivo. */
export const POLLS_ENTRE_RECARGAS = 40;

/** `now()` es la hora de inicio de la transacción: una que confirma tarde puede quedar detrás del cursor. */
export const SOLAPE_MS = 60_000;

export function cursorDePedidos(filas: ReadonlyArray<Record<string, unknown>>, anterior: string | null): string | null {
  let max = anterior ? Date.parse(anterior) : NaN;
  for (const fila of filas) {
    const t = typeof fila.updated_at === "string" ? Date.parse(fila.updated_at) : NaN;
    if (Number.isFinite(t) && (!Number.isFinite(max) || t > max)) max = t;
  }
  return Number.isFinite(max) ? new Date(max).toISOString() : null;
}

export function desdeParaConsulta(cursor: string, solapeMs = SOLAPE_MS): string {
  return new Date(Date.parse(cursor) - solapeMs).toISOString();
}

/** Reemplaza por `_dbId` y ordena como el servidor: más nuevos primero, desempate por id. */
export function unirPedidos<T extends { _dbId: string; fecha: string }>(actuales: readonly T[], cambios: readonly T[]): T[] {
  if (cambios.length === 0) return actuales as T[];
  const porId = new Map(actuales.map((p) => [p._dbId, p]));
  for (const p of cambios) porId.set(p._dbId, p);
  return [...porId.values()].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha) || a._dbId.localeCompare(b._dbId));
}
