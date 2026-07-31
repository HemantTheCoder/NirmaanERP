import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMeetings } from "@/lib/queries/meetings";
import { getProjects } from "@/lib/queries/projects";
import { CalendarView } from "@/components/schedule/CalendarView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Schedule",
  description: "Manage meetings, site visits, and team calendar.",
};

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all data in parallel: meetings (RLS-filtered), projects, users, and the
  // current user's role — all needed to render the calendar and its modals.
  const [meetings, projects, usersResult, profileResult] = await Promise.all([
    getMeetings(supabase),
    getProjects(supabase),
    supabase
      .from("users")
      .select("id, full_name, email")
      .order("full_name", { ascending: true }),
    supabase.from("users").select("role").eq("id", user.id).single(),
  ]);

  const allUsers = (usersResult.data || []) as {
    id: string;
    full_name: string | null;
    email: string;
  }[];

  const userRole: UserRole =
    ((profileResult.data as any)?.role as UserRole) ?? "site_staff";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Schedule</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage meetings, site visits, and team calendar.
        </p>
      </div>

      <CalendarView
        initialMeetings={meetings}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        users={allUsers}
        currentUserId={user.id}
        currentUserRole={userRole}
      />
    </div>
  );
}
