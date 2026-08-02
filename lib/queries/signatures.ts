import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface SignatureAcknowledgment {
  id: string;
  action_type: string;
  reference_id: string;
  signed_by: string;
  typed_name: string;
  ip_address: string | null;
  signed_at: string;
  signer?: {
    full_name: string;
    email: string;
  } | null;
}

/**
 * Record a digital signature acknowledgment
 */
export async function createSignatureAcknowledgment(
  supabase: SupabaseClient<Database>,
  input: {
    action_type: string;
    reference_id: string;
    typed_name: string;
    ip_address?: string | null;
  },
  userId: string
): Promise<{ success: boolean; data?: SignatureAcknowledgment; error?: string }> {
  const { data, error } = await (supabase.from("signature_acknowledgments") as any)
    .insert({
      action_type: input.action_type,
      reference_id: input.reference_id,
      signed_by: userId,
      typed_name: input.typed_name.trim(),
      ip_address: input.ip_address || null,
    })
    .select(`
      *,
      signer:users!signature_acknowledgments_signed_by_fkey(full_name, email)
    `)
    .single();

  if (error || !data) {
    console.error("Error creating signature acknowledgment:", error);
    return { success: false, error: error?.message || "Failed to record digital signature" };
  }

  return { success: true, data: data as SignatureAcknowledgment };
}

/**
 * Fetch signature acknowledgment record for a specific action and reference ID
 */
export async function getSignatureAcknowledgment(
  supabase: SupabaseClient<Database>,
  actionType: string,
  referenceId: string
): Promise<SignatureAcknowledgment | null> {
  const { data, error } = await (supabase.from("signature_acknowledgments") as any)
    .select(`
      *,
      signer:users!signature_acknowledgments_signed_by_fkey(full_name, email)
    `)
    .eq("action_type", actionType)
    .eq("reference_id", referenceId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data as SignatureAcknowledgment;
}
