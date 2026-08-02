"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, FileCheck, Loader2, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignatureConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (typedName: string) => Promise<void>;
  actionTitle: string;
  summaryText: string;
  signerFullName: string;
  confirmButtonText?: string;
}

export function SignatureConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  actionTitle,
  summaryText,
  signerFullName,
  confirmButtonText = "Confirm & Digitally Sign",
}: SignatureConfirmModalProps) {
  const [typedName, setTypedName] = useState("");
  const [isConfirmedChecked, setIsConfirmedChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setTypedName("");
      setIsConfirmedChecked(false);
      setIsSubmitting(false);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const normalizedExpected = signerFullName.trim().toLowerCase();
  const normalizedTyped = typedName.trim().toLowerCase();
  const isNameMatched = normalizedTyped.length > 0 && normalizedTyped === normalizedExpected;
  const canSubmit = isNameMatched && isConfirmedChecked && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await onConfirm(typedName.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to complete signature confirmation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">{actionTitle}</h3>
              <p className="text-[11px] text-muted-foreground">Digital Signature & Intent Acknowledgment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Summary Card */}
          <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Action Summary Scope:
            </span>
            <p className="text-xs text-foreground font-medium leading-relaxed">
              {summaryText}
            </p>
          </div>

          {/* Identity Verification Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Type your full name to verify identity:
            </label>
            <div className="relative">
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={signerFullName}
                className={cn(
                  "w-full px-3.5 py-2.5 text-xs bg-background border rounded-xl text-foreground focus:outline-none focus:ring-2 font-medium transition-all",
                  typedName.length > 0
                    ? isNameMatched
                      ? "border-emerald-500 ring-emerald-500/20 focus:ring-emerald-500"
                      : "border-rose-400 ring-rose-400/20 focus:ring-rose-500"
                    : "border-border focus:ring-primary"
                )}
              />
              {isNameMatched && (
                <FileCheck className="w-4 h-4 text-emerald-500 absolute right-3 top-3 pointer-events-none" />
              )}
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                Required profile match: <strong className="text-foreground">{signerFullName}</strong>
              </span>
              {typedName.length > 0 && !isNameMatched && (
                <span className="text-rose-500 font-medium">Name does not match profile</span>
              )}
            </div>
          </div>

          {/* Acknowledgment Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/30 border border-border cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isConfirmedChecked}
              onChange={(e) => setIsConfirmedChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-muted-foreground leading-snug">
              I confirm this action and understand it is recorded as an immutable digital signature with a timestamp in the Nirmaan ERP audit trail.
            </span>
          </label>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all shadow-sm",
                canSubmit
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20"
                  : "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              {confirmButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
