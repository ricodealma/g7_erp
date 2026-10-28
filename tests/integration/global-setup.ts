import { execSync } from "node:child_process";

import { Client } from "pg";

export const DEFAULT_TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/g7_erp_test";

/** Recria o banco de testes do zero e aplica as migrations versionadas. */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL);
  const database = url.pathname.slice(1);
  if (!database.endsWith("_test")) {
    throw new Error(`Recusando recriar "${database}": o banco de testes deve terminar com "_test".`);
  }

  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${database}"`);
  await client.end();

  execSync("pnpm exec prisma migrate deploy", {
    env: { ...process.env, DIRECT_URL: url.toString() },
    stdio: "pipe",
  });
}
