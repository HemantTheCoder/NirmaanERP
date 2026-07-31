"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  UserPlus,
  Trash2,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  UserCheck,
  UserX,
  X,
  Copy,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  updateUserRole,
  toggleUserActive,
  checkUserOrphanStatus,
  type AdminUserItem,
  type UserOrphanCheckResult,
} from "@/lib/queries/admin";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface UsersTabProps {
  initialUsers: AdminUserItem[];
  currentUserId: string;
  onRefreshNeeded: () => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string; bg: string; text: string }[] = [
  { value: "admin",           label: "Admin",           bg: "bg-rose-100 dark:bg-rose-950/60",     text: "text-rose-800 dark:text-rose-300" },
  { value: "project_manager", label: "Project Manager", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  { value: "site_staff",      label: "Site Staff",      bg: "bg-emerald-100 dark:bg-emerald-950/60",text: "text-emerald-800 dark:text-emerald-300" },
  { value: "client",          label: "Client",          bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
];

export function UsersTab({ initialUsers, currentUserId, onRefreshNeeded }: UsersTabProps) {
  const supabase = createClient();

  const [users, setUsers] = useState<AdminUserItem[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("site_staff");
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string; tempPassword?: string } | null>(null);

  // Delete Confirmation & Orphan Modal State
  const [userToDelete, setUserToDelete] = useState<AdminUserItem | null>(null);
  const [orphanResult, setOrphanResult] = useState<UserOrphanCheckResult | null>(null);
  const [isCheckingOrphan, setIsCheckingOrphan] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // ── Filtered Users ─────────────────────────────────────────────────────────

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.full_name ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && u.is_active) ||
      (statusFilter === "inactive" && !u.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleRoleChange = async (targetUser: AdminUserItem, newRole: UserRole) => {
    if (targetUser.role === newRole) return;
    setErrorMsg(null);
    setActionLoadingId(targetUser.id);

    const res = await updateUserRole(supabase, targetUser.id, newRole);
    setActionLoadingId(null);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to update role");
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
      );
      onRefreshNeeded();
    }
  };

  const handleToggleActive = async (targetUser: AdminUserItem) => {
    setErrorMsg(null);
    setActionLoadingId(targetUser.id);

    const res = await toggleUserActive(supabase, targetUser.id, !targetUser.is_active);
    setActionLoadingId(null);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to toggle active status");
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: !u.is_active } : u))
      );
      onRefreshNeeded();
    }
  };

  const handleInitiateDelete = async (targetUser: AdminUserItem) => {
    setErrorMsg(null);
    setUserToDelete(targetUser);
    setIsCheckingOrphan(true);

    const result = await checkUserOrphanStatus(supabase, targetUser.id);
    setOrphanResult(result);
    setIsCheckingOrphan(false);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userToDelete.id }),
      });

      const data = await res.json();
      setIsDeleting(false);

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to delete user");
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
        setUserToDelete(null);
        setOrphanResult(null);
        onRefreshNeeded();
      }
    } catch (err: any) {
      setIsDeleting(false);
      setErrorMsg(err.message || "Error deleting user");
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsSubmittingInvite(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          full_name: inviteName,
          role: inviteRole,
        }),
      });

      const data = await res.json();
      setIsSubmittingInvite(false);

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to invite user");
      } else {
        setInviteResult({
          email: data.user.email,
          tempPassword: data.user.tempPassword,
        });
        onRefreshNeeded();
      }
    } catch (err: any) {
      setIsSubmittingInvite(false);
      setErrorMsg(err.message || "Error sending invite");
    }
  };

  const resetInviteForm = () => {
    setShowInviteModal(false);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("site_staff");
    setInviteResult(null);
    setCopiedPassword(false);
  };

  return (
    <div className="space-y-6">
      {/* Global Error Banner */}
      {errorMsg && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Role filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        {/* Invite User Button */}
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Invite User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Joined</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground">
                    No users match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleCfg = ROLE_OPTIONS.find((r) => r.value === u.role) ?? ROLE_OPTIONS[2];
                  const initials = (u.full_name || u.email)
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const isCurrent = u.id === currentUserId;

                  return (
                    <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                      {/* User Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
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

                      {/* Role Dropdown */}
                      <td className="px-5 py-3.5">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                          disabled={actionLoadingId === u.id}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold rounded-md border border-transparent focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer transition-all",
                            roleCfg.bg,
                            roleCfg.text
                          )}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value} className="bg-card text-foreground font-normal">
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold",
                            u.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                          )}
                        >
                          {u.is_active ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-500" /> Inactive
                            </>
                          )}
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

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Toggle Active Button */}
                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={actionLoadingId === u.id}
                            className={cn(
                              "p-1.5 rounded-lg border text-xs font-medium transition-all",
                              u.is_active
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                            )}
                            title={u.is_active ? "Deactivate User" : "Reactivate User"}
                          >
                            {actionLoadingId === u.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : u.is_active ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleInitiateDelete(u)}
                            disabled={actionLoadingId === u.id}
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-all"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Invite User Modal ────────────────────────────────────────────────── */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && resetInviteForm()}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <UserPlus className="w-4.5 h-4.5 text-primary" />
                Invite New User
              </h3>
              <button onClick={resetInviteForm} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {inviteResult ? (
                /* Success Notification screen */
                <div className="space-y-4 text-center py-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-foreground">User Account Created!</h4>
                  <p className="text-xs text-muted-foreground">
                    Account for <span className="font-semibold text-foreground">{inviteResult.email}</span> has been provisioned and activated.
                  </p>

                  {inviteResult.tempPassword && (
                    <div className="p-3 bg-secondary rounded-lg border border-border text-left">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Temporary Password:
                      </p>
                      <div className="flex items-center justify-between bg-background p-2 rounded border border-border">
                        <code className="text-xs font-mono text-foreground font-bold">{inviteResult.tempPassword}</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(inviteResult.tempPassword || "");
                            setCopiedPassword(true);
                            setTimeout(() => setCopiedPassword(false), 2000);
                          }}
                          className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                        >
                          {copiedPassword ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedPassword ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={resetInviteForm}
                    className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all mt-2"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Form */
                <form onSubmit={handleInviteSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ananya Sharma"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="user@nirmaan.dev"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">System Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={resetInviteForm}
                      className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingInvite}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all"
                    >
                      {isSubmittingInvite && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Create & Provision User
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete User Confirmation & Orphan Alert Modal ───────────────────── */}
      {userToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setUserToDelete(null)}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
                <Trash2 className="w-4.5 h-4.5" />
                Delete User Account
              </h3>
              <button onClick={() => setUserToDelete(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {isCheckingOrphan ? (
                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Verifying orphan references across 7 database tables…
                </div>
              ) : orphanResult && !orphanResult.canDelete ? (
                /* Blocked Deletion Screen */
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      Deletion Blocked: Active References Found
                    </div>
                    <p>
                      Cannot delete <span className="font-semibold text-foreground">{userToDelete.email}</span> because they have active relational dependencies:
                    </p>
                    <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] font-medium text-amber-950 dark:text-amber-200">
                      {orphanResult.reasons.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    To prevent orphaned foreign key references, please reassign or delete these records, or use <span className="font-semibold text-foreground">Deactivate User</span> instead.
                  </p>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setUserToDelete(null)}
                      className="px-4 py-2 text-xs font-semibold bg-secondary text-foreground rounded-lg hover:bg-secondary/80"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                /* Allowed Deletion Confirmation */
                <div className="space-y-4">
                  <p className="text-xs text-foreground">
                    Are you sure you want to permanently delete <span className="font-bold">{userToDelete.full_name || userToDelete.email}</span>?
                  </p>

                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300">
                    <p className="font-semibold mb-0.5">Warning:</p>
                    This will permanently remove both the user profile and underlying authentication account. This action cannot be undone.
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setUserToDelete(null)}
                      className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmDelete}
                      disabled={isDeleting}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all"
                    >
                      {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Permanently Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
