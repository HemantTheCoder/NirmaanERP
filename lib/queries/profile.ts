import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { UserRole } from "@/types/database";

export interface UpdateProfilePayload {
  full_name: string;
  phone?: string | null;
}

export interface UserContactProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  /** True when email/phone were withheld because the viewer isn't the owner or an admin/PM. */
  contactHidden: boolean;
}

/**
 * Basic contact info for any user — used by the read-only profile/contact
 * card. users_select_all RLS permits reading every column of any row, so the
 * viewer-awareness below (not RLS) is what keeps phone/email private: the
 * full row is only ever returned to the user themselves or to admin/PM, who
 * need it for assignment and contact lookup. Everyone else gets the row with
 * phone/email withheld (contactHidden: true) — same name/role/avatar visible
 * to all, per public.users_public.
 */
export async function getUserProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserContactProfile | null> {
  const { data, error } = await (supabase.from("users") as any)
    .select("id, full_name, email, role, phone, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user profile:", error);
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  if (!data) return null;

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  let canSeeContact = false;
  if (viewer) {
    if (viewer.id === userId) {
      canSeeContact = true;
    } else {
      const { data: viewerRow } = await (supabase.from("users") as any)
        .select("role")
        .eq("id", viewer.id)
        .maybeSingle();
      canSeeContact = viewerRow?.role === "admin" || viewerRow?.role === "project_manager";
    }
  }

  if (canSeeContact) {
    return { ...(data as UserContactProfile), contactHidden: false };
  }

  return { ...(data as UserContactProfile), email: null, phone: null, contactHidden: true };
}

/**
 * Update current user's profile (name & phone)
 */
export async function updateOwnProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: UpdateProfilePayload
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from("users") as any)
    .update({
      full_name: data.full_name.trim(),
      phone: data.phone ? data.phone.trim() : null,
    })
    .eq("id", userId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Upload profile avatar image to public 'avatars' bucket and update user record
 */
export async function uploadAvatar(
  supabase: SupabaseClient<Database>,
  userId: string,
  file: File
): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filePath = `${userId}/avatar_${Date.now()}.${ext}`;

  // 1. Upload to storage bucket 'avatars'
  const { error: storageErr } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (storageErr) {
    return { success: false, error: "Avatar upload failed: " + storageErr.message };
  }

  // 2. Get Public URL
  const { data: urlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  const avatarUrl = urlData.publicUrl;

  // 3. Update public.users avatar_url
  const { error: dbErr } = await (supabase.from("users") as any)
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);

  if (dbErr) {
    return { success: false, error: "Failed to update user profile picture link: " + dbErr.message };
  }

  return { success: true, avatarUrl };
}
