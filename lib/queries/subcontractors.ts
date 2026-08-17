import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type SubcontractStatus = "draft" | "active" | "completed" | "terminated";

export interface SubcontractWithDetails {
  id: string;
  contract_seq: number;
  contract_number: string;
  project_id: string;
  project_name: string | null;
  vendor_id: string;
  vendor_name: string | null;
  scope_of_work: string;
  contract_value: number;
  start_date: string | null;
  end_date: string | null;
  retention_percentage: number;
  status: SubcontractStatus;
  created_by: string;
  created_at: string;
  avg_rating: number | null;
  review_count: number;
}

export interface PerformanceReview {
  id: string;
  subcontract_id: string;
  vendor_id: string;
  project_id: string;
  review_date: string;
  quality_rating: number;
  timeliness_rating: number;
  safety_rating: number;
  comments: string | null;
  reviewed_by: string;
  reviewer_name: string | null;
  created_at: string;
}

function formatContractNumber(seq: number): string {
  return `SC-${String(seq).padStart(4, "0")}`;
}

/**
 * Fetch all subcontracts with vendor, project, and aggregated review rating
 */
export async function getSubcontracts(
  supabase: SupabaseClient<Database>
): Promise<SubcontractWithDetails[]> {
  const [{ data: contracts, error: contractsError }, { data: reviews, error: reviewsError }] =
    await Promise.all([
      (supabase.from("subcontracts") as any)
        .select(`*, projects ( name ), vendors ( name )`)
        .order("created_at", { ascending: false }),
      (supabase.from("subcontractor_performance_reviews") as any).select(
        "subcontract_id, quality_rating, timeliness_rating, safety_rating"
      ),
    ]);

  if (contractsError) {
    console.error("Error fetching subcontracts:", contractsError);
    throw new Error(`Failed to load subcontracts: ${contractsError.message}`);
  }

  if (reviewsError) {
    console.error("Error fetching performance reviews:", reviewsError);
  }

  const reviewsBySubcontract = new Map<string, number[]>();
  for (const r of reviews || []) {
    const avg = (r.quality_rating + r.timeliness_rating + r.safety_rating) / 3;
    const list = reviewsBySubcontract.get(r.subcontract_id) || [];
    list.push(avg);
    reviewsBySubcontract.set(r.subcontract_id, list);
  }

  return (contracts || []).map((c: any) => {
    const ratings = reviewsBySubcontract.get(c.id) || [];
    const avg_rating =
      ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;

    return {
      id: c.id,
      contract_seq: c.contract_seq,
      contract_number: formatContractNumber(c.contract_seq),
      project_id: c.project_id,
      project_name: c.projects?.name || null,
      vendor_id: c.vendor_id,
      vendor_name: c.vendors?.name || null,
      scope_of_work: c.scope_of_work,
      contract_value: Number(c.contract_value),
      start_date: c.start_date,
      end_date: c.end_date,
      retention_percentage: Number(c.retention_percentage),
      status: c.status as SubcontractStatus,
      created_by: c.created_by,
      created_at: c.created_at,
      avg_rating,
      review_count: ratings.length,
    };
  });
}

/**
 * Create a subcontract
 */
export async function createSubcontract(
  supabase: SupabaseClient<Database>,
  payload: {
    project_id: string;
    vendor_id: string;
    scope_of_work: string;
    contract_value: number;
    start_date?: string;
    end_date?: string;
    retention_percentage?: number;
    created_by: string;
  }
) {
  const { data, error } = await (supabase.from("subcontracts") as any)
    .insert(payload)
    .select()
    .single();

  return { data, error };
}

/**
 * Update subcontract status
 */
export async function updateSubcontractStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  status: SubcontractStatus
) {
  const { data, error } = await (supabase.from("subcontracts") as any)
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}

/**
 * Fetch performance reviews for a vendor
 */
export async function getPerformanceReviews(
  supabase: SupabaseClient<Database>,
  vendorId: string
): Promise<PerformanceReview[]> {
  const { data, error } = await (supabase.from("subcontractor_performance_reviews") as any)
    .select(`*, users!reviewed_by ( full_name )`)
    .eq("vendor_id", vendorId)
    .order("review_date", { ascending: false });

  if (error) {
    console.error("Error fetching performance reviews:", error);
    throw new Error(`Failed to load performance reviews: ${error.message}`);
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    subcontract_id: r.subcontract_id,
    vendor_id: r.vendor_id,
    project_id: r.project_id,
    review_date: r.review_date,
    quality_rating: r.quality_rating,
    timeliness_rating: r.timeliness_rating,
    safety_rating: r.safety_rating,
    comments: r.comments,
    reviewed_by: r.reviewed_by,
    reviewer_name: r.users?.full_name || null,
    created_at: r.created_at,
  }));
}

/**
 * Create a performance review for a subcontract
 */
export async function createPerformanceReview(
  supabase: SupabaseClient<Database>,
  payload: {
    subcontract_id: string;
    vendor_id: string;
    project_id: string;
    quality_rating: number;
    timeliness_rating: number;
    safety_rating: number;
    comments?: string;
    reviewed_by: string;
  }
) {
  const { data, error } = await (supabase.from("subcontractor_performance_reviews") as any)
    .insert(payload)
    .select()
    .single();

  return { data, error };
}
