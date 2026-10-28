"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const LINKS = [
  { href: "/admin", label: "Financeiro" },
  { href: "/admin/fiado", label: "Fiado" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/combos", label: "Combos" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Painel administrativo" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
      {LINKS.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin" || Boolean(pathname?.startsWith("/admin/eventos"))
            : Boolean(pathname?.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-xl px-3 text-sm font-medium ${
              active
                ? "bg-amber-500 text-zinc-950"
                : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function CurrentNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

/** O caminho atual só existe em tempo de requisição; o fallback pré-renderiza os links sem destaque. */
export function AdminNav() {
  return (
    <Suspense fallback={<NavLinks pathname={null} />}>
      <CurrentNavLinks />
    </Suspense>
  );
}
