import { randomBytes } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";

import { DomainError } from "../counter/errors";
import { createUserSchema, updateUserSchema, type CreateUserInput, type UpdateUserInput } from "./schemas";

/** Operações do Supabase Auth usadas aqui; injetadas para permitir testes sem o Supabase. */
export interface AuthAdmin {
  findUserIdByEmail(email: string): Promise<string | null>;
  createUser(input: { email: string; password: string; name: string }): Promise<string>;
  setPassword(userId: string, password: string): Promise<void>;
}

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "OPERATOR";
  active: boolean;
};

export function generatePassword() {
  return randomBytes(9).toString("base64url");
}

export async function listUsers(db: PrismaClient): Promise<AdminUser[]> {
  return db.profile.findMany({
    select: { id: true, name: true, email: true, role: true, active: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

/**
 * Cria o usuário no Supabase Auth com senha gerada (exibida uma única vez ao admin) e o
 * perfil de acesso. Um login já existente sem perfil é reaproveitado com senha nova.
 */
export async function createUser(db: PrismaClient, auth: AuthAdmin, rawInput: CreateUserInput) {
  const input = createUserSchema.parse(rawInput);
  if (await db.profile.findUnique({ where: { email: input.email } })) {
    throw new DomainError("Já existe um usuário com este e-mail.");
  }

  const password = generatePassword();
  let userId = await auth.findUserIdByEmail(input.email);
  if (userId) await auth.setPassword(userId, password);
  else userId = await auth.createUser({ email: input.email, password, name: input.name });

  await db.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: input.email, name: input.name, role: input.role },
    update: { email: input.email, name: input.name, role: input.role, active: true },
  });
  return { id: userId, password };
}

/** Edita nome, perfil e acesso. O admin não pode remover o próprio acesso (evita ficar sem admin). */
export async function updateUser(db: PrismaClient, rawInput: UpdateUserInput, actorId: string) {
  const input = updateUserSchema.parse(rawInput);
  if (input.id === actorId && (input.role !== "ADMIN" || !input.active)) {
    throw new DomainError("Você não pode remover o seu próprio acesso de administrador.");
  }
  const { count } = await db.profile.updateMany({
    where: { id: input.id },
    data: { name: input.name, role: input.role, active: input.active },
  });
  if (count === 0) throw new DomainError("Usuário não encontrado.");
}

export async function resetPassword(db: PrismaClient, auth: AuthAdmin, userId: string) {
  const profile = await db.profile.findUnique({ where: { id: userId } });
  if (!profile) throw new DomainError("Usuário não encontrado.");
  const password = generatePassword();
  await auth.setPassword(userId, password);
  return { password };
}
