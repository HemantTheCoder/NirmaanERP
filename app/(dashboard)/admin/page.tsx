import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllAdminUsers, getAdminOverviewData } from "@/lib/queries/admin";
import { getAuditLogs } from "@/lib/queries/audit";
import { getKpiSnapshots } from "@/lib/queries/kpis";
import { AdminView } from "@/components/admin/AdminView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Admin Console",
  description: "User management, role assignment, system access rules, and session oversight.",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch caller's profile role
  const { data: profile } = await (supabase.from("users") as any)
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role ?? "site_staff") as UserRole;

  // Strict Access Control: Admin role only
  if (role !== "admin") {
    redirect("/dashboard");
  }

  const [initialUsers, overviewData, auditLogs, kpiSnapshots] = await Promise.all([
    getAllAdminUsers(supabase),
    getAdminOverviewData(supabase),
    getAuditLogs(supabase, 10),
    getKpiSnapshots(supabase, 7),
  ]);

  return (
    <AdminView
      initialUsers={initialUsers}
      overviewData={overviewData}
      auditLogs={auditLogs}
      kpiSnapshots={kpiSnapshots}
      currentUserId={user.id}
    />
  );
}
