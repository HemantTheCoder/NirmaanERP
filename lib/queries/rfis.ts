import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { TaskPriority } from "./tasks";

export type RfiStatus = "open" | "answered" | "closed";
export type ChangeOrderStatus = "draft" | "pending_approval" | "approved" | "rejected" | "implemented";

export interface RfiWithDetails {
  id: string;
  rfi_seq: number;
  rfi_number: string;
  project_id: string;
  project_name: string | null;
  subject: string;
  question: string;
  status: RfiStatus;
  priority: TaskPriority;
  raised_by: string;
  raised_by_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  response: string | null;
  responded_at: string | null;
  due_date: string | null;
  created_at: string;
}

export interface ChangeOrderWithDetails {
  id: string;
  co_seq: number;
  co_number: string;
  project_id: string;
  project_name: string | null;
  title: string;
  description: string;
  reason: string | null;
  cost_impact: number;
  schedule_impact_days: number;
  status: ChangeOrderStatus;
  requested_by: string;
  requested_by_name: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

function formatRfiNumber(seq: number): string {
  return `RFI-${String(seq).padStart(4, "0")}`;
}

function formatCoNumber(seq: number): string {
  return `CO-${String(seq).padStart(4, "0")}`;
}

/**
 * Fetch all RFIs with project, requester, and assignee details
 */
export async function getRfis(
  supabase: SupabaseClient<Database>
): Promise<RfiWithDetails[]> {
  const { data, error } = await (supabase.from("rfis") as any)
    .select(`*, projects ( name ), raised_by_user:users!raised_by ( full_name ), assigned_to_user:users!assigned_to ( full_name )`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching RFIs:", error);
    throw new Error(`Failed to load RFIs: ${error.message}`);
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    rfi_seq: r.rfi_seq,
    rfi_number: formatRfiNumber(r.rfi_seq),
    project_id: r.project_id,
    project_name: r.projects?.name || null,
    subject: r.subject,
    question: r.question,
    status: r.status as RfiStatus,
    priority: r.priority as TaskPriority,
    raised_by: r.raised_by,
    raised_by_name: r.raised_by_user?.full_name || null,
    assigned_to: r.assigned_to,
    assigned_to_name: r.assigned_to_user?.full_name || null,
    response: r.response,
    responded_at: r.responded_at,
    due_date: r.due_date,
    created_at: r.created_at,
  }));
}

/**
 * Create a new RFI
 */
export async function createRfi(
  supabase: SupabaseClient<Database>,
  payload: {
    project_id: string;
    subject: string;
    question: string;
    priority: TaskPriority;
    assigned_to?: string;
    due_date?: string;
    raised_by: string;
  }
) {
  const { data, error } = await (supabase.from("rfis") as any)
    .insert(payload)
    .select()
    .single();

  return { data, error };
}

/**
 * Answer an RFI
 */
export async function respondToRfi(
  supabase: SupabaseClient<Database>,
  id: string,
  response: string
) {
  const { data, error } = await (supabase.from("rfis") as any)
    .update({ response, status: "answered", responded_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}

/**
 * Update RFI status (e.g. close after answered)
 */
export async function updateRfiStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  status: RfiStatus
) {
  const { data, error } = await (supabase.from("rfis") as any)
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}

/**
 * Fetch all change orders with project and requester details
 */
export async function getChangeOrders(
  supabase: SupabaseClient<Database>
): Promise<ChangeOrderWithDetails[]> {
  const { data, error } = await (supabase.from("change_orders") as any)
    .select(`*, projects ( name ), users!requested_by ( full_name )`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching change orders:", error);
    throw new Error(`Failed to load change orders: ${error.message}`);
  }

  return (data || []).map((c: any) => ({
    id: c.id,
    co_seq: c.co_seq,
    co_number: formatCoNumber(c.co_seq),
    project_id: c.project_id,
    project_name: c.projects?.name || null,
    title: c.title,
    description: c.description,
    reason: c.reason,
    cost_impact: Number(c.cost_impact),
    schedule_impact_days: c.schedule_impact_days,
    status: c.status as ChangeOrderStatus,
    requested_by: c.requested_by,
    requested_by_name: c.users?.full_name || null,
    approved_by: c.approved_by,
    approved_at: c.approved_at,
    created_at: c.created_at,
  }));
}

/**
 * Create a new change order
 */
export async function createChangeOrder(
  supabase: SupabaseClient<Database>,
  payload: {
    project_id: string;
    title: string;
    description: string;
    reason?: string;
    cost_impact: number;
    schedule_impact_days: number;
    requested_by: string;
  }
) {
  const { data, error } = await (supabase.from("change_orders") as any)
    .insert(payload)
    .select()
    .single();

  return { data, error };
}

/**
 * Update change order status (approval workflow)
 */
export async function updateChangeOrderStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  status: ChangeOrderStatus,
  approverId?: string
) {
  const payload: Record<string, unknown> = { status };
  if (status === "approved" && approverId) {
    payload.approved_by = approverId;
    payload.approved_at = new Date().toISOString();
  }

  const { data, error } = await (supabase.from("change_orders") as any)
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}
