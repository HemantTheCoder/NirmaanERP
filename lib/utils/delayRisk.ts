import type { CPLink } from "./criticalPath";

export type RiskLevel = "high" | "medium";

export interface TaskDelayRisk {
  score: number; // 0-100
  level: RiskLevel;
  reasons: string[];
}

export interface RiskInputTask {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "review" | "done";
  due_date?: string | null;
}

export interface RiskProjectSignals {
  /** Count of delays ever logged for this project (open + rectified). */
  pastDelayCount: number;
  avgDaysToRectify: number | null;
  /** Purchase orders on this project still open with an expected_delivery_date already past. */
  overdueVendorDeliveries: number;
}

const DAY_MS = 86_400_000;

function daysUntil(dateStr: string, todayStr: string): number {
  return Math.round((new Date(dateStr).getTime() - new Date(todayStr).getTime()) / DAY_MS);
}

/**
 * Flags tasks trending toward a delay before they're actually overdue —
 * combines schedule proximity, a predecessor-risk cascade, critical-path
 * amplification, and the project's own delay/procurement track record.
 * Already-overdue or done tasks are excluded: overdue is handled by the
 * Gantt's existing styling, and this is meant to be predictive, not a
 * restatement of what's already visibly late.
 */
export function computeDelayRisk(
  tasks: RiskInputTask[],
  links: CPLink[],
  criticalTaskIds: Set<string>,
  projectSignals: RiskProjectSignals,
  todayStr: string = new Date().toISOString().slice(0, 10)
): Map<string, TaskDelayRisk> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const predecessors = new Map<string, string[]>();
  for (const t of tasks) predecessors.set(t.id, []);
  for (const l of links) {
    if (!byId.has(l.task_id) || !byId.has(l.depends_on_task_id)) continue;
    predecessors.get(l.task_id)!.push(l.depends_on_task_id);
  }

  const isOverdue = (t: RiskInputTask) => !!t.due_date && t.due_date < todayStr && t.status !== "done";

  const result = new Map<string, TaskDelayRisk>();

  for (const t of tasks) {
    if (t.status === "done" || isOverdue(t)) continue;

    let score = 0;
    const reasons: string[] = [];

    // 1. Schedule proximity — due imminently and not yet finished
    if (t.due_date) {
      const remaining = daysUntil(t.due_date, todayStr);
      if (remaining >= 0 && remaining <= 3) {
        score += t.status === "in_progress" ? 25 : 35;
        reasons.push(remaining === 0 ? "Due today" : `Due in ${remaining} day${remaining === 1 ? "" : "s"}`);
      }
    }

    // 2. Blocked by an already-overdue predecessor
    for (const predId of predecessors.get(t.id) || []) {
      const pred = byId.get(predId);
      if (pred && isOverdue(pred)) {
        score += 40;
        reasons.push(`Blocked by overdue predecessor "${pred.title}"`);
      }
    }

    // 3. Critical-path amplifier — only matters once something is already at risk
    if (score > 0 && criticalTaskIds.has(t.id)) {
      score = Math.round(score * 1.3);
      reasons.push("On the critical path — a slip here delays the whole project");
    }

    // 4. Project's own delay track record — nudges, doesn't create risk alone
    if (score > 0 && projectSignals.pastDelayCount >= 2) {
      score += 10;
      reasons.push(
        `Project has ${projectSignals.pastDelayCount} logged delays` +
          (projectSignals.avgDaysToRectify != null ? ` (avg ${projectSignals.avgDaysToRectify}d to resolve)` : "")
      );
    }

    // 5. Procurement exposure — materials already late could stall this task
    if (score > 0 && projectSignals.overdueVendorDeliveries > 0) {
      score += 15;
      reasons.push(
        `${projectSignals.overdueVendorDeliveries} purchase order${
          projectSignals.overdueVendorDeliveries === 1 ? "" : "s"
        } overdue for delivery on this project`
      );
    }

    score = Math.min(100, score);
    if (score >= 30) {
      result.set(t.id, { score, level: score >= 60 ? "high" : "medium", reasons });
    }
  }

  return result;
}
