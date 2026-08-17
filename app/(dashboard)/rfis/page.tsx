import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRfis, getChangeOrders } from "@/lib/queries/rfis";
import { RfiChangeOrdersView } from "@/components/rfis/RfiChangeOrdersView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "RFIs & Change Orders",
  description: "Track requests for information and cost/schedule-impacting change orders.",
};

export const dynamic = "force-dynamic";

export default async function RfisPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await (supabase.from("users") as any)
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profileData?.role ?? "site_staff") as UserRole;

  const [rfis, changeOrders, { data: projectsData }, { data: teamData }] = await Promise.all([
    getRfis(supabase),
    getChangeOrders(supabase),
    (supabase.from("projects") as any).select("id, name").order("name"),
    (supabase.from("users") as any)
      .select("id, full_name")
      .in("role", ["admin", "project_manager", "site_staff"])
      .order("full_name"),
  ]);

  const projects = (projectsData || []) as { id: string; name: string }[];
  const teamMembers = (teamData || []) as { id: string; full_name: string }[];

  return (
    <RfiChangeOrdersView
      rfis={rfis}
      changeOrders={changeOrders}
      projects={projects}
      teamMembers={teamMembers}
      user={{ id: user.id, role }}
    />
  );
}
