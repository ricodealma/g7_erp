import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Encerra a sessão e volta ao login, preservando o motivo para exibir ao usuário. */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const url = new URL("/login", request.url);
  const reason = request.nextUrl.searchParams.get("motivo");
  if (reason) url.searchParams.set("motivo", reason);
  return NextResponse.redirect(url);
}
