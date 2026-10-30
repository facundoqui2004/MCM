import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // permite correr `next dev` y `next start` en paralelo sin pisarse (útil para pruebas E2E)
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
