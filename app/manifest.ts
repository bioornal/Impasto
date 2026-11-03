import type { MetadataRoute } from "next";
import { getBusinessConfig } from "@/lib/business-server";
import { getCatalogDataVisible } from "@/lib/catalog-cache";
import { negocioDeCarta } from "@/lib/carta-visible";
import { descripcionSitio } from "@/lib/seo";

/**
 * Manifiesto de aplicación web. No convierte al sitio en una PWA completa —no
 * hay service worker— pero sí define nombre, color y modo de pantalla cuando
 * alguien lo agrega al inicio del celular, y es una señal más de marca para
 * los buscadores.
 */
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [data, config] = await Promise.all([getCatalogDataVisible(), getBusinessConfig()]);
  const hayEmpanadas = data.empanadas.length > 0;
  const BUSINESS = negocioDeCarta(config, hayEmpanadas);
  return {
    name: `${BUSINESS.name} · Pizzería en ${BUSINESS.city}`,
    short_name: BUSINESS.name,
    description: descripcionSitio(BUSINESS, hayEmpanadas),
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#b2472a",
    lang: "es-AR",
    categories: ["food", "shopping"],
    icons: [
      { src: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logo-cuadrado.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
