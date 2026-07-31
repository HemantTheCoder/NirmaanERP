"use client";

import { useState, useCallback } from "react";
import { ShieldCheck, Users, Lock, Activity } from "lucide-react";
import { UsersTab } from "@/components/admin/UsersTab";
import { RolesTab } from "@/components/admin/RolesTab";
import { SessionsTab } from "@/components/admin/SessionsTab";
import { createClient } from "@/lib/supabase/client";
import { getAllAdminUsers, type AdminUserItem } from "@/lib/queries/admin";
import { cn } from "@/lib/utils";

interface AdminViewProps {
  initialUsers: AdminUserItem[];
  currentUserId: string;
}

export function AdminView({ initialUsers, currentUserId }: AdminViewProps) {
  const supabase = createClient();
  const [users, setUsers] = useState<AdminUserItem[]>(initialUsers);
  const [activeTab, setActiveTab] = useState<"users" | "roles" | "sessions">("users");

  const refreshUsers = useCallback(async () => {
    const updated = await getAllAdminUsers(supabase);
    setUsers(updated);
  }, [supabase]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          Admin Console
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          User provisioning, role assignment, system access rules, and session oversight.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab("users")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all",
            activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="w-4 h-4" />
          Users Management
          <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("roles")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all",
            activeTab === "roles"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Lock className="w-4 h-4" />
          Roles & Access Matrix
        </button>

        <button
          onClick={() => setActiveTab("sessions")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all",
            activeTab === "sessions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Activity className="w-4 h-4" />
          Sessions & Activity
        </button>
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === "users" && (
          <UsersTab
            initialUsers={users}
            currentUserId={currentUserId}
            onRefreshNeeded={refreshUsers}
          />
        )}
        {activeTab === "roles" && <RolesTab />}
        {activeTab === "sessions" && (
          <SessionsTab users={users} currentUserId={currentUserId} />
        )}
      </div>
    </div>
  );
}
