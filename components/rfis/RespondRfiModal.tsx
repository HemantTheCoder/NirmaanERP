"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { respondToRfi } from "@/lib/queries/rfis";

interface RespondRfiModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfiId: string;
  subject: string;
  onResponded: () => void;
}

export function RespondRfiModal({ isOpen, onClose, rfiId, subject, onResponded }: RespondRfiModalProps) {
  const supabase = createClient();
  const [response, setResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetAndClose() {
    setResponse("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { error: respondError } = await respondToRfi(supabase, rfiId, response);

    if (respondError) {
      setError(respondError.message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onResponded();
    resetAndClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Respond to RFI</h2>
          <button onClick={resetAndClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">{subject}</p>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Response</label>
            <textarea
              required
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={5}
              placeholder="Provide the requested clarification..."
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {error && (
            <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white transition-colors"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Response
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
