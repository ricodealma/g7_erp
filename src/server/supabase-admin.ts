import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/env";

import type { AuthAdmin } from "./admin/users";
import { DomainError } from "./counter/errors";

/** Cliente administrativo do Supabase Auth (chave secreta; somente no servidor). */
export function createAuthAdmin(): AuthAdmin {
  if (!env.SUPABASE_SECRET_KEY) {
    throw new DomainError("Gestão de usuários indisponível: configure SUPABASE_SECRET_KEY no servidor.");
  }
  const { auth } = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    async findUserIdByEmail(email) {
      for (let page = 1; ; page++) {
        const { data, error } = await auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
        if (user) return user.id;
        if (data.users.length < 200) return null;
      }
    },
    async createUser({ email, password, name }) {
      const { data, error } = await auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (error || !data.user) throw error ?? new Error("Falha ao criar usuário no Supabase Auth.");
      return data.user.id;
    },
    async setPassword(userId, password) {
      const { error } = await auth.admin.updateUserById(userId, { password });
      if (error) throw error;
    },
  };
}
