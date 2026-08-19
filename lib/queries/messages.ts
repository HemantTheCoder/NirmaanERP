import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

/**
 * Full thread between two users, oldest first (chat reading order).
 * RLS already scopes this to rows where the caller is sender or recipient,
 * but the explicit .or() keeps the query itself correct even if called with
 * a service-role client that bypasses RLS.
 */
export async function getThread(
  supabase: SupabaseClient<Database>,
  userA: string,
  userB: string
): Promise<Message[]> {
  const { data, error } = await (supabase.from("messages") as any)
    .select("*")
    .or(
      `and(sender_id.eq.${userA},recipient_id.eq.${userB}),and(sender_id.eq.${userB},recipient_id.eq.${userA})`
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching message thread:", error);
    throw new Error(`Failed to load conversation: ${error.message}`);
  }

  return (data || []) as Message[];
}

/**
 * Send a message. The DB trigger notify_new_message handles the
 * notification — nothing to do here beyond the insert.
 */
export async function sendMessage(
  supabase: SupabaseClient<Database>,
  senderId: string,
  recipientId: string,
  body: string
): Promise<{ success: boolean; data?: Message; error?: string }> {
  const trimmed = body.trim();
  if (!trimmed) {
    return { success: false, error: "Message cannot be empty." };
  }

  const { data, error } = await (supabase.from("messages") as any)
    .insert({ sender_id: senderId, recipient_id: recipientId, body: trimmed })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data as Message };
}

/**
 * Mark every message from `otherUserId` to `userId` as read. RLS restricts
 * UPDATE to rows where the caller is the recipient, and a BEFORE UPDATE
 * trigger rejects changing anything but `read`, so this can only ever mark
 * the caller's own inbox read — never anyone else's.
 */
export async function markThreadRead(
  supabase: SupabaseClient<Database>,
  userId: string,
  otherUserId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from("messages") as any)
    .update({ read: true })
    .eq("recipient_id", userId)
    .eq("sender_id", otherUserId)
    .eq("read", false);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Unread message count per sender, for the current user's inbox — used to
 * show unread badges without loading every thread.
 */
export async function getUnreadCountsBySender(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Record<string, number>> {
  const { data, error } = await (supabase.from("messages") as any)
    .select("sender_id")
    .eq("recipient_id", userId)
    .eq("read", false);

  if (error) {
    console.error("Error fetching unread message counts:", error);
    throw new Error(`Failed to load unread counts: ${error.message}`);
  }

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    counts[row.sender_id] = (counts[row.sender_id] ?? 0) + 1;
  }
  return counts;
}
