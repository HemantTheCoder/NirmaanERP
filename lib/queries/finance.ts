import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/types/database";

export type ExpenseCategory =
  | "labor"
  | "materials"
  | "equipment_rental"
  | "subcontractor"
  | "other";

export type ExpenseStatus = "pending" | "approved" | "rejected";

export interface ExpenseItem {
  id: string;
  project_id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  logged_by: string;
  status: ExpenseStatus;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  cost_code_id: string | null;
  logger?: {
    full_name: string;
    email: string;
  } | null;
  approver?: {
    full_name: string;
    email: string;
  } | null;
  cost_code?: {
    code: string;
    name: string;
  } | null;
}

export interface CostCodeBudgetLine {
  costCodeId: string;
  code: string;
  name: string;
  budgetedAmount: number;
  approvedSpend: number;
  pendingSpend: number;
  variance: number; // positive = under budget
}

export interface ProjectBudgetSummary {
  budgetAllocated: number | null;
  totalApprovedSpend: number;
  totalPendingSpend: number;
  remainingBudget: number | null;
  usedPercentage: number | null;
  categoryBreakdown: Record<ExpenseCategory, number>;
  costCodeBreakdown: CostCodeBudgetLine[];
  expenses: ExpenseItem[];
}

export interface CompanyBudgetAnalytics {
  totalAllocatedBudget: number;
  totalApprovedExpenses: number;
  overallUtilizationPercent: number;
  projectCostVariances: {
    projectId: string;
    projectName: string;
    budgetAllocated: number;
    approvedSpend: number;
    variance: number; // positive = under budget (emerald), negative = over budget (rose)
    variancePercent: number;
  }[];
}

/**
 * Fetch budget summary and expense list for a specific project
 */
