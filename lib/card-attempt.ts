import type { CartItem } from "@/types";

const STORAGE_KEY = "impasto_card_attempt_reference";
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FORMATO = new RegExp(`^IM-\\d{6}-[${ALFABETO}]{4}$`);

interface CryptoSource {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

export function normalizeCardAttemptReference(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  return FORMATO.test(normalized) ? normalized : null;
}

export function resolveOrderExternalReference(value: unknown, fallback: () => string): string {
  if (value === null || value === undefined || String(value).trim() === "") return fallback();
  const normalized = normalizeCardAttemptReference(value);
  if (!normalized) throw new Error("Referencia de pago inválida");
  return normalized;
}

export function shouldConfirmPendingCardAttempt(
  status: number,
  body: { numero?: unknown; estadoPago?: unknown },
): boolean {
  return status === 202
    && body.estadoPago === "pendiente"
    && normalizeCardAttemptReference(body.numero) !== null;
}

export interface PersistedCardAttempt {
  id: string;
  external_reference: string;
  estado_pago: string;
  nombre_cliente: string;
  telefono_cliente: string;
  email_cliente: string;
  direccion: string;
  modalidad: string;
  productos: CartItem[];
}

export function createCardAttemptReference(source: CryptoSource = globalThis.crypto): string {
  const random = new Uint32Array(5);
  source.getRandomValues(random);
  const numero = 100000 + (random[0] % 900000);
  let sufijo = "";
  for (let i = 1; i < random.length; i++) {
    sufijo += ALFABETO[random[i] % ALFABETO.length];
  }
  return `IM-${numero}-${sufijo}`;
}

export function getOrCreateCardAttemptReference(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  create: () => string = createCardAttemptReference,
): string {
  const existing = normalizeCardAttemptReference(storage.getItem(STORAGE_KEY));
  if (existing) return existing;

  const reference = create();
  const normalized = normalizeCardAttemptReference(reference);
  if (!normalized) throw new Error("No se pudo generar una referencia de pago válida");
  storage.setItem(STORAGE_KEY, normalized);
  return normalized;
}

export function clearCardAttemptReference(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  expected: string,
): void {
  if (storage.getItem(STORAGE_KEY) === expected) storage.removeItem(STORAGE_KEY);
}

const normalizeText = (value: unknown) =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es-AR");

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("54") && digits.length > 10 ? digits.slice(2) : digits;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function itemIdentity(item: CartItem) {
  return {
    key: String(item.key || ""),
    type: String(item.type || ""),
    qty: Number(item.qty || 0),
    variant: stableValue(item.variant ?? null),
  };
}

function matchesAttempt(
  existing: PersistedCardAttempt,
  request: { nombre: string; tel: string; email: string; dir?: string; mode: string; items: CartItem[] },
) {
  if (normalizeText(existing.nombre_cliente) !== normalizeText(request.nombre)) return false;
  if (normalizePhone(existing.telefono_cliente) !== normalizePhone(request.tel)) return false;
  if (normalizeText(existing.email_cliente) !== normalizeText(request.email)) return false;
  if (normalizeText(existing.direccion) !== normalizeText(request.dir || "Retiro en local")) return false;
  if (normalizeText(existing.modalidad) !== normalizeText(request.mode)) return false;

  const persistedItems = Array.isArray(existing.productos) ? existing.productos.map(itemIdentity) : [];
  const requestedItems = Array.isArray(request.items) ? request.items.map(itemIdentity) : [];
  return JSON.stringify(persistedItems) === JSON.stringify(requestedItems);
}

export function decideCardAttempt(
  existing: PersistedCardAttempt | null,
  request: {
    nombre: string;
    tel: string;
    email: string;
    dir?: string;
    mode: string;
    items: CartItem[];
  },
): "create" | "recover-approved" | "wait-pending" | "return-rejected" | "conflict" | "closed" {
  if (!existing) return "create";
  if (!matchesAttempt(existing, request)) return "conflict";

  switch (existing.estado_pago) {
    case "aprobado": return "recover-approved";
    case "pendiente": return "wait-pending";
    case "rechazado": return "return-rejected";
    default: return "closed";
  }
}
