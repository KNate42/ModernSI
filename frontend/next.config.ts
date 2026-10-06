// Next.js config: /api/* is proxied to the FastAPI backend, so the session cookie stays on this origin.
// This work made by Anfinogentov Nikita
import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:8040";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
