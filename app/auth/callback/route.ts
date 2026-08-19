import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Lands here after an OAuth provider (Google) redirects back with a one-time
 * `code`. Runs before any session cookie exists, so proxy.ts must treat this
 * path as public — otherwise the auth middleware would bounce the request to
 * /login before the exchange below ever runs.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
