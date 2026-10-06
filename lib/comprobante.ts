/**
 * Comprobante de una transferencia, subido por el cliente. Puro, para testearse con
 * `tsx`; la ruta es `app/api/orders/[ref]/comprobante/route.ts`.
 */
import { tipoDeImagen, TAMANO_MAXIMO } from "@/lib/foto-subida";

export { TAMANO_MAXIMO };

export interface TipoComprobante { ext: "jpg" | "png" | "webp" | "pdf"; mime: string }

/** Reconoce el archivo por sus primeros bytes, no por lo que declara el navegador. */
export function tipoDeComprobante(bytes: Uint8Array): TipoComprobante | null {
  const imagen = tipoDeImagen(bytes);
  if (imagen) return imagen;
  // %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { ext: "pdf", mime: "application/pdf" };
  }
  return null;
}

export function validarComprobante(
  bytes: Uint8Array,
  tamano: number,
): { ok: true; tipo: TipoComprobante } | { ok: false; error: string; status: 413 | 415 | 400 } {
  if (!tamano) return { ok: false, error: "Elegí el comprobante.", status: 400 };
  if (tamano > TAMANO_MAXIMO) return { ok: false, error: "El archivo pesa más de 4 MB.", status: 413 };
  const tipo = tipoDeComprobante(bytes);
  return tipo
    ? { ok: true, tipo }
    : { ok: false, error: "El comprobante tiene que ser una foto (JPG, PNG, WebP) o un PDF.", status: 415 };
}

/** `<pedido>/<fecha>.<ext>`: cada subida es un archivo nuevo, nunca se pisa uno anterior. */
export function claveDeComprobante(pedidoId: string, fecha: Date, ext: TipoComprobante["ext"]): string {
  const sello = fecha.toISOString().replace(/[-:.]/g, "");
  return `${pedidoId}/${sello}.${ext}`;
}

/** Cuándo se puede subir: transferencia sin acreditar y pedido no cancelado. */
export function puedeSubirComprobante(pedido: { metodo_pago?: unknown; estado_pago?: unknown; status?: unknown }): boolean {
  const metodo = String(pedido.metodo_pago ?? "").toLowerCase();
  const estadoPago = String(pedido.estado_pago ?? "pendiente").toLowerCase() || "pendiente";
  const status = String(pedido.status ?? "").toLowerCase();
  return metodo === "transferencia" && estadoPago === "pendiente" && status !== "cancelado" && status !== "entregado";
}

/** Aviso al local (Telegram), sin formato: lleva el nombre que escribió el cliente. */
export function avisoComprobante(referencia: string, nombre: string, total: string, cuenta?: string): string {
  const una = (v: string) => v.replace(/\s+/g, " ").trim();
  return [
    `COMPROBANTE RECIBIDO — ${una(referencia)}`,
    `${una(nombre)} — ${una(total)}${cuenta ? ` — revisar en ${una(cuenta)}` : ""}`,
    "Verificá la transferencia y marcá \"Pago recibido\" en el panel.",
  ].join("\n");
}
