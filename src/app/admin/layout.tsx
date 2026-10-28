import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";

import { signOutAction } from "../login/actions";
import { AdminNav } from "./_components/nav";

// Cada página chama requireAdmin(): layouts não são reexecutados em toda navegação.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-zinc-200 bg-white/90 px-4 pt-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <ArrowLeft size={18} /> Balcão
          </Link>
          <p className="mr-auto font-bold">Painel administrativo</p>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sair"
              title="Sair"
              className="inline-flex min-h-11 items-center rounded-xl px-3 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4">{children}</main>
    </div>
  );
}
