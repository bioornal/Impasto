import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./impasto.css";
import { BUSINESS } from "@/lib/business";
import { descripcionSitio } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

/**
 * Metadatos estáticos: salen de `BUSINESS` y no de la base, para que el layout
 * no dependa de una consulta. Los datos que Google realmente usa para el
 * horario y el teléfono son los del JSON-LD de `app/page.tsx`, que sí lee la
 * configuración viva del panel.
 */
const TITULO = `${BUSINESS.name} · Pizza híbrida: técnica napolitana, alma argentina · ${BUSINESS.locationLabel}`;
const DESCRIPCION = descripcionSitio(BUSINESS);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITULO, template: `%s · ${BUSINESS.name} ${BUSINESS.city}` },
  description: DESCRIPCION,
  applicationName: BUSINESS.name,
  category: "restaurant",
  keywords: [
    "pizzería Puerto Iguazú",
    "pizza Puerto Iguazú",
    "delivery Puerto Iguazú",
    "empanadas Puerto Iguazú",
    "pedir pizza Iguazú",
    "take away Iguazú",
    "Impasto",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: BUSINESS.name,
    locale: "es_AR",
    url: "/",
    title: TITULO,
    description: DESCRIPCION,
  },
  twitter: { card: "summary_large_image", title: TITULO, description: DESCRIPCION },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  icons: { icon: "/favicon.ico" },
  formatDetection: { telephone: true, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#b2472a",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Fraunces:ital,wght@0,400;0,600;0,700;1,400&family=DM+Serif+Display&family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700&family=Nunito:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
