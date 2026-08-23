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
  async rewrites() {
    return [
      { source: "/admin", destination: "/admin/admin.html" },
    ];
  },
};

export default nextConfig;
