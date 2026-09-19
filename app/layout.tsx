import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./impasto.css";
import { BUSINESS } from "@/lib/business";
import { PALABRAS_CLAVE, descripcionSitio, tituloSitio } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

/**
 * Metadatos estáticos: salen de `BUSINESS` y no de la base, para que el layout
 * no dependa de una consulta. Los datos que Google realmente usa para el
 * horario y el teléfono son los del JSON-LD de `app/page.tsx`, que sí lee la
 * configuración viva del panel.
 */
const TITULO = tituloSitio(BUSINESS);
const DESCRIPCION = descripcionSitio(BUSINESS);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITULO, template: `%s · ${BUSINESS.name} ${BUSINESS.city}` },
  description: DESCRIPCION,
  applicationName: BUSINESS.name,
  category: "restaurant",
  keywords: PALABRAS_CLAVE,
  authors: [{ name: BUSINESS.name, url: SITE_URL }],
  creator: BUSINESS.name,
  publisher: BUSINESS.name,
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
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
  // Códigos de verificación de Search Console y Bing. Sin la variable cargada
  // no se emite la etiqueta: un valor vacío es peor que ninguno.
  verification: {
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } }
      : {}),
  },
  appleWebApp: { capable: true, title: BUSINESS.name, statusBarStyle: "default" },
  icons: { icon: "/favicon.ico", apple: "/favicon.ico" },
  formatDetection: { telephone: true, address: false, email: false },
  // Señales geográficas: AR-N es el código ISO 3166-2 de Misiones. Ayudan a
  // atar el sitio a Puerto Iguazú cuando el dominio todavía es nuevo.
  other: {
    "geo.region": "AR-N",
    "geo.placename": BUSINESS.city,
  },
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
