import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProjects, getProjectManagers, getClientOptions } from "@/lib/queries/projects";
import { ProjectsView } from "@/components/projects/ProjectsView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Projects",
  description: "Manage construction projects, milestone targets, and site assignments.",
};

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user role
  let userRole: UserRole = "site_staff";
  if (user) {
    const { data: profileData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    const profile = profileData as { role: UserRole } | null;
    if (profile?.role) {
      userRole = profile.role;
    }
  }

  // Fetch projects, project managers, and client options in parallel
  const [projects, managers, clients] = await Promise.all([
    getProjects(supabase),
    getProjectManagers(supabase),
    getClientOptions(supabase),
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Projects</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage and track all construction sites and developments.
        </p>
      </div>

      <ProjectsView
        initialProjects={projects}
        managers={managers}
        clients={clients}
        userRole={userRole}
      />
    </div>
  );
}
