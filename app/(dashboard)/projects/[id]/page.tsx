import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/lib/queries/projects";
import { getProjectResources } from "@/lib/queries/resources";
import { getProjectDocuments } from "@/lib/queries/documents";
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

  const [data, resources, documents] = await Promise.all([
    getProjectById(supabase, id),
    getProjectResources(supabase, id),
    getProjectDocuments(supabase, id),
  ]);

  if (!data) {
    notFound();
  }

  return (
    <ProjectDetailView
      project={data.project}
      initialTasks={data.tasks}
      initialResources={resources}
      initialDocuments={documents}
      userId={user.id}
      userRole={userRole}
    />
  );
}
