/**
 * Fotos que el dueño sube desde el admin (Productos → Editar producto). Puro, para
 * testearse con `tsx`; la ruta es `app/api/admin/productos/[id]/foto/route.ts`.
 */
export const TAMANO_MAXIMO = 4 * 1024 * 1024; // Netlify: cuerpo de hasta 6 MB, en base64.

export interface TipoImagen { ext: "jpg" | "png" | "webp"; mime: string }

function empiezaCon(bytes: Uint8Array, firma: number[], desde = 0): boolean {
  return firma.every((b, i) => bytes[desde + i] === b);
}

/** Reconoce la imagen por sus primeros bytes, no por lo que declara el navegador. */
export function tipoDeImagen(bytes: Uint8Array): TipoImagen | null {
  if (empiezaCon(bytes, [0xff, 0xd8, 0xff])) return { ext: "jpg", mime: "image/jpeg" };
  if (empiezaCon(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", mime: "image/png" };
  if (empiezaCon(bytes, [0x52, 0x49, 0x46, 0x46]) && empiezaCon(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return { ext: "webp", mime: "image/webp" };
  return null;
}

export function validarFoto(bytes: Uint8Array, tamano: number): { ok: true; tipo: TipoImagen } | { ok: false; error: string } {
  if (!tamano) return { ok: false, error: "Elegí una foto." };
  if (tamano > TAMANO_MAXIMO) return { ok: false, error: "La foto pesa más de 4 MB." };
  const tipo = tipoDeImagen(bytes);
  return tipo ? { ok: true, tipo } : { ok: false, error: "La foto tiene que ser JPG, PNG o WebP." };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const idValido = (id: string) => UUID.test(id);

/** `fotos/<id>/<fecha>.<ext>`: cada subida es un archivo nuevo; el CDN nunca sirve una foto vieja. */
export function claveDeFoto(productoId: string, fecha: Date, ext: TipoImagen["ext"]): string {
  const sello = fecha.toISOString().replace(/[-:.]/g, "");
  return `fotos/${productoId}/${sello}.${ext}`;
}
