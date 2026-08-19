"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface GoogleAuthButtonProps {
  label: string;
}

export function GoogleAuthButton({ label }: GoogleAuthButtonProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    // On success the browser is already navigating to Google — nothing left
    // to update here. Only an immediate rejection (bad config, network) lands.
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed text-slate-800 font-medium rounded-lg text-sm transition-all shadow-sm border border-white/10"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.8Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-3.02c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A11.998 11.998 0 0 0 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.75l4-3.11Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.63l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
          />
        </svg>
        {loading ? "Redirecting…" : label}
      </button>
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
