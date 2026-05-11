import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/admin", destination: "/admin/admin.html" },
    ];
  },
};

export default nextConfig;
