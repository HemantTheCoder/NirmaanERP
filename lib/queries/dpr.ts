import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type WeatherCondition = "clear" | "rain" | "overcast" | "extreme_heat" | "other";

/**
 * PPC target below which the project manager is alerted.
 * The authoritative copy of this threshold lives in the SQL trigger function
 * public.notify_ppc_below_target() (migration 0038) — this constant exists only
 * so the UI can label/colour the same boundary. Keep the two in sync.
 */
export const PPC_TARGET_PERCENT = 80;

export interface DprChecklistItem {
  id: string;
  dpr_id: string;
  description: string;
  is_completed: boolean;
  sequence: number;
  created_at: string;
}

export interface DailyProgressReport {
  id: string;
  project_id: string;
  report_date: string; // YYYY-MM-DD
  submitted_by: string;
  weather: WeatherCondition;
  manpower_count: number;
  equipment_used: string;
  work_completed: string;
  delays_encountered: string | null;
  photos_count: number;
  created_at: string;
  submitter?: {
    full_name: string;
    email: string;
  } | null;
  checklist_items?: DprChecklistItem[];
  /** null when the report has no checklist items — never a divide-by-zero */
  ppc_percentage?: number | null;
}

/**
 * Percent Plan Complete: completed planned items / total planned items.
 * Returns null (not 0) when there are no items, so "no plan recorded" is
 * distinguishable from "planned work, none of it done".
 */
export function calculatePpc(items: DprChecklistItem[]): number | null {
  if (items.length === 0) return null;
  const completed = items.filter((i) => i.is_completed).length;
  return Math.round((completed / items.length) * 1000) / 10;
}

/**
 * Fetch chronological DPR history for a project (most recent first)
 */
