import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";

const PUBLIC_PATHS = ["/login", "/auth/", "/api/cron/"];

/**
 * Renova a sessão do Supabase Auth a cada requisição e faz a checagem otimista de login.
 * A autorização definitiva (perfil ativo e papel) acontece no servidor, em `src/server/auth.ts`.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path));

  // Server Actions (POST) não são redirecionadas: elas próprias recusam sem sessão.
  if (request.method !== "GET") return response;

  const target = !signedIn && !isPublic ? "/login" : signedIn && pathname === "/login" ? "/" : null;
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
