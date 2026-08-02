import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface AuditLogItem {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: any;
  ip_address?: string | null;
  created_at: string;
  user?: {
    full_name: string;
    email: string;
    role: string;
  } | null;
}

/**
  Write audit log entry to public.audit_logs
 */
export async function logAudit(
  supabase: SupabaseClient<Database>,
  params: {
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    details?: any;
  }
) {
  try {
    await (supabase.from("audit_logs") as any).insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      details: params.details || {},
    });
  } catch (err) {
    console.warn("Notice: Audit log insertion error:", err);
  }
}

/**
  Fetch audit log history for Admin Overview
 */
export async function getAuditLogs(
  supabase: SupabaseClient<Database>,
  limit: number = 20
): Promise<AuditLogItem[]> {
  const { data, error } = await (supabase.from("audit_logs") as any)
    .select(`
      *,
      user:users(full_name, email, role)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("Error fetching audit logs:", error);
    return [];
  }

  return data as AuditLogItem[];
}
