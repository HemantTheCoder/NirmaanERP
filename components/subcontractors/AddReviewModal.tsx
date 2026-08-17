"use client";

import { useState } from "react";
import { X, Loader2, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPerformanceReview } from "@/lib/queries/subcontractors";
import { cn } from "@/lib/utils";

interface AddReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  subcontractId: string;
  vendorId: string;
  projectId: string;
  vendorName: string;
  onCreated: () => void;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="text-amber-400 hover:scale-110 transition-transform"
        >
          <Star className={cn("w-5 h-5", n <= value ? "fill-current" : "fill-none")} />
        </button>
      ))}
    </div>
  );
}

export function AddReviewModal({
  isOpen,
  onClose,
  userId,
  subcontractId,
  vendorId,
  projectId,
  vendorName,
  onCreated,
}: AddReviewModalProps) {
  const supabase = createClient();
  const [quality, setQuality] = useState(4);
  const [timeliness, setTimeliness] = useState(4);
  const [safety, setSafety] = useState(4);
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetAndClose() {
    setQuality(4);
    setTimeliness(4);
    setSafety(4);
    setComments("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { error: createError } = await createPerformanceReview(supabase, {
      subcontract_id: subcontractId,
      vendor_id: vendorId,
      project_id: projectId,
      quality_rating: quality,
      timeliness_rating: timeliness,
      safety_rating: safety,
      comments: comments || undefined,
      reviewed_by: userId,
    });

    if (createError) {
      setError(createError.message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onCreated();
    resetAndClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Rate {vendorName}</h2>
          <button onClick={resetAndClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Quality of work</label>
            <StarRating value={quality} onChange={setQuality} />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Timeliness</label>
            <StarRating value={timeliness} onChange={setTimeliness} />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Safety compliance</label>
            <StarRating value={safety} onChange={setSafety} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Comments (optional)</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
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
              Submit Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
