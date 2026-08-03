"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail, Lock, User, ChevronDown, Eye, EyeOff } from "lucide-react";
import type { UserRole } from "@/types/database";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });

    if (signupError) {
      if (signupError.message.toLowerCase().includes("rate limit") || signupError.status === 429) {
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

    router.push("/dashboard");
    router.refresh();
  }

  return (
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
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-all shadow-lg shadow-indigo-500/20 mt-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
