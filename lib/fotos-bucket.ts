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
