import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * La home es la página que vende y concentra todas las señales (carta, horarios,
 * FAQ y JSON-LD). Las legales se listan igual: son indexables, dan confianza a
 * Google y a los motores de IA, y hasta ahora heredaban el canonical `/` del
 * layout, así que quedaban fuera del índice.
 *
 * Los fragmentos (`#pizzas`, `#empanadas`, `#preguntas`) no van: Google los ignora.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/terminos`,
      lastModified: ahora,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacidad`,
      lastModified: ahora,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/reembolso`,
      lastModified: ahora,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
