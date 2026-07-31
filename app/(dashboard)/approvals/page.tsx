import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllPendingLeaves, getAllLeaveHistory } from "@/lib/queries/leaves";
import { ApprovalsView } from "@/components/approvals/ApprovalsView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Approvals Queue",
  description: "Review and action employee leave requests across projects.",
};

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
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

  const role = (profile?.role ?? "site_staff") as UserRole;

  // Strict Access Control: Admin or Project Manager only
  if (role !== "admin" && role !== "project_manager") {
    redirect("/dashboard");
  }

  const [pending, history] = await Promise.all([
    getAllPendingLeaves(supabase),
    getAllLeaveHistory(supabase),
  ]);

  return (
    <ApprovalsView
      initialPending={pending}
      initialHistory={history}
      currentUserId={user.id}
    />
  );
}
