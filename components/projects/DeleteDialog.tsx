"use client";

import { Loader2, AlertTriangle } from "lucide-react";

interface DeleteDialogProps {
  isOpen: boolean;
  projectName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteDialog({
  isOpen,
  projectName,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base">
              Delete Project
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Are you sure you want to delete{" "}
              <span className="font-bold text-foreground">&quot;{projectName}&quot;</span>?
              This action cannot be undone and will delete all associated tasks.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
}
