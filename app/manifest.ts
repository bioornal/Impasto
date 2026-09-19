import type { MetadataRoute } from "next";
import { BUSINESS } from "@/lib/business";
import { descripcionSitio } from "@/lib/seo";

/**
 * Manifiesto de aplicación web. No convierte al sitio en una PWA completa —no
 * hay service worker— pero sí define nombre, color y modo de pantalla cuando
 * alguien lo agrega al inicio del celular, y es una señal más de marca para
 * los buscadores.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BUSINESS.name} · Pizzería en ${BUSINESS.city}`,
    short_name: BUSINESS.name,
    description: descripcionSitio(BUSINESS),
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#b2472a",
    lang: "es-AR",
    categories: ["food", "shopping"],
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/logo-blanco.png", sizes: "2000x639", type: "image/png" },
    ],
  };
}
