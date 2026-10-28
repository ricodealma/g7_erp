import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · Cantina G7" };

async function LoginWithReason({ searchParams }: PageProps<"/login">) {
  const { motivo } = await searchParams;
  return <LoginForm reason={typeof motivo === "string" ? motivo : undefined} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <h1 className="text-2xl font-bold">Cantina G7</h1>
          <p className="text-sm opacity-70">Entre com o usuário criado pelo administrador.</p>
        </div>
        <Suspense fallback={<LoginForm />}>
          <LoginWithReason {...props} />
        </Suspense>
      </div>
    </main>
  );
}
