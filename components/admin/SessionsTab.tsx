"use client";

import { useState } from "react";
import { LogOut, Info, Loader2, CheckCircle2 } from "lucide-react";
import type { AdminUserItem } from "@/lib/queries/admin";
import { cn } from "@/lib/utils";

interface SessionsTabProps {
  users: AdminUserItem[];
  currentUserId: string;
}

export function SessionsTab({ users, currentUserId }: SessionsTabProps) {
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [signedOutUserIds, setSignedOutUserIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleForceSignOut = async (targetUser: AdminUserItem) => {
    setLoadingUserId(targetUser.id);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/users/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetUser.id }),
      });

      const data = await res.json();
      setLoadingUserId(null);

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to force sign-out user");
      } else {
        setSignedOutUserIds((prev) => [...prev, targetUser.id]);
      }
    } catch (err: any) {
      setLoadingUserId(null);
      setErrorMsg(err.message || "Error signing out user");
    }
  };

  return (
    <div className="space-y-6">
      {/* Informational Banner */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Session & Activity Oversight</p>
          <p className="mt-0.5 text-amber-800 dark:text-amber-300">
            Force sign-out invalidates the user&apos;s refresh tokens globally across all devices. Live access tokens will terminate upon next session refresh or page navigation.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Account Provisioned</th>
                <th className="px-5 py-3.5 text-right">Force Sign-Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const initials = (u.full_name || u.email)
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const isCurrent = u.id === currentUserId;
                const isSignedOut = signedOutUserIds.includes(u.id);

                return (
                  <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                    {/* User */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 font-bold flex items-center justify-center text-xs shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground leading-tight flex items-center gap-1.5">
                            {u.full_name || "Unnamed User"}
                            {isCurrent && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-normal">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5 capitalize font-medium text-foreground">
                      {u.role.replace("_", " ")}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded text-[11px] font-semibold capitalize",
                          u.is_active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        )}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Joined Date */}
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Force Sign-Out Action */}
                    <td className="px-5 py-3.5 text-right">
                      {isSignedOut ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sessions Revoked
                        </span>
                      ) : (
                        <button
                          onClick={() => handleForceSignOut(u)}
                          disabled={loadingUserId === u.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-all"
                        >
                          {loadingUserId === u.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <LogOut className="w-3.5 h-3.5" />
                          )}
                          Force Sign-Out
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
