"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail, Lock, User, ChevronDown, Eye, EyeOff, MailCheck } from "lucide-react";
import type { UserRole } from "@/types/database";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/common/TurnstileWidget";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const SIGNUP_ROLES: { value: Exclude<UserRole, "admin" | "contractor">; label: string }[] = [
  { value: "project_manager", label: "Project Manager" },
  { value: "site_staff", label: "Site Staff" },
  { value: "client", label: "Client" },
];

export function SignupForm() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Exclude<UserRole, "admin" | "contractor">>("project_manager");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!turnstileToken) {
      setError("Please complete the verification challenge.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        captchaToken: turnstileToken,
      },
    });

    // Tokens are single-use regardless of outcome — always reset so the next
    // attempt gets a fresh challenge instead of silently failing.
    turnstileRef.current?.reset();
    setTurnstileToken(null);

    if (signupError) {
      if (signupError.message.toLowerCase().includes("captcha")) {
        setError("Verification failed. Please complete the challenge again.");
      } else if (signupError.message.toLowerCase().includes("rate limit") || signupError.status === 429) {
        setError(
          "Supabase email signup rate limit reached (free tier SMTP limits rapid new user signups). Please sign in using an existing demo account or try again in a few minutes."
        );
      } else {
        setError(signupError.message);
      }
      setLoading(false);
      return;
    }

    if (data.user) {
      // Upsert profile row in public.users, ignoring duplicate or RLS policy errors
      // (The DB trigger handle_new_user automatically creates the row via SECURITY DEFINER)
      const { error: insertError } = await (supabase.from("users") as any).upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        role,
      }, { onConflict: "id" });

      if (insertError) {
        // 23505 = unique violation, 42501 = RLS policy error — DB trigger already created the profile row safely
        console.warn("Client profile upsert notice (DB trigger handled creation):", insertError.message);
      }
    }

    // When email confirmation is required, signUp() succeeds but returns no
    // session — redirecting to /dashboard here would just bounce the user
    // straight back to /login with zero explanation.
    if (!data.session) {
      setLoading(false);
      setPendingConfirmation(true);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (pendingConfirmation) {
    return (
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400">
          <MailCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-white font-medium">Check your email</h3>
          <p className="text-slate-400 text-sm mt-1">
            We sent a confirmation link to <span className="text-slate-300">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <GoogleAuthButton label="Sign up with Google" />

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-slate-500">or continue with email</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
      {/* Full name */}
      <div className="space-y-1.5">
        <label htmlFor="signup-name" className="text-sm font-medium text-slate-300">
          Full name
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="signup-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Rajesh Kumar"
            required
            autoComplete="name"
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="signup-email" className="text-sm font-medium text-slate-300">
          Email address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="signup-email"
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

      {/* Password */}
      <div className="space-y-1.5">
        <label htmlFor="signup-password" className="text-sm font-medium text-slate-300">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Role — no admin option */}
      <div className="space-y-1.5">
        <label htmlFor="signup-role" className="text-sm font-medium text-slate-300">
          Role
        </label>
        <div className="relative">
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            id="signup-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Exclude<UserRole, "admin" | "contractor">)}
            className="w-full pl-4 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none cursor-pointer"
          >
            {SIGNUP_ROLES.map((r) => (
              <option key={r.value} value={r.value} className="bg-slate-800 text-white">
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-300">
          Admin access is granted by your organisation administrator.
        </p>
      </div>

      {/* Bot-protection challenge */}
      {TURNSTILE_SITE_KEY && (
        <div className="flex justify-center">
          <TurnstileWidget
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY}
            action="signup"
            onToken={(token) => {
              setTurnstileToken(token);
              setError(null);
            }}
            onExpire={() => setTurnstileToken(null)}
            onError={(code) => {
              setTurnstileToken(null);
              // errorCode's exact type isn't pinned down in Cloudflare's docs
              // (number vs numeric string) — coerce before comparing.
              setError(
                String(code) === "110200"
                  ? "Verification widget isn't authorized for this domain yet. Contact an admin to add it in the Cloudflare Turnstile dashboard."
                  : "Verification widget failed to load. Please refresh and try again."
              );
            }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        id="signup-submit"
        type="submit"
        disabled={loading || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-all shadow-lg shadow-indigo-500/20 mt-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Creating account…" : "Create account"}
      </button>
      </form>
    </div>
  );
}
