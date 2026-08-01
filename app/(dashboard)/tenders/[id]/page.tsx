import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getTenderById } from "@/lib/queries/tenders";
import { TenderDetailView } from "@/components/tenders/TenderDetailView";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Tender Package Details | Nirmaan ERP",
  description: "View scope of work, eligibility criteria, drawings, and contractor bidding details.",
};

export const dynamic = "force-dynamic";

interface TenderDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TenderDetailPage({ params }: TenderDetailPageProps) {
  const resolvedParams = await params;
  const tenderId = resolvedParams.id;

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

  const { tender, documents, bids } = await getTenderById(
    supabase,
    tenderId,
    user.id,
    role
  );

  if (!tender) {
    notFound();
  }

  return (
    <TenderDetailView
      tender={tender}
      documents={documents}
      bids={bids}
      user={{
        id: user.id,
        role,
      }}
    />
  );
}
