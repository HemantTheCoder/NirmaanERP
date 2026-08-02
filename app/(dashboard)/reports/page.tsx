import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReportsData } from "@/lib/queries/reports";
import { getCompanyBudgetAnalytics } from "@/lib/queries/finance";
import { ReportsView } from "@/components/reports/ReportsView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Reports & Analytics",
  description: "Analytics dashboards, task completion trends, budget utilization, and team workload.",
};

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile role for access control
  const { data: profileData } = await (supabase
    .from("users") as any)
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: UserRole } | null;
  const role = (profile?.role ?? "site_staff") as UserRole;

  // Access Control: Reports page is visible to admin and project_manager only
  if (role !== "admin" && role !== "project_manager") {
    redirect("/dashboard");
  }

  const [reportsData, budgetAnalytics] = await Promise.all([
    getReportsData(supabase),
    getCompanyBudgetAnalytics(supabase),
  ]);

  return <ReportsView initialData={reportsData} budgetAnalytics={budgetAnalytics} />;
}
