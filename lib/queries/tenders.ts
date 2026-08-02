import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole, TenderStatus, BidStatus } from "@/types/database";

export interface TenderDocumentItem {
  id: string;
  tender_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export interface BidItem {
  id: string;
  tender_id: string;
  contractor_id: string;
  bid_amount: number;
  proposal_text: string | null;
  emd_reference?: string | null;
  terms_accepted?: boolean;
  status: BidStatus;
  submitted_at: string;
  reviewed_by: string | null;
  review_notes: string | null;
  contractor?: {
    full_name: string;
    email: string;
  };
}

export interface TenderItem {
  id: string;
  project_id: string | null;
  title: string;
  category: string;
  scope_description: string | null;
  eligibility_criteria: string | null;
  estimated_value_min: number | null;
  estimated_value_max: number | null;
  emd_amount: number | null;
  emd_refundable: boolean;
  tender_fee: number | null;
  performance_guarantee_percent: number | null;
  opening_date: string | null;
  special_conditions: string | null;
  legal_clauses: string | null;
  submission_deadline: string;
  status: TenderStatus;
  created_by: string;
  awarded_bid_id: string | null;
  created_at: string;
  project?: {
    name: string;
  } | null;
  creator?: {
    full_name: string;
    email: string;
  } | null;
  bids_count?: number;
  my_bid?: BidItem | null;
  awarded_bid?: BidItem | null;
  documents?: TenderDocumentItem[];
}

export interface CreateTenderInput {
  project_id?: string | null;
  title: string;
  category: string;
  scope_description?: string;
  eligibility_criteria?: string;
  estimated_value_min?: number | null;
  estimated_value_max?: number | null;
  emd_amount?: number | null;
  emd_refundable?: boolean;
  tender_fee?: number | null;
  performance_guarantee_percent?: number | null;
  opening_date?: string | null;
  special_conditions?: string;
  legal_clauses?: string;
  submission_deadline: string;
  status: TenderStatus;
}

// ── GET TENDERS LIST ─────────────────────────────────────────────────────────

export async function getTenders(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: UserRole,
  filters?: { status?: string; category?: string; search?: string }
): Promise<TenderItem[]> {
  let query = (supabase.from("tenders") as any)
    .select(`
      *,
      project:projects(name),
      creator:users!tenders_created_by_fkey(full_name, email),
      bids:bids!bids_tender_id_fkey(id, contractor_id, status, bid_amount, submitted_at)
    `)
    .order("created_at", { ascending: false });

  if (role === "contractor") {
    // Contractors only see published, closed, awarded tenders
    query = query.in("status", ["published", "closed", "awarded"]);
  }

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching tenders:", error);
    return [];
  }

  const rawList = data || [];

  return rawList.map((item: any) => {
    const bidsList = item.bids || [];
    const myBid = bidsList.find((b: any) => b.contractor_id === userId) || null;

    return {
      id: item.id,
      project_id: item.project_id,
      title: item.title,
      category: item.category,
      scope_description: item.scope_description,
      eligibility_criteria: item.eligibility_criteria,
      estimated_value_min: item.estimated_value_min ? Number(item.estimated_value_min) : null,
      estimated_value_max: item.estimated_value_max ? Number(item.estimated_value_max) : null,
      emd_amount: item.emd_amount ? Number(item.emd_amount) : null,
      emd_refundable: item.emd_refundable ?? true,
      tender_fee: item.tender_fee ? Number(item.tender_fee) : null,
      performance_guarantee_percent: item.performance_guarantee_percent ? Number(item.performance_guarantee_percent) : null,
      opening_date: item.opening_date || null,
      special_conditions: item.special_conditions || null,
      legal_clauses: item.legal_clauses || null,
      submission_deadline: item.submission_deadline,
      status: item.status,
      created_by: item.created_by,
      awarded_bid_id: item.awarded_bid_id,
      created_at: item.created_at,
      project: item.project || null,
      creator: item.creator || null,
      bids_count: bidsList.length,
      my_bid: myBid,
    };
  });
}

