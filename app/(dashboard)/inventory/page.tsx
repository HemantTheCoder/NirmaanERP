import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInventoryItems, getEquipmentAssets, getInventoryTransactionsSince, getEquipmentStatusHistory } from "@/lib/queries/inventory";
import { computeReorderSuggestions } from "@/lib/utils/reorderSuggestions";
import { computeEquipmentUtilization } from "@/lib/utils/equipmentUtilization";
import { InventoryView } from "@/components/inventory/InventoryView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Inventory & Equipment",
  description: "Track material stock levels and equipment allocation across projects.",
};

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceDate = thirtyDaysAgo.toISOString().slice(0, 10);

  const [items, equipment, recentTransactions, statusHistory, { data: projectsData }] = await Promise.all([
    getInventoryItems(supabase),
    getEquipmentAssets(supabase),
    getInventoryTransactionsSince(supabase, sinceDate),
    getEquipmentStatusHistory(supabase),
    (supabase.from("projects") as any).select("id, name").order("name"),
  ]);

  const projects = (projectsData || []) as { id: string; name: string }[];
  // Server -> Client component props must be plain JSON, so the Maps from
  // these pure computations get flattened to Records here.
  const reorderSuggestions = Object.fromEntries(computeReorderSuggestions(items, recentTransactions));
  const equipmentUtilization = Object.fromEntries(computeEquipmentUtilization(statusHistory));

  return (
    <InventoryView
      items={items}
      equipment={equipment}
      reorderSuggestions={reorderSuggestions}
      equipmentUtilization={equipmentUtilization}
      projects={projects}
      user={{ id: user.id, role }}
    />
  );
}
