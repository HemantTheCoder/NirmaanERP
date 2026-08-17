import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInventoryItems, getEquipmentAssets } from "@/lib/queries/inventory";
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

  const [items, equipment, { data: projectsData }] = await Promise.all([
    getInventoryItems(supabase),
    getEquipmentAssets(supabase),
    (supabase.from("projects") as any).select("id, name").order("name"),
  ]);

  const projects = (projectsData || []) as { id: string; name: string }[];

  return (
    <InventoryView
      items={items}
      equipment={equipment}
      projects={projects}
      user={{ id: user.id, role }}
    />
  );
}