// ── GET SINGLE TENDER DETAIL ──────────────────────────────────────────────────

export async function getTenderById(
  supabase: SupabaseClient<Database>,
  tenderId: string,
  userId: string,
  role: UserRole
): Promise<{ tender: TenderItem | null; documents: TenderDocumentItem[]; bids: BidItem[] }> {
  const { data: tenderData, error: tenderErr } = await (supabase.from("tenders") as any)
    .select(`
      *,
      project:projects(name),
      creator:users!tenders_created_by_fkey(full_name, email)
    `)
    .eq("id", tenderId)
    .single();

  if (tenderErr || !tenderData) {
    console.error("Error fetching tender by ID:", tenderErr);
    return { tender: null, documents: [], bids: [] };
  }

  // Fetch documents
  const { data: docsData } = await (supabase.from("tender_documents") as any)
    .select("*")
    .eq("tender_id", tenderId)
    .order("created_at", { ascending: true });

  // Fetch bids depending on role
  let bidsData: BidItem[] = [];
  let myBid: BidItem | null = null;

  if (role === "admin" || role === "project_manager") {
    const { data: allBids } = await (supabase.from("bids") as any)
      .select(`
        *,
        contractor:users!bids_contractor_id_fkey(full_name, email)
      `)
      .eq("tender_id", tenderId)
      .order("submitted_at", { ascending: false });

    bidsData = (allBids || []).map((b: any) => ({
      ...b,
      bid_amount: Number(b.bid_amount),
    }));
  } else if (role === "contractor") {
    const { data: contractorBid } = await (supabase.from("bids") as any)
      .select(`
        *,
        contractor:users!bids_contractor_id_fkey(full_name, email)
      `)
      .eq("tender_id", tenderId)
      .eq("contractor_id", userId)
      .maybeSingle();

    if (contractorBid) {
      myBid = {
        ...contractorBid,
        bid_amount: Number(contractorBid.bid_amount),
      };
      bidsData = myBid ? [myBid] : [];
    }
  }

  const tender: TenderItem = {
    id: tenderData.id,
    project_id: tenderData.project_id,
    title: tenderData.title,
    category: tenderData.category,
    scope_description: tenderData.scope_description,
    eligibility_criteria: tenderData.eligibility_criteria,
    estimated_value_min: tenderData.estimated_value_min ? Number(tenderData.estimated_value_min) : null,
    estimated_value_max: tenderData.estimated_value_max ? Number(tenderData.estimated_value_max) : null,
    emd_amount: tenderData.emd_amount ? Number(tenderData.emd_amount) : null,
    emd_refundable: tenderData.emd_refundable ?? true,
    tender_fee: tenderData.tender_fee ? Number(tenderData.tender_fee) : null,
    performance_guarantee_percent: tenderData.performance_guarantee_percent ? Number(tenderData.performance_guarantee_percent) : null,
    opening_date: tenderData.opening_date || null,
    special_conditions: tenderData.special_conditions || null,
    legal_clauses: tenderData.legal_clauses || null,
    submission_deadline: tenderData.submission_deadline,
    status: tenderData.status,
    created_by: tenderData.created_by,
    awarded_bid_id: tenderData.awarded_bid_id,
    created_at: tenderData.created_at,
    project: tenderData.project || null,
    creator: tenderData.creator || null,
    my_bid: myBid,
    bids_count: bidsData.length,
  };

  return {
    tender,
    documents: (docsData || []) as TenderDocumentItem[],
    bids: bidsData,
  };
}

// ── CREATE TENDER ────────────────────────────────────────────────────────────

