import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type VendorType = "supplier" | "subcontractor" | "both";
export type VendorStatus = "active" | "inactive" | "blacklisted";
export type PoStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

export interface Vendor {
  id: string;
  name: string;
  vendor_type: VendorType;
  status: VendorStatus;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gst_number: string | null;
  rating: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  created_at: string;
}

export interface PurchaseOrderWithDetails {
  id: string;
  po_seq: number;
  po_number: string;
  project_id: string;
  project_name: string | null;
  vendor_id: string;
  vendor_name: string | null;
  status: PoStatus;
  expected_delivery_date: string | null;
  notes: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  items: PurchaseOrderItem[];
  total_amount: number;
}

function formatPoNumber(seq: number): string {
  return `PO-${String(seq).padStart(4, "0")}`;
}

/**
 * Fetch all vendors
 */
export async function getVendors(
  supabase: SupabaseClient<Database>
): Promise<Vendor[]> {
  const { data, error } = await (supabase.from("vendors") as any)
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching vendors:", error);
    throw new Error(`Failed to load vendors: ${error.message}`);
  }

  return (data || []) as Vendor[];
}

/**
 * Create a new vendor
 */
export async function createVendor(
  supabase: SupabaseClient<Database>,
  payload: {
    name: string;
    vendor_type: VendorType;
    contact_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    gst_number?: string;
    notes?: string;
    created_by: string;
  }
) {
  const { data, error } = await (supabase.from("vendors") as any)
    .insert(payload)
    .select()
    .single();

  return { data, error };
}

/**
 * Update a vendor
 */
export async function updateVendor(
  supabase: SupabaseClient<Database>,
  id: string,
  payload: Partial<{
    name: string;
    vendor_type: VendorType;
    status: VendorStatus;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    gst_number: string | null;
    rating: number | null;
    notes: string | null;
  }>
) {
  const { data, error } = await (supabase.from("vendors") as any)
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}

/**
 * Fetch all purchase orders with vendor, project, and line items
 */
export async function getPurchaseOrders(
  supabase: SupabaseClient<Database>
): Promise<PurchaseOrderWithDetails[]> {
  const { data, error } = await (supabase.from("purchase_orders") as any)
    .select(`
      *,
      projects ( name ),
      vendors ( name ),
      purchase_order_items ( * )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching purchase orders:", error);
    throw new Error(`Failed to load purchase orders: ${error.message}`);
  }

  return (data || []).map((po: any) => {
    const items = (po.purchase_order_items || []) as PurchaseOrderItem[];
    const total_amount = items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unit_price),
      0
    );

    return {
      id: po.id,
      po_seq: po.po_seq,
      po_number: formatPoNumber(po.po_seq),
      project_id: po.project_id,
      project_name: po.projects?.name || null,
      vendor_id: po.vendor_id,
      vendor_name: po.vendors?.name || null,
      status: po.status as PoStatus,
      expected_delivery_date: po.expected_delivery_date,
      notes: po.notes,
      created_by: po.created_by,
      approved_by: po.approved_by,
      approved_at: po.approved_at,
      created_at: po.created_at,
      items,
      total_amount,
    };
  });
}

/**
 * Purchase orders for one project — used by the Gantt delay-risk score to
 * flag tasks exposed to a late material delivery, and available for any
 * future per-project procurement view.
 */
export async function getProjectPurchaseOrders(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<PurchaseOrderWithDetails[]> {
  const { data, error } = await (supabase.from("purchase_orders") as any)
    .select(`
      *,
      projects ( name ),
      vendors ( name ),
      purchase_order_items ( * )
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching project purchase orders:", error);
    return [];
  }

  return (data || []).map((po: any) => {
    const items = (po.purchase_order_items || []) as PurchaseOrderItem[];
    const total_amount = items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unit_price),
      0
    );

    return {
      id: po.id,
      po_seq: po.po_seq,
      po_number: formatPoNumber(po.po_seq),
      project_id: po.project_id,
      project_name: po.projects?.name || null,
      vendor_id: po.vendor_id,
      vendor_name: po.vendors?.name || null,
      status: po.status as PoStatus,
      expected_delivery_date: po.expected_delivery_date,
      notes: po.notes,
      created_by: po.created_by,
      approved_by: po.approved_by,
      approved_at: po.approved_at,
      created_at: po.created_at,
      items,
      total_amount,
    };
  });
}

/**
 * Create a purchase order with line items
 */
export async function createPurchaseOrder(
  supabase: SupabaseClient<Database>,
  payload: {
    project_id: string;
    vendor_id: string;
    expected_delivery_date?: string;
    notes?: string;
    created_by: string;
    items: { item_name: string; quantity: number; unit: string; unit_price: number }[];
  }
) {
  const { items, ...poPayload } = payload;

  const { data: po, error: poError } = await (supabase.from("purchase_orders") as any)
    .insert(poPayload)
    .select()
    .single();

  if (poError || !po) {
    return { data: null, error: poError };
  }

  if (items.length > 0) {
    const { error: itemsError } = await (supabase.from("purchase_order_items") as any).insert(
      items.map((item) => ({ ...item, po_id: po.id }))
    );

    if (itemsError) {
      return { data: null, error: itemsError };
    }
  }

  return { data: po, error: null };
}

/**
 * Update purchase order status (approval workflow)
 */
export async function updatePurchaseOrderStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  status: PoStatus,
  approverId?: string
) {
  const payload: Record<string, unknown> = { status };
  if (status === "approved" && approverId) {
    payload.approved_by = approverId;
    payload.approved_at = new Date().toISOString();
  }

  const { data, error } = await (supabase.from("purchase_orders") as any)
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}

/**
 * Delete a purchase order
 */
export async function deletePurchaseOrder(
  supabase: SupabaseClient<Database>,
  id: string
) {
  const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
  return { error };
}
