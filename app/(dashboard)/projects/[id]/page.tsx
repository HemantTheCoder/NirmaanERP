import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectById, getProjectManagers } from "@/lib/queries/projects";
import { getProjectResources } from "@/lib/queries/resources";
import { getProjectDocuments } from "@/lib/queries/documents";
import { getProjectBudgetSummary } from "@/lib/queries/finance";
import { getProjectPunchItems } from "@/lib/queries/punch_list";
import { getTodayDpr, getProjectDprHistory } from "@/lib/queries/dpr";
import { getOpenDelay, getDelayHistory } from "@/lib/queries/delays";
import { getProjectTaskDependencies } from "@/lib/queries/taskDependencies";
import { ProjectDetailView } from "@/components/projects/ProjectDetailView";
import type { UserRole } from "@/types/database";

export const dynamic = "force-dynamic";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ProjectDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const res = await getProjectById(supabase, id);
  return {
    title: res ? res.project.name : "Project Details",
  };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params;
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

  const userRole = (profile?.role ?? "site_staff") as UserRole;

  const data = await getProjectById(supabase, id);

  if (!data) {
    notFound();
  }

  const [
    resources,
    documents,
    budgetSummary,
    punchItems,
    todayDpr,
    dprHistory,
    teamMembers,
    openDelay,
    delayHistory,
    dependencies,
  ] = await Promise.all([
    getProjectResources(supabase, id),
    getProjectDocuments(supabase, id),
    getProjectBudgetSummary(supabase, id, user.id, userRole),
    getProjectPunchItems(supabase, id),
    getTodayDpr(supabase, id),
    getProjectDprHistory(supabase, id),
    getProjectManagers(supabase),
    getOpenDelay(supabase, id),
    getDelayHistory(supabase, id),
    getProjectTaskDependencies(supabase, data.tasks.map((t: any) => t.id)),
  ]);

  return (
    <ProjectDetailView
      project={data.project}
      initialTasks={data.tasks}
      initialResources={resources}
      initialDocuments={documents}
      initialBudgetSummary={budgetSummary}
      initialPunchItems={punchItems}
      initialTodayDpr={todayDpr}
      initialDprHistory={dprHistory}
      initialOpenDelay={openDelay}
      initialDelayHistory={delayHistory}
      initialDependencies={dependencies}
      teamMembers={teamMembers}
      userId={user.id}
      userRole={userRole}
    />
  );
}
