/**
 * Cria (ou atualiza) um usuário no Supabase Auth e o perfil de acesso correspondente.
 * Não existe cadastro público: este script é o caminho para o primeiro administrador.
 *
 *   pnpm user:create --email admin@exemplo.com --name "Fulano" --role ADMIN [--password "..."]
 *
 * Sem --password, gera uma senha aleatória e a exibe uma única vez.
 */
import "dotenv/config";

import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../src/generated/prisma/client";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não definida.`);
  return value;
}

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "OPERATOR" },
    password: { type: "string" },
  },
});

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
const role = values.role?.toUpperCase();
if (!email || !name || (role !== "ADMIN" && role !== "OPERATOR")) {
  console.error('Uso: pnpm user:create --email <email> --name "<nome>" --role ADMIN|OPERATOR [--password <senha>]');
  process.exit(1);
}

const generated = !values.password;
const password = values.password ?? randomBytes(9).toString("base64url");

const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: required("DIRECT_URL") }) });

async function findUserId(): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 200) return null;
  }
}

async function main() {
  let userId = await findUserId();

  if (userId) {
    if (values.password) {
      const { error } = await supabase.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
    }
    console.log(`Usuário já existia no Supabase Auth: ${email}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error || !data.user) throw error ?? new Error("Falha ao criar usuário.");
    userId = data.user.id;
    console.log(`Usuário criado no Supabase Auth: ${email}`);
  }

  await db.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: email!, name: name!, role: role as "ADMIN" | "OPERATOR" },
    update: { email, name, role: role as "ADMIN" | "OPERATOR", active: true },
  });
  console.log(`Perfil ${role} ativo para ${name}.`);
  if (generated) console.log(`Senha gerada (anote agora, não será exibida novamente): ${password}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
