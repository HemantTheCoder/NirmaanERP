"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Calendar,
  UserCheck,
  Download,
  AlertCircle,
  Loader2,
  GanttChart,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  File,
  ShieldCheck,
  Receipt,
  IndianRupee,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { approveProjectProgress, type ClientProjectItem } from "@/lib/queries/client";
import { getDocumentSignedUrl, type ProjectDocumentItem } from "@/lib/queries/documents";
import { createSignatureAcknowledgment } from "@/lib/queries/signatures";
import { SignatureConfirmModal } from "@/components/shared/SignatureConfirmModal";
import { ProjectGanttChart } from "@/components/projects/ProjectGanttChart";
import { StatusBadge } from "@/components/projects/StatusBadge";
import type { UpcomingMeetingItem } from "@/lib/queries/meetings";
import type { BillingMilestone, BillingMilestoneStatus } from "@/lib/queries/billing";
import type { WarrantyClaim } from "@/lib/queries/warranty";
import { WarrantyClaimsView } from "@/components/projects/WarrantyClaimsView";
import { cn } from "@/lib/utils";

interface ClientPortalViewProps {
  user: {
    id: string;
    email: string;
    full_name: string | null;
  };
  projects: ClientProjectItem[];
  initialDocuments: ProjectDocumentItem[];
  meetings: UpcomingMeetingItem[];
  initialBillingMilestones: BillingMilestone[];
  initialWarrantyClaims: WarrantyClaim[];
}

