import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center">
        <ShieldCheck className="w-7 h-7 text-rose-600 dark:text-rose-400" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Admin</h2>
      <p className="text-muted-foreground text-sm max-w-sm">
        User management, role promotion, and system settings are coming in a later phase.
      </p>
      <span className="text-xs font-medium px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900">
        Admin only · Coming soon
      </span>
    </div>
  );
}
