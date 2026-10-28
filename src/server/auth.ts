import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { can, type Permission, type Role } from "./auth-policy";
import { DomainError } from "./counter/errors";
import { db } from "./db";

export type Viewer = { id: string; name: string; email: string; role: Role };

/** Erro de autenticação/autorização com mensagem pronta para o operador. */
export class AuthError extends DomainError {}

/**
 * Data Access Layer de sessão: valida o JWT do Supabase Auth e exige um perfil ativo
 * no banco. Memoizado por requisição.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const profile = await db.profile.findUnique({ where: { id: userId } });
  if (!profile?.active) return null;
  return { id: profile.id, name: profile.name, email: profile.email, role: profile.role };
});

/** Para Server Actions: lança AuthError se não houver sessão ou permissão. */
export async function authorize(permission: Permission): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthError("Sessão expirada. Entre novamente.");
  if (!can(viewer.role, permission)) throw new AuthError("Apenas administradores podem fazer isso.");
  return viewer;
}

/**
 * Para páginas: sem sessão válida, encerra a sessão do Supabase (se houver) e volta ao login.
 * Passar pela rota de saída evita loop quando o login existe mas o perfil está inativo.
 */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/sign-out?motivo=sem-acesso");
  return viewer;
}