export async function createTender(
  supabase: SupabaseClient<Database>,
  input: CreateTenderInput,
  creatorId: string
): Promise<{ data: TenderItem | null; error: any }> {
  const { data, error } = await (supabase.from("tenders") as any)
    .insert({
      project_id: input.project_id || null,
      title: input.title,
      category: input.category,
      scope_description: input.scope_description || null,
      eligibility_criteria: input.eligibility_criteria || null,
      estimated_value_min: input.estimated_value_min || null,
      estimated_value_max: input.estimated_value_max || null,
      emd_amount: input.emd_amount || null,
      emd_refundable: input.emd_refundable ?? true,
      tender_fee: input.tender_fee || null,
      performance_guarantee_percent: input.performance_guarantee_percent || null,
      opening_date: input.opening_date || null,
      special_conditions: input.special_conditions || null,
      legal_clauses: input.legal_clauses || null,
      submission_deadline: input.submission_deadline,
      status: input.status,
      created_by: creatorId,
    })
    .select()
    .single();

  return { data: data as TenderItem | null, error };
}

// ── UPDATE TENDER ────────────────────────────────────────────────────────────

export async function updateTender(
  supabase: SupabaseClient<Database>,
  tenderId: string,
  updates: Partial<CreateTenderInput>
) {
  return (supabase.from("tenders") as any)
    .update(updates)
    .eq("id", tenderId);
}

// ── SUBMIT BID ───────────────────────────────────────────────────────────────

export async function getContractorBids(
  supabase: SupabaseClient<Database>,
  contractorId: string
): Promise<BidItem[]> {
  const { data, error } = await (supabase.from("bids") as any)
    .select(`
      *,
      tender:tenders!bids_tender_id_fkey(
        id,
        title,
        status,
        category,
        submission_deadline
      )
    `)
    .eq("contractor_id", contractorId)
    .order("submitted_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching contractor bids:", error);
    return [];
  }

  return data as BidItem[];
}

export async function submitBid(
  supabase: SupabaseClient<Database>,
  tenderId: string,
  contractorId: string,
  bidAmount: number,
  proposalText: string,
  emdReference?: string | null,
  termsAccepted: boolean = false
) {
  return (supabase.from("bids") as any).insert({
    tender_id: tenderId,
    contractor_id: contractorId,
    bid_amount: bidAmount,
    proposal_text: proposalText,
    emd_reference: emdReference || null,
    terms_accepted: termsAccepted,
    status: "submitted",
  });
}

// ── UPDATE BID STATUS (SHORTLIST / REJECT) ───────────────────────────────────

export async function updateBidStatus(
  supabase: SupabaseClient<Database>,
  bidId: string,
  status: BidStatus,
  reviewerId: string,
  reviewNotes?: string
) {
  return (supabase.from("bids") as any)
    .update({
      status,
      reviewed_by: reviewerId,
      review_notes: reviewNotes || null,
    })
    .eq("id", bidId);
}

// ── AWARD BID & TENDER ──────────────────────────────────────────────────────

export async function awardBid(
  supabase: SupabaseClient<Database>,
  tenderId: string,
  bidId: string,
  reviewerId: string,
  reviewNotes?: string
) {
  // 1. Mark winning bid as 'awarded'
  const { error: winErr } = await (supabase.from("bids") as any)
    .update({
      status: "awarded",
      reviewed_by: reviewerId,
      review_notes: reviewNotes || "Contract awarded to bidder.",
    })
    .eq("id", bidId);

  if (winErr) return { error: winErr };

  // 2. Reject all other bids on this tender
  const { error: rejectErr } = await (supabase.from("bids") as any)
    .update({
      status: "rejected",
      reviewed_by: reviewerId,
      review_notes: "Tender was awarded to another contractor.",
    })
    .eq("tender_id", tenderId)
    .neq("id", bidId);

  if (rejectErr) console.warn("Notice: reject other bids error:", rejectErr);

  // 3. Update tender status to 'awarded' and link awarded_bid_id
  const { error: tenderErr } = await (supabase.from("tenders") as any)
    .update({
      status: "awarded",
      awarded_bid_id: bidId,
    })
    .eq("id", tenderId);

  return { error: tenderErr };
}
