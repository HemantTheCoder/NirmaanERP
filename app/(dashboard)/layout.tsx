import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the user's profile (role, name)
  const { data: profileData } = await supabase
    .from("users")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  const profile = profileData as {
    full_name: string | null;
    role: import("@/types/database").UserRole;
    avatar_url: string | null;
  } | null;

  return (
    <AppShell
      user={{
        id: user.id,
        email: user.email ?? "",
        full_name: profile?.full_name ?? user.email ?? "User",
        role: profile?.role ?? "site_staff",
        avatar_url: profile?.avatar_url ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
