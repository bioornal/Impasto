import { unstable_cache } from "next/cache";
import { db } from "@/lib/insforge";
import type { ObjetoFoto } from "@/lib/fotos";

const leer = unstable_cache(async (): Promise<ObjetoFoto[]> => {
  const objetos: ObjetoFoto[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from("DB").list({ limit: 1000, offset });
    const pagina = (data as { data?: unknown } | null)?.data;
    if (error || !Array.isArray(pagina)) throw new Error("No se pudo listar el bucket de fotos");
    for (const o of pagina as Array<Record<string, unknown>>) {
      if (typeof o.key === "string" && typeof o.url === "string") {
        objetos.push({ key: o.key, url: o.url, uploadedAt: String(o.uploadedAt ?? o.uploaded_at ?? "") });
      }
    }
    if (pagina.length < 1000) return objetos;
  }
}, ["fotos-bucket"], { revalidate: 60, tags: ["fotos"] });

/** Archivos del bucket `DB`, guardados un minuto. Si falla, lista vacía: se usan las fotos de respaldo. */
export async function listarFotos(): Promise<ObjetoFoto[]> {
  try { return await leer(); } catch (error) {
    console.error("[fotos] No se pudo listar el bucket:", error);
    return [];
  }
}

/**
 * Sube una foto con un PUT directo a la API de InsForge, como la CLI. La subida del SDK
 * (`storage.upload`) usa un formulario prefirmado de S3 que no deja fijar el tipo, y el
 * archivo quedaba como `binary/octet-stream` en vez de `image/webp` (comprobado el 03/10/2026).
 * Devuelve la URL pública.
 */
export async function subirFoto(clave: string, bytes: Uint8Array, mime: string): Promise<string> {
  const base = process.env.INSFORGE_API_BASE_URL;
  const url = `${base}/api/storage/buckets/DB/objects/${encodeURIComponent(clave)}`;
  const cuerpo = new FormData();
  cuerpo.append("file", new Blob([bytes as BlobPart], { type: mime }), clave.split("/").pop());
  const respuesta = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${process.env.INSFORGE_API_KEY}` },
    body: cuerpo,
  });
  if (!respuesta.ok) throw new Error(`La subida respondió ${respuesta.status}`);
  const datos = await respuesta.json().catch(() => ({}));
  return typeof datos?.url === "string" ? datos.url : url;
}
