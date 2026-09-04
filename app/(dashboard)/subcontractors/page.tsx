import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSubcontracts, getVendorTrustScores } from "@/lib/queries/subcontractors";
import { getVendors } from "@/lib/queries/procurement";
import { SubcontractorsView } from "@/components/subcontractors/SubcontractorsView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Subcontractors",
  description: "Manage subcontracts, scope of work, and vendor performance ratings.",
};

export const dynamic = "force-dynamic";

export default async function SubcontractorsPage() {
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

  const [subcontracts, vendors, vendorTrust, { data: projectsData }] = await Promise.all([
    getSubcontracts(supabase),
    getVendors(supabase),
    getVendorTrustScores(supabase),
    (supabase.from("projects") as any).select("id, name").order("name"),
  ]);

  const projects = (projectsData || []) as { id: string; name: string }[];

  return (
    <SubcontractorsView
      subcontracts={subcontracts}
      vendors={vendors}
      vendorTrust={vendorTrust}
      projects={projects}
      user={{ id: user.id, role }}
    />
  );
}
