import { env } from "@/env";
import { db } from "@/server/db";

/**
 * Mantém o projeto Supabase (plano gratuito) ativo: chamado diariamente pelo Vercel Cron.
 * A Vercel envia `Authorization: Bearer ${CRON_SECRET}` automaticamente.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  await db.$queryRaw`SELECT 1`;

  return Response.json({ ok: true, checkedAt: new Date().toISOString() });
}
