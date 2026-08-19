"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail, MailCheck } from "lucide-react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/common/TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function ForgotPasswordForm() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("Please complete the verification challenge.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      captchaToken: turnstileToken ?? undefined,
    });

    turnstileRef.current?.reset();
    setTurnstileToken(null);
    setLoading(false);

    if (error) {
      setError(
        error.message.toLowerCase().includes("captcha")
          ? "Verification failed. Please complete the challenge again."
          : error.message
      );
      return;
    }

    // Always show the same confirmation, whether or not the address has an
    // account — resetPasswordForEmail must never let this form be used to
    // probe which emails are registered.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400">
          <MailCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-white font-medium">Check your email</h3>
          <p className="text-slate-400 text-sm mt-1">
            If an account exists for <span className="text-slate-300">{email}</span>, we&apos;ve
            sent a link to reset your password.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="forgot-email" className="text-sm font-medium text-slate-300">
          Email address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {TURNSTILE_SITE_KEY && (
        <div className="flex justify-center">
          <TurnstileWidget
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY}
            action="recovery"
            onToken={(token) => {
              setTurnstileToken(token);
              setError(null);
            }}
            onExpire={() => setTurnstileToken(null)}
            onError={(code) => {
              setTurnstileToken(null);
              setError(
                String(code) === "110200"
                  ? "Verification widget isn't authorized for this domain yet. Contact an admin to add it in the Cloudflare Turnstile dashboard."
                  : "Verification widget failed to load. Please refresh and try again."
              );
            }}
          />
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        id="forgot-password-submit"
        type="submit"
        disabled={loading || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-all shadow-lg shadow-indigo-500/20 mt-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
