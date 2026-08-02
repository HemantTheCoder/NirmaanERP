import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface KpiSnapshotItem {
  id: string;
  snapshot_date: string;
  active_projects_count: number;
  open_tasks_count: number;
  team_members_count: number;
  pending_leaves_count: number;
  in_use_resources_count: number;
  created_at: string;
}

/**
  Record daily KPI snapshot into public.kpi_snapshots
 */
export async function recordKpiSnapshot(
  supabase: SupabaseClient<Database>,
  counts: {
    activeProjects: number;
    openTasks: number;
    teamMembers: number;
    pendingLeaves: number;
    inUseResources: number;
  }
) {
  try {
    const today = new Date().toISOString().split("T")[0];
    await (supabase.from("kpi_snapshots") as any).upsert(
      {
        snapshot_date: today,
        active_projects_count: counts.activeProjects,
        open_tasks_count: counts.openTasks,
        team_members_count: counts.teamMembers,
        pending_leaves_count: counts.pendingLeaves,
        in_use_resources_count: counts.inUseResources,
      },
      { onConflict: "snapshot_date" }
    );
  } catch (err) {
    console.warn("Notice: KPI snapshot recording error:", err);
  }
}

/**
  Fetch historical KPI snapshot trends
 */
export async function getKpiSnapshots(
  supabase: SupabaseClient<Database>,
  limit: number = 7
): Promise<KpiSnapshotItem[]> {
  const { data, error } = await (supabase.from("kpi_snapshots") as any)
    .select("*")
    .order("snapshot_date", { ascending: true })
    .limit(limit);

  if (error || !data) {
    console.error("Error fetching KPI snapshots:", error);
    return [];
  }

  return data as KpiSnapshotItem[];
}
