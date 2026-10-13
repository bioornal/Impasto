import { revalidateTag, unstable_cache } from "next/cache";
import { getCatalogData } from "@/lib/catalog";
import { catalogoVigente } from "@/lib/catalog-vigencia";
import type { CatalogData } from "@/types";

// Una lectura de las 12 tablas por minuto en vez de una por visita (egress, 13/10/2026).
const leer = unstable_cache(
  async () => ({ datos: await getCatalogData(), leidoAt: Date.now() }),
  ["catalogo-visible"],
  { revalidate: 60, tags: ["catalogo"] },
);

/**
 * Carta para mostrar: home, manifest, imagen para compartir, llms.txt y /api/productos.
 * La cotización y el pedido usan `getCatalogData()` fresco: la venta se sigue
 * bloqueando si falla una fuente de precios. El caché serializa a JSON: el
 * costeo (WeakMap) no viaja, y nada de lo que se muestra lo usa.
 */
export async function getCatalogDataVisible(): Promise<CatalogData> {
  const { datos, leidoAt } = await leer();
  return catalogoVigente(leidoAt, Date.now()) ? datos : getCatalogData();
}

/** Después de cambiar productos, etiquetas u opiniones desde el panel: el dueño ve su cambio al instante. */
export function invalidarCatalogo() {
  revalidateTag("catalogo", { expire: 0 });
}
