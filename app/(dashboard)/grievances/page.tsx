import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGrievances } from "@/lib/queries/grievances";
import { GrievancesView } from "@/components/grievances/GrievancesView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Grievances & Issue Reporting",
  description: "Report and resolve site safety, equipment, and HR concerns.",
};

export const dynamic = "force-dynamic";

export default async function GrievancesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user role
  const { data: profile } = await (supabase.from("users") as any)
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = (profile?.role ?? "site_staff") as UserRole;
  const isManager = userRole === "admin" || userRole === "project_manager";

  // Fetch grievances and managers list for assignee dropdowns
  const [grievances, { data: managersData }] = await Promise.all([
    getGrievances(supabase, { userId: user.id, isManager }),
    (supabase.from("users") as any)
      .select("id, full_name, email")
      .in("role", ["admin", "project_manager"])
      .order("full_name"),
  ]);

  const managers = (managersData || []).map((m: any) => ({
    id: m.id,
    full_name: m.full_name,
    email: m.email,
  }));

  return (
    <GrievancesView
      initialGrievances={grievances}
      userId={user.id}
      userRole={userRole}
      managers={managers}
    />
  );
}