export async function getProjectDprHistory(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<DailyProgressReport[]> {
  const { data, error } = await (supabase.from("daily_progress_reports") as any)
    .select(`
      *,
      submitter:users!daily_progress_reports_submitted_by_fkey(full_name, email),
      checklist_items:dpr_checklist_items(*)
    `)
    .eq("project_id", projectId)
    .order("report_date", { ascending: false });

  if (error) {
    console.error("Error fetching DPR history:", error);
    return [];
  }

  return (data || []).map(withPpc);
}

/** Attach sorted checklist items and the derived PPC to a raw DPR row. */
function withPpc(row: any): DailyProgressReport {
  const items = ((row.checklist_items || []) as DprChecklistItem[])
    .slice()
    .sort((a, b) => a.sequence - b.sequence);

  return {
    ...row,
    checklist_items: items,
    ppc_percentage: calculatePpc(items),
  } as DailyProgressReport;
}

/**
 * Fetch today's DPR for a project (if submitted)
 */
export async function getTodayDpr(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<DailyProgressReport | null> {
  const todayStr = new Date().toISOString().split("T")[0];

  const { data, error } = await (supabase.from("daily_progress_reports") as any)
    .select(`
      *,
      submitter:users!daily_progress_reports_submitted_by_fkey(full_name, email),
      checklist_items:dpr_checklist_items(*)
    `)
    .eq("project_id", projectId)
    .eq("report_date", todayStr)
    .single();

  if (error || !data) {
    return null;
  }

  return withPpc(data);
}

/**
 * Replace a DPR's checklist items wholesale.
 *
 * The edit UI works on a local array (add/remove rows freely), so reconciling
 * individual inserts/updates/deletes client-side would be error-prone. Deleting
 * and re-inserting keeps the stored set exactly matching what the user sees.
 */
export async function saveDprChecklist(
  supabase: SupabaseClient<Database>,
  dprId: string,
  items: { description: string; is_completed: boolean }[]
): Promise<{ success: boolean; error?: string }> {
  const { error: deleteError } = await supabase
    .from("dpr_checklist_items")
    .delete()
    .eq("dpr_id", dprId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  const rows = items
    .filter((i) => i.description.trim())
    .map((i, index) => ({
      dpr_id: dprId,
      description: i.description.trim(),
      is_completed: i.is_completed,
      sequence: index,
    }));

  if (rows.length === 0) {
    return { success: true };
  }

  const { error: insertError } = await (supabase.from("dpr_checklist_items") as any).insert(rows);

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  return { success: true };
}

/**
 * PPC per report date for a project, oldest-first — feeds the Reports trend chart.
 * Reports with no checklist items are omitted (no plan recorded = no PPC).
 */
export async function getProjectPpcTrend(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<{ report_date: string; ppc: number }[]> {
  const history = await getProjectDprHistory(supabase, projectId);

  return history
    .filter((d) => d.ppc_percentage !== null && d.ppc_percentage !== undefined)
    .map((d) => ({ report_date: d.report_date, ppc: d.ppc_percentage as number }))
    .sort((a, b) => a.report_date.localeCompare(b.report_date));
}

/**
 * Submit or Update today's DPR
 */
export async function submitDpr(
  supabase: SupabaseClient<Database>,
  input: {
    project_id: string;
    weather: WeatherCondition;
    manpower_count: number;
    equipment_used: string;
    work_completed: string;
    delays_encountered?: string | null;
    photos_count?: number;
    existingId?: string;
  },
  userId: string
): Promise<{ success: boolean; data?: DailyProgressReport; error?: string }> {
  const todayStr = new Date().toISOString().split("T")[0];

  if (input.existingId) {
    // Update existing report
    const { data, error } = await (supabase.from("daily_progress_reports") as any)
      .update({
        weather: input.weather,
        manpower_count: input.manpower_count,
        equipment_used: input.equipment_used.trim(),
        work_completed: input.work_completed.trim(),
        delays_encountered: input.delays_encountered ? input.delays_encountered.trim() : null,
        photos_count: input.photos_count || 0,
      })
      .eq("id", input.existingId)
      .select(`
        *,
        submitter:users!daily_progress_reports_submitted_by_fkey(full_name, email)
      `)
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Failed to update DPR" };
    }

    return { success: true, data: data as DailyProgressReport };
  }

  // Insert new report
  const { data, error } = await (supabase.from("daily_progress_reports") as any)
    .insert({
      project_id: input.project_id,
      report_date: todayStr,
      submitted_by: userId,
      weather: input.weather,
      manpower_count: input.manpower_count,
      equipment_used: input.equipment_used.trim(),
      work_completed: input.work_completed.trim(),
      delays_encountered: input.delays_encountered ? input.delays_encountered.trim() : null,
      photos_count: input.photos_count || 0,
    })
    .select(`
      *,
      submitter:users!daily_progress_reports_submitted_by_fkey(full_name, email)
    `)
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to submit DPR" };
  }

  return { success: true, data: data as DailyProgressReport };
}

/**
 * Most recent PPC per project, keyed by project_id. Only reports that actually
 * have a checklist contribute, so a project with no plan recorded is absent
 * rather than showing a misleading 0%.
 */
export async function getLatestPpcByProject(
  supabase: SupabaseClient<Database>
): Promise<Record<string, { ppc: number; report_date: string }>> {
  const { data, error } = await (supabase.from("daily_progress_reports") as any)
    .select(`id, project_id, report_date, checklist_items:dpr_checklist_items(is_completed)`)
    .order("report_date", { ascending: false });

  if (error) {
    console.error("Error fetching PPC by project:", error);
    throw new Error(`Failed to load PPC indicators: ${error.message}`);
  }

  const latest: Record<string, { ppc: number; report_date: string }> = {};

  for (const row of data || []) {
    // Rows arrive newest-first, so the first hit per project wins
    if (latest[row.project_id]) continue;

    const items = (row.checklist_items || []) as { is_completed: boolean }[];
    if (items.length === 0) continue;

    const completed = items.filter((i) => i.is_completed).length;
    latest[row.project_id] = {
      ppc: Math.round((completed / items.length) * 1000) / 10,
      report_date: row.report_date,
    };
  }

  return latest;
}

/**
 * Fetch company-wide today DPR coverage (e.g. 3 of 4 projects reported today)
 */
export async function getDprCompanyStats(
  supabase: SupabaseClient<Database>
): Promise<{ totalProjects: number; reportedTodayCount: number; coveragePercent: number }> {
  const todayStr = new Date().toISOString().split("T")[0];

  const { data: projects } = await (supabase.from("projects") as any).select("id");
  const { data: reports } = await (supabase.from("daily_progress_reports") as any)
    .select("project_id")
    .eq("report_date", todayStr);

  const totalProjects = projects?.length || 0;
  const reportedTodayCount = reports?.length || 0;
  const coveragePercent = totalProjects > 0 ? Math.round((reportedTodayCount / totalProjects) * 100) : 0;

  return {
    totalProjects,
    reportedTodayCount,
    coveragePercent,
  };
}
