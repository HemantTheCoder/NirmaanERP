import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type DelayStatus = "open" | "rectified";

export interface ProjectDelay {
  id: string;
  project_id: string;
  project_name?: string | null;
  dpr_id: string | null;
  reported_by: string;
  reporter_name?: string | null;
  reported_date: string; // YYYY-MM-DD
  reason: string;
  status: DelayStatus;
  rectified_by: string | null;
  rectifier_name?: string | null;
  rectified_at: string | null;
  rectification_notes: string | null;
  created_at: string;
  /** Whole days from reported_date to rectified_at; null while still open. */
  days_to_rectify?: number | null;
}

const DELAY_SELECT = `
  *,
  projects ( name ),
  reporter:users!project_delays_reported_by_fkey ( full_name ),
  rectifier:users!project_delays_rectified_by_fkey ( full_name )
`;

function mapDelay(row: any): ProjectDelay {
  let days_to_rectify: number | null = null;

  if (row.rectified_at && row.reported_date) {
    const reported = new Date(`${row.reported_date}T00:00:00Z`).getTime();
    const rectified = new Date(row.rectified_at).getTime();
    // Same-day rectification counts as 0 days, not a negative or fractional value
    days_to_rectify = Math.max(0, Math.floor((rectified - reported) / 86_400_000));
  }

  return {
    id: row.id,
    project_id: row.project_id,
    project_name: row.projects?.name ?? null,
    dpr_id: row.dpr_id,
    reported_by: row.reported_by,
    reporter_name: row.reporter?.full_name ?? null,
    reported_date: row.reported_date,
    reason: row.reason,
    status: row.status as DelayStatus,
    rectified_by: row.rectified_by,
    rectifier_name: row.rectifier?.full_name ?? null,
    rectified_at: row.rectified_at,
    rectification_notes: row.rectification_notes,
    created_at: row.created_at,
    days_to_rectify,
  };
}

/**
 * The project's currently active delay, or null if it is on track.
 * At most one open delay can exist per project (enforced by a partial unique
 * index), so this returns a single row rather than a list.
 */
export async function getOpenDelay(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<ProjectDelay | null> {
  const { data, error } = await (supabase.from("project_delays") as any)
    .select(DELAY_SELECT)
    .eq("project_id", projectId)
    .eq("status", "open")
    .maybeSingle();

  if (error) {
    console.error("Error fetching open delay:", error);
    throw new Error(`Failed to load delay status: ${error.message}`);
  }

  return data ? mapDelay(data) : null;
}

/**
 * Full delay log for a project, newest first (open and rectified).
 */
export async function getDelayHistory(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<ProjectDelay[]> {
  const { data, error } = await (supabase.from("project_delays") as any)
    .select(DELAY_SELECT)
    .eq("project_id", projectId)
    .order("reported_date", { ascending: false });

  if (error) {
    console.error("Error fetching delay history:", error);
    throw new Error(`Failed to load delay history: ${error.message}`);
  }

  return (data || []).map(mapDelay);
}

/**
 * Portfolio-wide delay log for the Reports module.
 */
export async function getAllDelays(
  supabase: SupabaseClient<Database>
): Promise<ProjectDelay[]> {
  const { data, error } = await (supabase.from("project_delays") as any)
    .select(DELAY_SELECT)
    .order("reported_date", { ascending: false });

  if (error) {
    console.error("Error fetching all delays:", error);
    throw new Error(`Failed to load delays: ${error.message}`);
  }

  return (data || []).map(mapDelay);
}

/**
 * Report a new delay.
 *
 * A project can only carry one open delay at a time. That is enforced by a
 * partial unique index, but we check first so the caller gets a readable
 * message instead of a raw constraint violation.
 */
export async function reportDelay(
  supabase: SupabaseClient<Database>,
  input: {
    projectId: string;
    reason: string;
    reportedBy: string;
    dprId?: string | null;
  }
): Promise<{ success: boolean; data?: ProjectDelay; error?: string }> {
  const existing = await getOpenDelay(supabase, input.projectId);
  if (existing) {
    return {
      success: false,
      error: `This project already has an open delay (reported ${existing.reported_date}). Mark it rectified before reporting a new one.`,
    };
  }

  const { data, error } = await (supabase.from("project_delays") as any)
    .insert({
      project_id: input.projectId,
      reason: input.reason.trim(),
      reported_by: input.reportedBy,
      dpr_id: input.dprId ?? null,
    })
    .select(DELAY_SELECT)
    .single();

  if (error) {
    // Losing the race against a concurrent report still lands here
    if (error.code === "23505") {
      return {
        success: false,
        error: "Another open delay was just reported for this project. Refresh to see it.",
      };
    }
    return { success: false, error: error.message };
  }

  return { success: true, data: mapDelay(data) };
}

/**
 * Mark a delay rectified. Restricted to admin/project_manager by RLS —
 * closing a delay is a management sign-off.
 */
export async function rectifyDelay(
  supabase: SupabaseClient<Database>,
  delayId: string,
  notes: string,
  rectifiedBy: string
): Promise<{ success: boolean; data?: ProjectDelay; error?: string }> {
  const { data, error } = await (supabase.from("project_delays") as any)
    .update({
      status: "rectified",
      rectified_by: rectifiedBy,
      rectified_at: new Date().toISOString(),
      rectification_notes: notes.trim() || null,
    })
    .eq("id", delayId)
    .eq("status", "open")
    .select(DELAY_SELECT)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data) {
    return {
      success: false,
      error: "This delay is no longer open — it may have already been rectified.",
    };
  }

  return { success: true, data: mapDelay(data) };
}

/**
 * Open delay per project, keyed by project_id — lets the projects list show a
 * delay indicator without issuing one query per card.
 */
export async function getOpenDelaysByProject(
  supabase: SupabaseClient<Database>
): Promise<Record<string, ProjectDelay>> {
  const { data, error } = await (supabase.from("project_delays") as any)
    .select(DELAY_SELECT)
    .eq("status", "open");

  if (error) {
    console.error("Error fetching open delays by project:", error);
    throw new Error(`Failed to load delay indicators: ${error.message}`);
  }

  const byProject: Record<string, ProjectDelay> = {};
  for (const row of data || []) {
    const delay = mapDelay(row);
    byProject[delay.project_id] = delay;
  }
  return byProject;
}

/** Mean days-to-rectify across a set of delays; null when none are closed. */
export function averageDaysToRectify(delays: ProjectDelay[]): number | null {
  const closed = delays.filter((d) => d.days_to_rectify !== null && d.days_to_rectify !== undefined);
  if (closed.length === 0) return null;
  const total = closed.reduce((sum, d) => sum + (d.days_to_rectify as number), 0);
  return Math.round((total / closed.length) * 10) / 10;
}
