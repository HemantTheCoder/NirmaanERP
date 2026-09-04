export interface ReorderInputItem {
  id: string;
  quantity_on_hand: number;
  reorder_level: number;
  unit: string;
}

export interface ReorderInputTransaction {
  inventory_item_id: string;
  transaction_type: string;
  quantity: number;
  transaction_date: string; // YYYY-MM-DD
}

export type ReorderUrgency = "critical" | "soon";

export interface ReorderSuggestion {
  avgDailyConsumption: number;
  daysUntilStockout: number;
  suggestedReorderQty: number;
  urgency: ReorderUrgency;
}

const WINDOW_DAYS = 30;
const STOCKOUT_HORIZON_DAYS = 14;
const CRITICAL_HORIZON_DAYS = 5;
const TARGET_BUFFER_DAYS = 30;

/**
 * Flags items trending toward a stockout based on actual issue-transaction
 * volume over the trailing window, not just the static reorder_level
 * threshold — so an item burning down fast gets flagged before it actually
 * crosses that line. Items with no measurable consumption trend are left
 * to the existing quantity_on_hand <= reorder_level check instead, since
 * there's nothing here to project from.
 */
export function computeReorderSuggestions(
  items: ReorderInputItem[],
  transactions: ReorderInputTransaction[],
  todayStr: string = new Date().toISOString().slice(0, 10)
): Map<string, ReorderSuggestion> {
  const windowStart = new Date(todayStr);
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);
  const windowStartStr = windowStart.toISOString().slice(0, 10);

  const issuedByItem = new Map<string, number>();
  for (const t of transactions) {
    if (t.transaction_type !== "issue") continue;
    if (t.transaction_date < windowStartStr || t.transaction_date > todayStr) continue;
    issuedByItem.set(t.inventory_item_id, (issuedByItem.get(t.inventory_item_id) || 0) + t.quantity);
  }

  const result = new Map<string, ReorderSuggestion>();
  for (const item of items) {
    const totalIssued = issuedByItem.get(item.id) || 0;
    const avgDailyConsumption = totalIssued / WINDOW_DAYS;
    if (avgDailyConsumption <= 0) continue;

    const daysUntilStockout = Math.floor(item.quantity_on_hand / avgDailyConsumption);
    const alreadyBelowReorderLevel = item.quantity_on_hand <= item.reorder_level;
    if (daysUntilStockout > STOCKOUT_HORIZON_DAYS && !alreadyBelowReorderLevel) continue;

    const targetStock = avgDailyConsumption * TARGET_BUFFER_DAYS;
    const suggestedReorderQty = Math.max(0, Math.ceil(targetStock - item.quantity_on_hand));
    if (suggestedReorderQty <= 0) continue;

    result.set(item.id, {
      avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
      daysUntilStockout,
      suggestedReorderQty,
      urgency: daysUntilStockout <= CRITICAL_HORIZON_DAYS || alreadyBelowReorderLevel ? "critical" : "soon",
    });
  }

  return result;
}
