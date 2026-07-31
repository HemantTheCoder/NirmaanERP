import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyTasks } from "@/lib/queries/tasks";
import { getProjects } from "@/lib/queries/projects";
import { getMyLeaves } from "@/lib/queries/leaves";
import { WorkspaceView } from "@/components/workspace/WorkspaceView";

export const metadata: Metadata = {
  title: "My Workspace",
  description: "Personal task board and leave request management.",
};

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch my tasks, my leaves, and projects list for modal dropdowns
  const [tasks, leaves, projects] = await Promise.all([
    getMyTasks(supabase, user.id),
    getMyLeaves(supabase, user.id),
    getProjects(supabase),
  ]);

  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <WorkspaceView
      initialTasks={tasks}
      initialLeaves={leaves}
      projects={projectOptions}
      userId={user.id}
    />
  );
}
