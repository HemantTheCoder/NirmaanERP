import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Verifies a Turnstile token server-side before the client is allowed to
 * proceed with signup. Follows Cloudflare's siteverify pattern:
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Note on scope: this gates our own signup form, but Supabase's public
 * signUp() endpoint remains directly reachable with the anon key regardless
 * — that's inherent to calling Supabase auth straight from the client, not
 * something this route can close off. It raises the bar against casual bot
 * signups (the actual problem — see 0030/README on the SMTP rate-limit
 * issue), not a guarantee against a targeted bypass.
 */
export async function POST(req: Request) {
  try {
    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";

    const rateCheck = checkRateLimit(`turnstile-verify:${clientIp}`, 20, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ success: false, error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const body = await req.json();
    const token: unknown = body?.token;
    const action: unknown = body?.action;

    if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
      return NextResponse.json({ success: false, error: "Missing or invalid token" }, { status: 400 });
    }

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      console.error("TURNSTILE_SECRET_KEY is not set");
      return NextResponse.json({ success: false, error: "Verification is not configured" }, { status: 500 });
    }

    const allowedHostnames = (process.env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);

    // In local dev there's no configured production hostname to check against —
    // skip the hostname allowlist rather than lock developers out, but never
    // relax this in production.
    const isDev = process.env.NODE_ENV !== "production";
    if (allowedHostnames.length === 0 && !isDev) {
      console.error("TURNSTILE_HOSTNAMES is not set in production");
      return NextResponse.json({ success: false, error: "Verification is not configured" }, { status: 500 });
    }

    let result: {
      success: boolean;
      action?: string;
      hostname?: string;
      "error-codes"?: string[];
    };

    try {
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10_000),
        body: new URLSearchParams({
          secret,
          response: token,
          ...(clientIp !== "unknown" ? { remoteip: clientIp } : {}),
        }),
      });

      if (!verifyRes.ok) {
        throw new Error(`siteverify responded ${verifyRes.status}`);
      }
      result = await verifyRes.json();
    } catch (err) {
      console.error("Turnstile siteverify request failed:", err);
      return NextResponse.json({ success: false, error: "Verification service unavailable" }, { status: 503 });
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Challenge verification failed", codes: result["error-codes"] },
        { status: 403 }
      );
    }

    if (typeof action === "string" && result.action && result.action !== action) {
      return NextResponse.json({ success: false, error: "Action mismatch" }, { status: 403 });
    }

    if (allowedHostnames.length > 0 && result.hostname && !allowedHostnames.includes(result.hostname)) {
      return NextResponse.json({ success: false, error: "Hostname mismatch" }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unexpected error in verify-turnstile:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
