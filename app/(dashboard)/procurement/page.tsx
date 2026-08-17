import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPurchaseOrders, getVendors } from "@/lib/queries/procurement";
import { ProcurementView } from "@/components/procurement/ProcurementView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Procurement",
  description: "Manage vendors and purchase orders for project materials.",
};

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
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

  const [purchaseOrders, vendors, { data: projectsData }] = await Promise.all([
    getPurchaseOrders(supabase),
    getVendors(supabase),
    (supabase.from("projects") as any).select("id, name").order("name"),
  ]);

  const projects = (projectsData || []) as { id: string; name: string }[];

  return (
    <ProcurementView
      purchaseOrders={purchaseOrders}
      vendors={vendors}
      projects={projects}
      user={{ id: user.id, role }}
    />
  );
}