export async function getProjectBudgetSummary(
  supabase: SupabaseClient<Database>,
  projectId: string,
  userId: string,
  role: UserRole
): Promise<ProjectBudgetSummary> {
  // 1. Fetch project budget_allocated (Admin / PM only)
  const isStaff = role === "admin" || role === "project_manager";

  const { data: projData } = isStaff
    ? await (supabase.from("projects") as any)
        .select("budget_allocated")
        .eq("id", projectId)
        .single()
    : { data: null };

  const budgetAllocated = isStaff && projData?.budget_allocated
    ? Number(projData.budget_allocated)
    : null;

  // 2. Fetch expenses for this project (RLS automatically filters for site_staff)
  let query = (supabase.from("expenses") as any)
    .select(`
      *,
      logger:users!expenses_logged_by_fkey(full_name, email),
      approver:users!expenses_approved_by_fkey(full_name, email),
      cost_code:cost_codes(code, name)
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const { data: rawExpenses, error } = await query;

  // Cost codes are their own small per-project table (lib/queries/costCodes.ts
  // owns the CRUD); fetched here too so the breakdown can be computed even for
  // codes with zero expenses logged against them yet.
  const { data: rawCostCodes } = await (supabase.from("cost_codes") as any)
    .select("*")
    .eq("project_id", projectId);

  if (error || !rawExpenses) {
    console.error("Error fetching project expenses:", error);
    return {
      budgetAllocated,
      totalApprovedSpend: 0,
      totalPendingSpend: 0,
      remainingBudget: budgetAllocated,
      usedPercentage: 0,
      categoryBreakdown: {
        labor: 0,
        materials: 0,
        equipment_rental: 0,
        subcontractor: 0,
        other: 0,
      },
      costCodeBreakdown: [],
      expenses: [],
    };
  }

  const expenses = (rawExpenses || []).map((e: any) => ({
    ...e,
    amount: Number(e.amount),
  })) as ExpenseItem[];

  // 3. Compute totals and breakdown
  let totalApprovedSpend = 0;
  let totalPendingSpend = 0;

  const categoryBreakdown: Record<ExpenseCategory, number> = {
    labor: 0,
    materials: 0,
    equipment_rental: 0,
    subcontractor: 0,
    other: 0,
  };

  expenses.forEach((e) => {
    if (e.status === "approved") {
      totalApprovedSpend += e.amount;
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
    } else if (e.status === "pending") {
      totalPendingSpend += e.amount;
    }
  });

  const remainingBudget = budgetAllocated !== null ? budgetAllocated - totalApprovedSpend : null;
  const usedPercentage =
    budgetAllocated && budgetAllocated > 0
      ? Math.round((totalApprovedSpend / budgetAllocated) * 100)
      : null;

  // 4. Budget-vs-actual per cost code (only meaningful for admin/pm, same as
  // budgetAllocated above — site_staff still gets cost codes on the expense
  // form, just not this comparison view).
  const costCodeBreakdown: CostCodeBudgetLine[] = isStaff
    ? (rawCostCodes || []).map((c: any) => {
        const linkedExpenses = expenses.filter((e) => e.cost_code_id === c.id);
        const approvedSpend = linkedExpenses.filter((e) => e.status === "approved").reduce((s, e) => s + e.amount, 0);
        const pendingSpend = linkedExpenses.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);
        const budgetedAmount = Number(c.budgeted_amount);
        return {
          costCodeId: c.id,
          code: c.code,
          name: c.name,
          budgetedAmount,
          approvedSpend,
          pendingSpend,
          variance: budgetedAmount - approvedSpend,
        };
      })
    : [];

  return {
    budgetAllocated,
    totalApprovedSpend,
    totalPendingSpend,
    remainingBudget,
    usedPercentage,
    categoryBreakdown,
    costCodeBreakdown,
    expenses,
  };
}

/**
 * Log a new expense (site_staff, pm, admin) with status = 'pending'
 */
export async function logExpense(
  supabase: SupabaseClient<Database>,
  input: {
    project_id: string;
    category: ExpenseCategory;
    amount: number;
    description: string;
    cost_code_id?: string | null;
  },
  userId: string
): Promise<{ success: boolean; data?: ExpenseItem; error?: string }> {
  const { data, error } = await (supabase.from("expenses") as any)
    .insert({
      project_id: input.project_id,
      category: input.category,
      amount: input.amount,
      description: input.description.trim(),
      cost_code_id: input.cost_code_id || null,
      logged_by: userId,
      status: "pending",
    })
    .select(`
      *,
      logger:users!expenses_logged_by_fkey(full_name, email),
      cost_code:cost_codes(code, name)
    `)
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to log expense" };
  }

  return { success: true, data: { ...data, amount: Number(data.amount) } as ExpenseItem };
}

/**
 * Approve or Reject an expense (admin / pm only)
 */
export async function updateExpenseStatus(
  supabase: SupabaseClient<Database>,
  expenseId: string,
  status: "approved" | "rejected",
  reviewerId: string,
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  const updates: any = {
    status,
    approved_by: reviewerId,
    approved_at: new Date().toISOString(),
  };

  if (status === "rejected") {
    updates.rejection_reason = rejectionReason || "Expense request rejected.";
  }

  const { error } = await (supabase.from("expenses") as any)
    .update(updates)
    .eq("id", expenseId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Fetch company-wide budget analytics for ReportsView
 */
export async function getCompanyBudgetAnalytics(
  supabase: SupabaseClient<Database>
): Promise<CompanyBudgetAnalytics> {
  // Fetch projects with budget_allocated
  const { data: projects } = await (supabase.from("projects") as any)
    .select("id, name, budget_allocated")
    .order("name");

  // Fetch all approved expenses
  const { data: approvedExpenses } = await (supabase.from("expenses") as any)
    .select("project_id, amount")
    .eq("status", "approved");

  let totalAllocatedBudget = 0;
  let totalApprovedExpenses = 0;

  const spendByProject: Record<string, number> = {};
  (approvedExpenses || []).forEach((e: any) => {
    spendByProject[e.project_id] = (spendByProject[e.project_id] || 0) + Number(e.amount);
    totalApprovedExpenses += Number(e.amount);
  });

  const projectCostVariances = (projects || []).map((p: any) => {
    const budget = p.budget_allocated ? Number(p.budget_allocated) : 0;
    const spend = spendByProject[p.id] || 0;
    const variance = budget - spend; // positive = under budget, negative = over budget
    const variancePercent = budget > 0 ? Math.round((variance / budget) * 100) : 0;

    totalAllocatedBudget += budget;

    return {
      projectId: p.id,
      projectName: p.name,
      budgetAllocated: budget,
      approvedSpend: spend,
      variance,
      variancePercent,
    };
  });

  const overallUtilizationPercent =
    totalAllocatedBudget > 0
      ? Math.round((totalApprovedExpenses / totalAllocatedBudget) * 100)
      : 0;

  return {
    totalAllocatedBudget,
    totalApprovedExpenses,
    overallUtilizationPercent,
    projectCostVariances,
  };
}
