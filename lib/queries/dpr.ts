import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type WeatherCondition = "clear" | "rain" | "overcast" | "extreme_heat" | "other";

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
      submitter:users!daily_progress_reports_submitted_by_fkey(full_name, email)
    `)
    .eq("project_id", projectId)
    .order("report_date", { ascending: false });

  if (error) {
    console.error("Error fetching DPR history:", error);
    return [];
  }

  return (data || []) as DailyProgressReport[];
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
      submitter:users!daily_progress_reports_submitted_by_fkey(full_name, email)
    `)
    .eq("project_id", projectId)
    .eq("report_date", todayStr)
    .single();

  if (error || !data) {
    return null;
  }

  return data as DailyProgressReport;
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
