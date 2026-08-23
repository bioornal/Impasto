import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * El sitio es una sola página con secciones (#pizzas, #empanadas, #bebidas,
 * #nosotros). Los fragmentos no van en el sitemap —Google los ignora— así que
 * hay una sola entrada. Cuando la carta se abra a rutas propias por producto,
 * este archivo es el lugar donde enumerarlas.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: `${SITE_URL}/`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1,
  }];
}
