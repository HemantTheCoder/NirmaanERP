import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type BillingMilestoneStatus = "pending" | "invoiced" | "paid";

export interface BillingMilestone {
  id: string;
  project_id: string;
  sequence: number;
  title: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  status: BillingMilestoneStatus;
  invoiced_at: string | null;
  paid_at: string | null;
  created_by: string;
  created_at: string;
}

export async function getProjectBillingMilestones(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<BillingMilestone[]> {
  const { data, error } = await (supabase.from("billing_milestones") as any)
    .select("*")
    .eq("project_id", projectId)
    .order("sequence", { ascending: true });

  if (error) {
    console.error("Error fetching billing milestones:", error);
    return [];
  }

  return (data || []).map((m: any) => ({ ...m, amount: Number(m.amount) }));
}

export async function createBillingMilestone(
  supabase: SupabaseClient<Database>,
  input: {
    project_id: string;
    title: string;
    description?: string | null;
    amount: number;
    due_date?: string | null;
    sequence: number;
  },
  userId: string
): Promise<{ success: boolean; data?: BillingMilestone; error?: string }> {
  const { data, error } = await (supabase.from("billing_milestones") as any)
    .insert({
      project_id: input.project_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      amount: input.amount,
      due_date: input.due_date || null,
      sequence: input.sequence,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to create billing milestone" };
  }

  return { success: true, data: { ...data, amount: Number(data.amount) } };
}

/**
 * Advances a milestone's status — pending -> invoiced -> paid — stamping
 * the relevant timestamp. Only forward transitions are meaningful here; the
 * UI only ever offers the next status, not an arbitrary jump.
 */
export async function updateBillingMilestoneStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  status: BillingMilestoneStatus
): Promise<{ success: boolean; error?: string }> {
  const updates: Record<string, unknown> = { status };
  if (status === "invoiced") updates.invoiced_at = new Date().toISOString();
  if (status === "paid") updates.paid_at = new Date().toISOString();

  const { error } = await (supabase.from("billing_milestones") as any).update(updates).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteBillingMilestone(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from("billing_milestones") as any).delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
