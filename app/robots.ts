import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * El panel y la API quedan fuera del índice. `/admin` ya redirige a login,
 * pero sin esto Google igual lo rastrea y gasta presupuesto de rastreo en
 * páginas que siempre le van a devolver un redirect.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      // `/pedido/` lleva nombre, dirección e ítems del cliente: no va al índice.
      disallow: ["/admin", "/admin/", "/admin-login", "/api/", "/pedido/"],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
