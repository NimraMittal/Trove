import type { NextConfig } from "next";

const apiUrl = (
  process.env.TROVE_API_URL ??
  "http://127.0.0.1:3000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;