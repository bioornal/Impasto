export class DatabaseOperationError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(`No se pudo ${operation}`);
    this.name = "DatabaseOperationError";
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause;
  }
}

export function requireDbRows<T>(
  result: { data: T[] | null; error: unknown },
  operation: string,
): T[] {
  if (result.error) throw new DatabaseOperationError(operation, result.error);
  return Array.isArray(result.data) ? result.data : [];
}

export function requireUpdatedRow<T>(
  result: { data: T[] | null; error: unknown },
  operation: string,
): T {
  const rows = requireDbRows(result, operation);
  if (rows.length !== 1) throw new DatabaseOperationError(operation);
  return rows[0];
}
