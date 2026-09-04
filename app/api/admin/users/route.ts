import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { checkUserOrphanStatus } from "@/lib/queries/admin";

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in server env");
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Verify caller session & role is admin
 */
async function verifyAdminCaller() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, error: "Unauthenticated", status: 401 };
  }

  const { data: profile } = await (supabase.from("users") as any)
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { authorized: false, error: "Forbidden: Admin access required", status: 403 };
  }

  return { authorized: true, callerId: user.id };
}

import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/admin/users — Create / Invite new user
 */
export async function POST(req: Request) {
  try {
    const authCheck = await verifyAdminCaller();
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const rateCheck = checkRateLimit(`admin-invite:${authCheck.callerId}`, 10, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Too many user invitations created in a short window. Try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, full_name, role, client_project_id } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    if (role === "client" && !client_project_id) {
      return NextResponse.json(
        { error: "A linked project is required when inviting a client account" },
        { status: 400 }
      );
    }

    const serviceClient = getServiceRoleClient();

    // Validate the target project up front, before creating any account, so a
    // bad project pick fails clean instead of leaving an orphaned auth user.
    if (role === "client" && client_project_id) {
      const { data: project, error: projectErr } = await (serviceClient.from("projects") as any)
        .select("id, name, client_id")
        .eq("id", client_project_id)
        .maybeSingle();

      if (projectErr || !project) {
        return NextResponse.json({ error: "Selected project not found" }, { status: 400 });
      }

      if (project.client_id) {
        return NextResponse.json(
          {
            error: `"${project.name}" is already linked to a different client account. Unlink it from Edit Project first.`,
          },
          { status: 400 }
        );
      }
    }

    const tempPassword = "Demo@" + Math.random().toString(36).slice(-6) + "1!";

    // Create auth user with email_confirm: true so user can log in immediately
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create user account" },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // Upsert matching public.users row
    const { error: publicErr } = await (serviceClient.from("users") as any).upsert({
      id: userId,
      email,
      full_name: full_name || null,
      role,
      is_active: true,
    });

    if (publicErr) {
      return NextResponse.json(
        { error: "Auth user created, but failed to create public profile: " + publicErr.message },
        { status: 500 }
      );
    }

    // Link the client to their project. Best-effort: the account itself is
    // already provisioned at this point, so a failure here is surfaced as a
    // warning rather than rolling back the whole invite.
    let linkWarning: string | undefined;
    if (role === "client" && client_project_id) {
      const { error: linkErr } = await (serviceClient.from("projects") as any)
        .update({ client_id: userId })
        .eq("id", client_project_id);

      if (linkErr) {
        linkWarning = `Account created, but linking to the project failed: ${linkErr.message}. Link it manually from Edit Project.`;
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        full_name,
        role,
        tempPassword,
      },
      warning: linkWarning,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users — Hard delete user (after orphan check & auth cleanup)
 */
export async function DELETE(req: Request) {
  try {
    const authCheck = await verifyAdminCaller();
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: "Target user ID is required" }, { status: 400 });
    }

    const serviceClient = getServiceRoleClient();

    // 1. Run 7-table orphan check & Last Admin Guard
    const orphanCheck = await checkUserOrphanStatus(serviceClient, targetUserId);
    if (!orphanCheck.canDelete) {
      return NextResponse.json(
        {
          error: "Cannot delete user. " + orphanCheck.reasons.join(". "),
          reasons: orphanCheck.reasons,
        },
        { status: 400 }
      );
    }

    // 2. Delete public.users row
    const { error: deletePublicErr } = await (serviceClient.from("users") as any)
      .delete()
      .eq("id", targetUserId);

    if (deletePublicErr) {
      return NextResponse.json(
        { error: "Failed to delete user profile: " + deletePublicErr.message },
        { status: 500 }
      );
    }

    // 3. Delete underlying auth.users account so email is freed for future invites
    const { error: deleteAuthErr } = await serviceClient.auth.admin.deleteUser(targetUserId);

    if (deleteAuthErr) {
      console.warn("Deleted public profile, but auth delete failed:", deleteAuthErr.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
