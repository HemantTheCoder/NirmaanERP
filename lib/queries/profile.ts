import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface UpdateProfilePayload {
  full_name: string;
  phone?: string | null;
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
