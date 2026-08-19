import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SELF_ASSIGNABLE_ROLES = new Set(["project_manager", "site_staff", "client"]);

/** `next` is attacker-controllable (it's a query param on a public route) —
 * only ever redirect to a same-origin relative path. Rejects protocol-
 * relative ("//evil.com") and userinfo-style ("@evil.com") tricks. */
function isSafeRedirectPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}

/**
 * Lands here after an OAuth provider (Google) redirects back with a one-time
 * `code`. Runs before any session cookie exists, so proxy.ts must treat this
 * path as public — otherwise the auth middleware would bounce the request to
 * /login before the exchange below ever runs.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam && isSafeRedirectPath(nextParam) ? nextParam : "/dashboard";
  const roleParam = searchParams.get("role");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Google OAuth has no equivalent of signUp()'s `options.data` — the
      // handle_new_user trigger always defaults a brand-new profile row to
      // 'site_staff'. Apply whatever role the signup form actually offered,
      // but only for a signup that just happened seconds ago — never on a
      // returning user's login, even if an old signup link with a `role`
      // param gets bookmarked or replayed.
      const justCreated = Date.now() - new Date(data.user.created_at).getTime() < 60_000;
      if (justCreated && roleParam && SELF_ASSIGNABLE_ROLES.has(roleParam)) {
        await (supabase.from("users") as any)
          .update({ role: roleParam })
          .eq("id", data.user.id);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
