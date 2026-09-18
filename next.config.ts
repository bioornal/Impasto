import type { NextConfig } from "next";

// Report-Only: registra en la consola lo que bloquearía, sin bloquear. Pasar a
// "Content-Security-Policy" recién después de un pago real con tarjeta sin violaciones.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com https://*.mercadopago.com https://*.mlstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // cdn.insforge.dev: las fotos de la carta. mercadolibre/mercadolivre: el antifraude de MP.
  "img-src 'self' data: blob: https://3agqcygs.us-east.insforge.app https://cdn.insforge.dev https://images.unsplash.com https://*.mercadopago.com https://*.mercadolibre.com https://*.mercadolivre.com https://*.mlstatic.com",
  "connect-src 'self' https://*.mercadopago.com https://*.mercadolibre.com https://*.mercadolivre.com https://*.mlstatic.com",
  "frame-src https://*.mercadopago.com https://*.mercadolibre.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    // Storage de InsForge: el logo del navbar y, más adelante, las fotos de
    // productos que sube el dueño desde el panel.
    remotePatterns: [
      { protocol: "https", hostname: "3agqcygs.us-east.insforge.app", pathname: "/api/storage/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy-Report-Only", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
