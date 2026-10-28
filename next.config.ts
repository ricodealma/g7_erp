import type { NextConfig } from "next";

// Valida as variáveis de ambiente no build: falha cedo se faltar alguma.
import "./src/env";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Testar pelo celular na rede local em dev: DEV_ALLOWED_ORIGINS="192.168.0.10" (separados por vírgula).
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) ?? [],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
