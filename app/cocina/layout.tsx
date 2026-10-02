import type { Metadata } from "next";
import "./cocina.css";

/**
 * La guía de armado no tiene login ni enlaces desde el sitio: la ruta es la
 * única barrera. `robots.ts` y el sitemap no la nombran a propósito (nombrarla
 * anunciaría que existe), así que el `noindex` es lo que impide que Google la
 * indexe si alguien comparte el enlace. Misma defensa que `/pedido` y `/admin`.
 */
export const metadata: Metadata = {
  title: "Armado de pizzas",
  robots: { index: false, follow: false },
};

export default function CocinaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
