import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type InventoryCategory = "material" | "consumable" | "tool";
export type InventoryTransactionType =
  | "receipt"
  | "issue"
  | "return"
  | "adjustment_increase"
  | "adjustment_decrease";
export type EquipmentStatus = "available" | "in_use" | "maintenance" | "retired";

export interface InventoryItem {
  id: string;
  project_id: string | null;
  project_name: string | null;
  name: string;
  category: InventoryCategory;
  unit: string;
  quantity_on_hand: number;
  reorder_level: number;
  unit_cost: number | null;
  created_by: string;
  created_at: string;
}

export interface InventoryTransaction {
  id: string;
  inventory_item_id: string;
  item_name: string | null;
  transaction_type: InventoryTransactionType;
  quantity: number;
  reference: string | null;
  performed_by: string;
  performer_name: string | null;
  transaction_date: string;
  notes: string | null;
  created_at: string;
}

export interface EquipmentAsset {
  id: string;
  name: string;
  asset_tag: string | null;
  category: string;
  status: EquipmentStatus;
  current_project_id: string | null;
  current_project_name: string | null;
  purchase_date: string | null;
  last_maintenance_date: string | null;
  next_maintenance_due: string | null;
  created_by: string;
  created_at: string;
}

export interface EquipmentMaintenanceLog {
  id: string;
  equipment_id: string;
  maintenance_date: string;
  maintenance_type: string;
  cost: number | null;
  notes: string | null;
  performed_by: string;
  created_at: string;
}

/**
 * Fetch all inventory items
 */
export async function getInventoryItems(
  supabase: SupabaseClient<Database>
): Promise<InventoryItem[]> {
  const { data, error } = await (supabase.from("inventory_items") as any)
    .select(`*, projects ( name )`)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching inventory items:", error);
    throw new Error(`Failed to load inventory items: ${error.message}`);
  }

  return (data || []).map((i: any) => ({
    id: i.id,
    project_id: i.project_id,
    project_name: i.projects?.name || null,
    name: i.name,
    category: i.category as InventoryCategory,
    unit: i.unit,
    quantity_on_hand: Number(i.quantity_on_hand),
    reorder_level: Number(i.reorder_level),
    unit_cost: i.unit_cost != null ? Number(i.unit_cost) : null,
    created_by: i.created_by,
    created_at: i.created_at,
  }));
}

/**
 * Create an inventory item
 */
export async function createInventoryItem(
  supabase: SupabaseClient<Database>,
  payload: {
    project_id?: string;
    name: string;
    category: InventoryCategory;
    unit: string;
    quantity_on_hand?: number;
    reorder_level?: number;
    unit_cost?: number;
    created_by: string;
  }
) {
  const { data, error } = await (supabase.from("inventory_items") as any)
    .insert(payload)
    .select()
    .single();

  return { data, error };
}

/**
 * Fetch recent inventory transactions
 */
export async function getInventoryTransactions(
  supabase: SupabaseClient<Database>,
  limit = 50
): Promise<InventoryTransaction[]> {
  const { data, error } = await (supabase.from("inventory_transactions") as any)
    .select(`*, inventory_items ( name ), users!performed_by ( full_name )`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching inventory transactions:", error);
    throw new Error(`Failed to load inventory transactions: ${error.message}`);
  }

  return (data || []).map((t: any) => ({
    id: t.id,
    inventory_item_id: t.inventory_item_id,
    item_name: t.inventory_items?.name || null,
    transaction_type: t.transaction_type as InventoryTransactionType,
    quantity: Number(t.quantity),
    reference: t.reference,
    performed_by: t.performed_by,
    performer_name: t.users?.full_name || null,
    transaction_date: t.transaction_date,
    notes: t.notes,
    created_at: t.created_at,
  }));
}

/**
 * Every transaction across all items since `sinceDate` (YYYY-MM-DD) —
 * unlike getInventoryTransactions (capped at `limit`, portfolio-wide most
 * recent), this is scoped by date so a burn-rate calc over N items doesn't
 * silently drop older items' history once the recent-N cap fills up with
 * activity from a few busy ones.
 */
