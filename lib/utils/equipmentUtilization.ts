export interface StatusHistoryEntry {
  equipment_id: string;
  status: string;
  changed_at: string; // ISO timestamp
}

export interface UtilizationResult {
  utilizationPct: number; // % of tracked time spent 'in_use'
  idlePct: number; // % of tracked time spent 'available'
  maintenancePct: number; // % of tracked time spent 'maintenance'
  trackedDays: number;
}

const MIN_TRACKED_DAYS_FOR_SIGNAL = 1;

/**
 * Turns a status-change log (supabase/migrations/0047_equipment_status_history.sql)
 * into a real utilization % per asset — the fraction of tracked elapsed time
 * each asset actually spent 'in_use', not a point-in-time snapshot. Assets
 * with under a day of tracked history return trackedDays < 1 so the UI can
 * show "not enough data yet" instead of a misleading 0%.
 */
export function computeEquipmentUtilization(
  history: StatusHistoryEntry[],
  asOf: Date = new Date()
): Map<string, UtilizationResult> {
  const byEquipment = new Map<string, StatusHistoryEntry[]>();
  for (const h of history) {
    const list = byEquipment.get(h.equipment_id) || [];
    list.push(h);
    byEquipment.set(h.equipment_id, list);
  }

  const result = new Map<string, UtilizationResult>();
  for (const [equipmentId, entries] of byEquipment) {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    );

    let inUseMs = 0;
    let availableMs = 0;
    let maintenanceMs = 0;
    let totalMs = 0;

    for (let i = 0; i < sorted.length; i++) {
      const start = new Date(sorted[i].changed_at).getTime();
      const end = i + 1 < sorted.length ? new Date(sorted[i + 1].changed_at).getTime() : asOf.getTime();
      const dur = Math.max(0, end - start);
      totalMs += dur;
      if (sorted[i].status === "in_use") inUseMs += dur;
      else if (sorted[i].status === "available") availableMs += dur;
      else if (sorted[i].status === "maintenance") maintenanceMs += dur;
    }

    result.set(equipmentId, {
      utilizationPct: totalMs > 0 ? Math.round((inUseMs / totalMs) * 1000) / 10 : 0,
      idlePct: totalMs > 0 ? Math.round((availableMs / totalMs) * 1000) / 10 : 0,
      maintenancePct: totalMs > 0 ? Math.round((maintenanceMs / totalMs) * 1000) / 10 : 0,
      trackedDays: Math.round((totalMs / 86_400_000) * 10) / 10,
    });
  }
  return result;
}

export function hasEnoughSignal(u: UtilizationResult): boolean {
  return u.trackedDays >= MIN_TRACKED_DAYS_FOR_SIGNAL;
}