const CLIENT_BILLING_STATUS_BADGES: Record<BillingMilestoneStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  invoiced: { label: "Invoice Sent", bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  paid: { label: "Paid", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
};

function getFileIcon(fileName: string, mimeType: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  if (ext === "pdf" || mimeType.includes("pdf")) {
    return <FileText className="w-4 h-4 text-rose-500" />;
  }
  if (["png", "jpg", "jpeg", "webp"].includes(ext) || mimeType.includes("image")) {
    return <ImageIcon className="w-4 h-4 text-indigo-500" />;
  }
  if (["xlsx", "xls", "csv"].includes(ext) || mimeType.includes("sheet")) {
    return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
  }
  if (["zip", "dwg", "autocad"].includes(ext)) {
    return <FileCode className="w-4 h-4 text-amber-500" />;
  }
  return <File className="w-4 h-4 text-slate-500" />;
}

export function ClientPortalView({
  user,
  projects: initialProjects,
  initialDocuments,
  meetings,
  initialBillingMilestones,
  initialWarrantyClaims,
}: ClientPortalViewProps) {
  const supabase = createClient();
  const [projectList, setProjectList] = useState<ClientProjectItem[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjects[0]?.id || ""
  );

  const [approvingProjectId, setApprovingProjectId] = useState<string | null>(null);
  const [showSigModal, setShowSigModal] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeProject = projectList.find((p) => p.id === selectedProjectId) || projectList[0];

  const triggerApproveMilestone = () => {
    if (!activeProject) return;
    setShowSigModal(true);
  };

  const handleExecuteApproveWithSignature = async (typedName: string) => {
    if (!activeProject) return;
    setApprovingProjectId(activeProject.id);
    setErrorMsg(null);

    // 1. Record Digital Signature Audit Acknowledgment
    await createSignatureAcknowledgment(
      supabase,
      {
        action_type: "client_milestone",
        reference_id: activeProject.id,
        typed_name: typedName,
      },
      user.id
    );

    // 2. Perform actual Milestone Sign-off database mutation
    const res = await approveProjectProgress(supabase, activeProject.id);
    setApprovingProjectId(null);
    setShowSigModal(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to sign off milestone.");
    } else {
      setProjectList((prev) =>
        prev.map((p) =>
          p.id === activeProject.id
            ? { ...p, client_approved: true, client_approved_at: res.approvedAt || new Date().toISOString() }
            : p
        )
      );
    }
  };

  const handleDownloadDoc = async (doc: ProjectDocumentItem) => {
    setDownloadingDocId(doc.id);
    setErrorMsg(null);

    const res = await getDocumentSignedUrl(supabase, doc.file_path);
    setDownloadingDocId(null);

    if (res.error || !res.signedUrl) {
      setErrorMsg(res.error || "Failed to generate signed download link.");
    } else {
      window.open(res.signedUrl, "_blank");
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Client Portal Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <Building2 className="w-3.5 h-3.5" />
              Client Executive Portal
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Welcome, {user.full_name || user.email}
            </h1>
            <p className="text-sm text-indigo-200/80 max-w-xl">
              Track project milestones, inspect site progress photos and drawings, and sign off completed work packages.
            </p>
          </div>

          <Link
            href="/grievances"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all backdrop-blur-md shrink-0 w-fit"
          >
            <AlertCircle className="w-4 h-4 text-rose-400" />
            Report a Concern →
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Linked Project Summary & Sign-off Card */}
      {activeProject ? (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold text-foreground">{activeProject.name}</h2>
                <StatusBadge status={activeProject.status} />
              </div>
              <p className="text-xs text-muted-foreground">{activeProject.description || "No description."}</p>
            </div>

            {/* Client Sign-off Milestone Action */}
            <div className="shrink-0">
              {activeProject.client_approved ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Approved by {user.full_name || "Client"} on{" "}
                    {new Date(activeProject.client_approved_at!).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    (Digitally Signed)
                  </span>
                </div>
              ) : (
                <button
                  onClick={triggerApproveMilestone}
                  disabled={!!approvingProjectId}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-60"
                >
                  {approvingProjectId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Approve Project Milestone
                </button>
              )}
            </div>
          </div>

          {/* Project Details Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-muted/30 p-3.5 rounded-xl border border-border flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-indigo-500" />
              <div>
                <span className="text-muted-foreground block text-[11px]">Assigned Manager</span>
                <span className="font-semibold text-foreground">{activeProject.manager_name || "Unassigned"}</span>
              </div>
            </div>

            <div className="bg-muted/30 p-3.5 rounded-xl border border-border flex items-center gap-3">
              <Calendar className="w-5 h-5 text-emerald-500" />
              <div>
                <span className="text-muted-foreground block text-[11px]">Schedule Window</span>
                <span className="font-semibold text-foreground">
                  {activeProject.start_date || "N/A"} → {activeProject.end_date || "N/A"}
                </span>
              </div>
            </div>

            <div className="bg-muted/30 p-3.5 rounded-xl border border-border flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-violet-500" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">Progress Rate</span>
                  <span className="font-bold text-foreground">{activeProject.progress_pct}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${activeProject.progress_pct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Gantt Timeline */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <GanttChart className="w-4 h-4 text-indigo-500" /> Live Schedule & Work Breakdown
            </h3>
            <ProjectGanttChart tasks={activeProject.tasks} />
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-card border border-border rounded-2xl">
          <Building2 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">No active client projects linked.</p>
        </div>
      )}

      {/* Billing & Payment Milestones (read-only) */}
      {initialBillingMilestones.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-500" /> Billing & Payment Milestones
          </h3>
          <div className="divide-y divide-border">
            {initialBillingMilestones.map((m) => {
              const statusCfg = CLIENT_BILLING_STATUS_BADGES[m.status];
              return (
                <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-foreground">{m.title}</p>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusCfg.bg, statusCfg.text)}>
                        {statusCfg.label}
                      </span>
                    </div>
                    {m.description && <p className="text-[11px] text-muted-foreground mt-0.5">{m.description}</p>}
                    {m.due_date && <p className="text-[11px] text-muted-foreground mt-0.5">Due {m.due_date}</p>}
                  </div>
                  <span className="text-sm font-bold text-foreground flex items-center shrink-0">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {m.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Warranty Claims — client can report an issue and see status, but not close it out */}
      {activeProject && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <WarrantyClaimsView
            projectId={activeProject.id}
            initialClaims={initialWarrantyClaims}
            userId={user.id}
            canManage={false}
            warrantyEndDate={activeProject.warranty_end_date}
          />
        </div>
      )}

      {/* Project Documents & Blueprints Vault */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-indigo-500" /> Approved Project Drawings & Contract Vault
        </h3>

        {initialDocuments.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            No public contract documents uploaded for this project.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {initialDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-secondary/40 border border-border rounded-xl text-xs hover:border-indigo-500/50 transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  {getFileIcon(doc.file_name, doc.file_type || "")}
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate group-hover:text-indigo-600 transition-colors">
                      {doc.file_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(doc.file_size / 1024).toFixed(1)} KB • {doc.category}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDownloadDoc(doc)}
                  disabled={downloadingDocId === doc.id}
                  className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-all shrink-0"
                  title="Download Document"
                >
                  {downloadingDocId === doc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reusable Digital Signature Modal for Client Sign-off */}
      <SignatureConfirmModal
        isOpen={showSigModal}
        onClose={() => setShowSigModal(false)}
        onConfirm={handleExecuteApproveWithSignature}
        actionTitle="Confirm Project Milestone Sign-Off"
        summaryText={`You are approving completed milestone sign-off for Project "${activeProject?.name || "Project"}".`}
        signerFullName={user.full_name || user.email}
        confirmButtonText="Confirm & Digitally Sign Approval"
      />
    </div>
  );
}
