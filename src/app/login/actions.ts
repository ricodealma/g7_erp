"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/server/db";

export type SignInState = { error: string | null; email: string };

const credentialsSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  password: z.string().min(1, "Informe a senha."),
});

export async function signInAction(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", email };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "E-mail ou senha incorretos.", email };

  // Login no Supabase não basta: é preciso um perfil ativo criado pelo administrador.
  const profile = await db.profile.findUnique({ where: { id: data.user.id }, select: { active: true } });
  if (!profile?.active) {
    await supabase.auth.signOut();
    return { error: "Usuário sem acesso ao sistema. Fale com o administrador.", email };
  }

  redirect("/");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
