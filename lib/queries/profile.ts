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
  email: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
}

/**
 * Basic contact info for any user — used by the read-only profile/contact
 * card. Deliberately selects only what's meant to be visible to other
 * dashboard users (name, role, email, phone, avatar); users_select_all RLS
 * technically allows reading every column, but this keeps the query itself
 * scoped to what the UI is meant to show.
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

  return data as UserContactProfile | null;
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
