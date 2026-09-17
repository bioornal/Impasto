import type { NextConfig } from "next";

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
        ],
      },
    ];
  },
};

export default nextConfig;
