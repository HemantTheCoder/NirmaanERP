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
  Shield,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { approveProjectProgress, type ClientProjectItem } from "@/lib/queries/client";
import { getDocumentSignedUrl, type ProjectDocumentItem } from "@/lib/queries/documents";
import { ProjectGanttChart } from "@/components/projects/ProjectGanttChart";
import { StatusBadge } from "@/components/projects/StatusBadge";
import type { UpcomingMeetingItem } from "@/lib/queries/meetings";
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
}

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
  if (ext === "dwg" || ext === "cad") {
    return <FileCode className="w-4 h-4 text-violet-500" />;
  }

  return <File className="w-4 h-4 text-amber-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClientPortalView({
  user,
  projects,
  initialDocuments,
  meetings,
}: ClientPortalViewProps) {
  const supabase = createClient();

  const [projectList, setProjectList] = useState<ClientProjectItem[]>(projects);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [approvingProjectId, setApprovingProjectId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeProject = projectList[0] || null;

  const handleApproveMilestone = async (project: ClientProjectItem) => {
    setApprovingProjectId(project.id);
    setErrorMsg(null);

    const res = await approveProjectProgress(supabase, project.id);
    setApprovingProjectId(null);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to sign off milestone.");
    } else {
      setProjectList((prev) =>
        prev.map((p) =>
          p.id === project.id
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
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 text-white p-8 border border-indigo-800/40 shadow-xl">
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
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Approved on{" "}
                    {new Date(activeProject.client_approved_at!).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => handleApproveMilestone(activeProject)}
                  disabled={approvingProjectId === activeProject.id}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  {approvingProjectId === activeProject.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Approve Progress Milestone
                </button>
              )}
            </div>
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-secondary/50 border border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Assigned PM</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{activeProject.manager_name || "Unassigned"}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-secondary/50 border border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Schedule Timeline</p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {activeProject.start_date || "N/A"} → {activeProject.end_date || "N/A"}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-secondary/50 border border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium">Site Progress</p>
                  <span className="text-xs font-bold text-foreground">{activeProject.progress_pct}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden mt-1.5 border border-border/40">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${activeProject.progress_pct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground shadow-sm">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-bold text-foreground">No Linked Project Assigned</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Contact your Nirmaan ERP Administrator to link your client account to your project.
          </p>
        </div>
      )}

      {/* Project Timeline (Read-Only Gantt) */}
      {activeProject && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <GanttChart className="w-4.5 h-4.5 text-indigo-600" />
            Project Schedule & Work Package Timeline
          </h3>

          <ProjectGanttChart tasks={activeProject.tasks} />
        </div>
      )}

      {/* Shared Documents Table (Contracts Excluded) */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="w-4.5 h-4.5 text-indigo-500" />
              Shared Site Drawings & Reports
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Architectural blueprints, site progress photos, and quality inspection reports.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Document File</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Size</th>
                <th className="px-5 py-3.5">Uploaded Date</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {initialDocuments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">
                    No shared drawings or reports uploaded for this project yet.
                  </td>
                </tr>
              ) : (
                initialDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          {getFileIcon(doc.file_name, doc.file_type)}
                        </div>
                        <span className="font-semibold text-foreground">{doc.file_name}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 capitalize font-medium text-muted-foreground">
                      {doc.category}
                    </td>

                    <td className="px-5 py-3.5 font-medium text-foreground">
                      {formatFileSize(doc.file_size)}
                    </td>

                    <td className="px-5 py-3.5 text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDownloadDoc(doc)}
                        disabled={downloadingDocId === doc.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950/80 transition-all border border-indigo-200 dark:border-indigo-800"
                      >
                        {downloadingDocId === doc.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming Client Meetings */}
      {meetings.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-4.5 h-4.5 text-emerald-600" />
            Upcoming Client Review Meetings
          </h3>

          <div className="divide-y divide-border">
            {meetings.map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-foreground">{m.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(m.start_time).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Confirmed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
