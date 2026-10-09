// Next.js config: /api/* is proxied to the FastAPI backend, so the session cookie stays on this origin.
// This work made by Anfinogentov Nikita
import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:8040";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The Docker image sets NEXT_OUTPUT=standalone: a self-contained server.js without the whole node_modules.
  // `npm run start` (and the e2e run) keep the regular build.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
