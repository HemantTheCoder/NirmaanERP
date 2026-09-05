import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface CostCode {
  id: string;
  project_id: string;
  code: string;
  name: string;
  budgeted_amount: number;
  created_by: string;
  created_at: string;
}

export async function getProjectCostCodes(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<CostCode[]> {
  const { data, error } = await (supabase.from("cost_codes") as any)
    .select("*")
    .eq("project_id", projectId)
    .order("code", { ascending: true });

  if (error) {
    console.error("Error fetching cost codes:", error);
    return [];
  }

  return (data || []).map((c: any) => ({ ...c, budgeted_amount: Number(c.budgeted_amount) }));
}

export async function createCostCode(
  supabase: SupabaseClient<Database>,
  input: { project_id: string; code: string; name: string; budgeted_amount: number },
  userId: string
): Promise<{ success: boolean; data?: CostCode; error?: string }> {
  const { data, error } = await (supabase.from("cost_codes") as any)
    .insert({
      project_id: input.project_id,
      code: input.code.trim(),
      name: input.name.trim(),
      budgeted_amount: input.budgeted_amount,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    // Unique violation on (project_id, code) lands here with a readable code column
    const message = error?.code === "23505" ? "A cost code with this code already exists on this project." : error?.message;
    return { success: false, error: message || "Failed to create cost code" };
  }

  return { success: true, data: { ...data, budgeted_amount: Number(data.budgeted_amount) } };
}

export async function updateCostCode(
  supabase: SupabaseClient<Database>,
  id: string,
  updates: Partial<{ code: string; name: string; budgeted_amount: number }>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from("cost_codes") as any).update(updates).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteCostCode(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from("cost_codes") as any).delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
