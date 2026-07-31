import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafetyIncidents } from "@/lib/queries/safety";
import { SafetyIncidentsView } from "@/components/safety/SafetyIncidentsView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Safety Incident & Near-Miss Reporting",
  description: "Report site safety hazards, near-miss events, and emergency incidents.",
};

export const dynamic = "force-dynamic";

export default async function SafetyIncidentsPage() {
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

  // Fetch safety incidents, projects, and managers list
  const [incidents, { data: projectsData }, { data: managersData }] = await Promise.all([
    getSafetyIncidents(supabase, { userId: user.id, isManager }),
    (supabase.from("projects") as any).select("id, name").order("name"),
    (supabase.from("users") as any)
      .select("id, full_name, email")
      .in("role", ["admin", "project_manager"])
      .order("full_name"),
  ]);

  const projects = (projectsData || []).map((p: any) => ({ id: p.id, name: p.name }));
  const managers = (managersData || []).map((m: any) => ({
    id: m.id,
    full_name: m.full_name,
    email: m.email,
  }));

  return (
    <SafetyIncidentsView
      initialIncidents={incidents}
      userId={user.id}
      userRole={userRole}
      projects={projects}
      managers={managers}
    />
  );
}
