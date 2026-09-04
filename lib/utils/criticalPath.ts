export interface CPTask {
  id: string;
  start_date?: string | null;
  due_date?: string | null;
  created_at: string;
}

export interface CPLink {
  task_id: string;
  depends_on_task_id: string;
}

export interface CriticalPathResult {
  criticalTaskIds: Set<string>;
  /** `${task_id}->${depends_on_task_id}` */
  criticalLinkKeys: Set<string>;
  projectDurationDays: number;
}

function durationDays(t: CPTask): number {
  const s = new Date(t.start_date || t.created_at.slice(0, 10)).getTime();
  const d = new Date(t.due_date || t.start_date || t.created_at.slice(0, 10)).getTime();
  return Math.max(1, Math.ceil((d - s) / 86400000) + 1);
}

/**
 * Longest path through the dependency DAG, weighted by task duration —
 * the classic critical-path formulation (without float/slack, which would
 * need a second backward pass; not required just to highlight the chain).
 * Pure client-side, over the already-fetched tasks + links for a project.
 *
 * Runs Kahn's-algorithm topological sort, then a DP pass computing each
 * task's earliest-finish from its predecessors, then backtracks from the
 * max-finish task to mark every task/link on that chain.
 */
export function computeCriticalPath(tasks: CPTask[], links: CPLink[]): CriticalPathResult {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const t of tasks) {
    predecessors.set(t.id, []);
    successors.set(t.id, []);
  }
  for (const l of links) {
    if (!byId.has(l.task_id) || !byId.has(l.depends_on_task_id)) continue; // stale/cross-project link guard
    predecessors.get(l.task_id)!.push(l.depends_on_task_id);
    successors.get(l.depends_on_task_id)!.push(l.task_id);
  }

  const indegree = new Map<string, number>();
  for (const t of tasks) indegree.set(t.id, predecessors.get(t.id)!.length);
  const queue = tasks.filter((t) => indegree.get(t.id) === 0).map((t) => t.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const succ of successors.get(id) || []) {
      indegree.set(succ, indegree.get(succ)! - 1);
      if (indegree.get(succ) === 0) queue.push(succ);
    }
  }
  // Nodes left with indegree > 0 here mean a cycle slipped through (shouldn't
  // happen given the DB trigger) — they're simply excluded below rather than
  // risking an infinite loop, since `order` only contains resolved nodes.

  const earliestFinish = new Map<string, number>();
  const bestPred = new Map<string, string | null>();
  for (const id of order) {
    const t = byId.get(id)!;
    const preds = predecessors.get(id) || [];
    if (preds.length === 0) {
      earliestFinish.set(id, durationDays(t));
      bestPred.set(id, null);
    } else {
      let best = -Infinity;
      let bestP: string | null = null;
      for (const p of preds) {
        const v = earliestFinish.get(p) ?? 0;
        if (v > best) {
          best = v;
          bestP = p;
        }
      }
      earliestFinish.set(id, best + durationDays(t));
      bestPred.set(id, bestP);
    }
  }

  let endId: string | null = null;
  let maxFinish = -Infinity;
  for (const [id, finish] of earliestFinish) {
    if (finish > maxFinish) {
      maxFinish = finish;
      endId = id;
    }
  }

  const criticalTaskIds = new Set<string>();
  const criticalLinkKeys = new Set<string>();
  let cur = endId;
  while (cur) {
    criticalTaskIds.add(cur);
    const p = bestPred.get(cur) ?? null;
    if (p) criticalLinkKeys.add(`${cur}->${p}`);
    cur = p;
  }

  return {
    criticalTaskIds,
    criticalLinkKeys,
    projectDurationDays: maxFinish === -Infinity ? 0 : maxFinish,
  };
}

/** Does adding `task_id depends_on candidateDependsOnId` create a cycle,
 * given the links that already exist? True if `candidateDependsOnId` can
 * already transitively reach `taskId` through existing dependency edges. */
export function wouldCreateCycle(taskId: string, candidateDependsOnId: string, links: CPLink[]): boolean {
  if (taskId === candidateDependsOnId) return true;

  const dependsOn = new Map<string, string[]>();
  for (const l of links) {
    if (!dependsOn.has(l.task_id)) dependsOn.set(l.task_id, []);
    dependsOn.get(l.task_id)!.push(l.depends_on_task_id);
  }

  const visited = new Set<string>();
  const stack = [candidateDependsOnId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === taskId) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of dependsOn.get(cur) || []) stack.push(next);
  }
  return false;
}
