import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/queries/profile";
import { ContactCard } from "@/components/profile/ContactCard";

interface ProfilePageProps {
  params: Promise<{ userId: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { userId } = await params;
  const supabase = await createClient();
  const profile = await getUserProfile(supabase, userId);
  return {
    title: profile?.full_name || "Contact",
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { userId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getUserProfile(supabase, userId);

  if (!profile) {
    notFound();
  }

  return <ContactCard profile={profile} isOwnProfile={user.id === userId} />;
}
