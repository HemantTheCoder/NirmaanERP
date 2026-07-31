import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyTasks } from "@/lib/queries/tasks";
import { getProjects } from "@/lib/queries/projects";
import { getMyLeaves } from "@/lib/queries/leaves";
import { getTodayAttendance, getMyAttendance } from "@/lib/queries/attendance";
import { WorkspaceView } from "@/components/workspace/WorkspaceView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "My Workspace",
  description: "Personal task board, leave requests, attendance check-in, and profile management.",
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

  // Fetch caller's profile row
  const { data: profile } = await (supabase.from("users") as any)
    .select("id, email, full_name, role, phone, avatar_url")
    .eq("id", user.id)
    .single();

  const userProfile = {
    id: user.id,
    email: user.email || profile?.email || "",
    full_name: profile?.full_name || null,
    role: (profile?.role || "site_staff") as UserRole,
    phone: profile?.phone || null,
    avatar_url: profile?.avatar_url || null,
  };

  // Fetch my tasks, my leaves, projects list, today attendance, and attendance history
  const [tasks, leaves, projects, todayAttendance, attendanceHistory] = await Promise.all([
    getMyTasks(supabase, user.id),
    getMyLeaves(supabase, user.id),
    getProjects(supabase),
    getTodayAttendance(supabase, user.id),
    getMyAttendance(supabase, user.id, 30),
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
      user={userProfile}
      initialTodayAttendance={todayAttendance}
      initialAttendanceHistory={attendanceHistory}
    />
  );
}