export async function getInventoryTransactionsSince(
  supabase: SupabaseClient<Database>,
  sinceDate: string
): Promise<InventoryTransaction[]> {
  const { data, error } = await (supabase.from("inventory_transactions") as any)
    .select(`*, inventory_items ( name ), users!performed_by ( full_name )`)
    .gte("transaction_date", sinceDate)
    .order("transaction_date", { ascending: false });

  if (error) {
    console.error("Error fetching inventory transactions since date:", error);
    return [];
  }

  return (data || []).map((t: any) => ({
    id: t.id,
    inventory_item_id: t.inventory_item_id,
    item_name: t.inventory_items?.name || null,
    transaction_type: t.transaction_type as InventoryTransactionType,
    quantity: Number(t.quantity),
    reference: t.reference,
    performed_by: t.performed_by,
    performer_name: t.users?.full_name || null,
    transaction_date: t.transaction_date,
    notes: t.notes,
    created_at: t.created_at,
  }));
}

/**
 * Record an inventory transaction (receipt/issue/return/adjustment)
 */
export async function createInventoryTransaction(
  supabase: SupabaseClient<Database>,
  payload: {
    inventory_item_id: string;
    transaction_type: InventoryTransactionType;
    quantity: number;
    reference?: string;
    performed_by: string;
    notes?: string;
  }
) {
  const { data, error } = await (supabase.from("inventory_transactions") as any)
    .insert(payload)
    .select()
    .single();

  return { data, error };
}

/**
 * Fetch all equipment assets
 */
export async function getEquipmentAssets(
  supabase: SupabaseClient<Database>
): Promise<EquipmentAsset[]> {
  const { data, error } = await (supabase.from("equipment_assets") as any)
    .select(`*, projects ( name )`)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching equipment assets:", error);
    throw new Error(`Failed to load equipment assets: ${error.message}`);
  }

  return (data || []).map((e: any) => ({
    id: e.id,
    name: e.name,
    asset_tag: e.asset_tag,
    category: e.category,
    status: e.status as EquipmentStatus,
    current_project_id: e.current_project_id,
    current_project_name: e.projects?.name || null,
    purchase_date: e.purchase_date,
    last_maintenance_date: e.last_maintenance_date,
    next_maintenance_due: e.next_maintenance_due,
    created_by: e.created_by,
    created_at: e.created_at,
  }));
}

/**
 * Create an equipment asset
 */
export async function createEquipmentAsset(
  supabase: SupabaseClient<Database>,
  payload: {
    name: string;
    asset_tag?: string;
    category: string;
    current_project_id?: string;
    purchase_date?: string;
    created_by: string;
  }
) {
  const { data, error } = await (supabase.from("equipment_assets") as any)
    .insert(payload)
    .select()
    .single();

  return { data, error };
}

/**
 * Update equipment status (and optionally reassign project)
 */
export async function updateEquipmentStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  status: EquipmentStatus,
  currentProjectId?: string | null
) {
  const payload: Record<string, unknown> = { status };
  if (currentProjectId !== undefined) {
    payload.current_project_id = currentProjectId;
  }

  const { data, error } = await (supabase.from("equipment_assets") as any)
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}

export interface EquipmentStatusHistoryEntry {
  equipment_id: string;
  status: EquipmentStatus;
  changed_at: string;
}

/**
 * Full status-change log across all equipment (supabase/migrations/
 * 0047_equipment_status_history.sql) — feeds lib/utils/equipmentUtilization.ts.
 * Written only by a DB trigger, so this is purely a read.
 */
export async function getEquipmentStatusHistory(
  supabase: SupabaseClient<Database>
): Promise<EquipmentStatusHistoryEntry[]> {
  const { data, error } = await (supabase.from("equipment_status_history") as any)
    .select("equipment_id, status, changed_at")
    .order("changed_at", { ascending: true });

  if (error) {
    console.error("Error fetching equipment status history:", error);
    return [];
  }

  return (data || []) as EquipmentStatusHistoryEntry[];
}

/**
 * Log equipment maintenance and update last/next maintenance dates
 */
export async function logEquipmentMaintenance(
  supabase: SupabaseClient<Database>,
  payload: {
    equipment_id: string;
    maintenance_type: string;
    cost?: number;
    notes?: string;
    performed_by: string;
    next_maintenance_due?: string;
  }
) {
  const { next_maintenance_due, ...logPayload } = payload;

  const { data: log, error: logError } = await (supabase.from("equipment_maintenance_logs") as any)
    .insert(logPayload)
    .select()
    .single();

  if (logError) {
    return { data: null, error: logError };
  }

  const updatePayload: Record<string, unknown> = {
    last_maintenance_date: new Date().toISOString().split("T")[0],
  };
  if (next_maintenance_due) {
    updatePayload.next_maintenance_due = next_maintenance_due;
  }

  await (supabase.from("equipment_assets") as any)
    .update(updatePayload)
    .eq("id", payload.equipment_id);

  return { data: log, error: null };
}
