import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type NotificationType =
  | "task_assigned"
  | "meeting_invite"
  | "status_change"
  | "approval_needed";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  message: string;
  link: string;
  read: boolean;
  created_at: string;
}

/**
 * Fetch latest 30 notifications for a user, newest-first.
 */
export async function getNotifications(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AppNotification[]> {
  const { data, error } = await (supabase.from("notifications") as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }

  return (data || []) as AppNotification[];
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(
  supabase: SupabaseClient<Database>,
  id: string
) {
  return (supabase.from("notifications") as any)
    .update({ read: true })
    .eq("id", id);
}

/**
 * Mark all unread notifications for a user as read.
 */
export async function markAllRead(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  return (supabase.from("notifications") as any)
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
}
