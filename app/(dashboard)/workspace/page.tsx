import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyTasks } from "@/lib/queries/tasks";
import { getProjects } from "@/lib/queries/projects";
import { KanbanBoard } from "@/components/workspace/KanbanBoard";

export const metadata: Metadata = {
  title: "My Workspace",
  description: "Personal task board and work item management.",
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

  // Fetch my tasks & all projects for dropdown
  const [tasks, projects] = await Promise.all([
    getMyTasks(supabase, user.id),
    getProjects(supabase),
  ]);

  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-foreground">My Workspace</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Your personal task board. Drag and drop work items to update progress.
        </p>
      </div>

      <KanbanBoard
        initialTasks={tasks}
        projects={projectOptions}
        userId={user.id}
      />
    </div>
  );
}
