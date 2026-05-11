import type { Metadata } from "next";
import "./globals.css";
import "./impasto.css";

export const metadata: Metadata = {
  title: "Impasto · Pizzas y Empanadas · Neuquén Capital",
  description: "Pizza híbrida argentina con fermentación lenta de 48 horas. Delivery y take away en Neuquén Capital.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Fraunces:ital,wght@0,400;0,600;0,700;1,400&family=DM+Serif+Display&family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700&family=Nunito:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
