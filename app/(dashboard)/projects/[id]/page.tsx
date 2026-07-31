import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/lib/queries/projects";
import { ProjectDetailView } from "@/components/projects/ProjectDetailView";

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

  const data = await getProjectById(supabase, id);
  if (!data) {
    notFound();
  }

  return (
    <ProjectDetailView
      project={data.project}
      initialTasks={data.tasks}
    />
  );
}
