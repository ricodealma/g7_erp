import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI (migrate/seed) usa conexão de sessão; o runtime usa DATABASE_URL (pooler de transação).
    url: env("DIRECT_URL"),
  },
});
