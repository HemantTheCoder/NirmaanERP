import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTenders } from "@/lib/queries/tenders";
import { TendersListView } from "@/components/tenders/TendersListView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Tenders & Bidding Portal | Nirmaan ERP",
  description: "Browse open subcontracts, submit contractor bids, and manage trade tender packages.",
};

export const dynamic = "force-dynamic";

export default async function TendersPage() {
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

  // Run parallel queries: tenders list + active projects
  const [tenders, { data: projectsData }] = await Promise.all([
    getTenders(supabase, user.id, role),
    (supabase.from("projects") as any).select("id, name").order("name"),
  ]);

  const projects = (projectsData || []) as { id: string; name: string }[];

  return (
    <TendersListView
      tenders={tenders}
      projects={projects}
      user={{
        id: user.id,
        role,
      }}
    />
  );
}
