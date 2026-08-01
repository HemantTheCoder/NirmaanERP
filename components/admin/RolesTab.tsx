"use client";

import { Check, X, Info } from "lucide-react";

interface PermissionRow {
  module: string;
  action: string;
  admin: boolean;
  project_manager: boolean;
  site_staff: boolean;
  client: boolean;
}

const PERMISSIONS_MATRIX: PermissionRow[] = [
  // Projects
  { module: "Projects", action: "View Projects List & Progress", admin: true, project_manager: true, site_staff: true, client: true },
  { module: "Projects", action: "Create & Edit Project Details", admin: true, project_manager: true, site_staff: false, client: false },
  { module: "Projects", action: "Delete Project", admin: true, project_manager: false, site_staff: false, client: false },

  // Tasks & Workspace
  { module: "Tasks", action: "View Assigned & Project Tasks", admin: true, project_manager: true, site_staff: true, client: true },
  { module: "Tasks", action: "Update Task Status & Notes", admin: true, project_manager: true, site_staff: true, client: false },
  { module: "Tasks", action: "Create & Reassign Tasks", admin: true, project_manager: true, site_staff: false, client: false },
  { module: "Tasks", action: "Delete Task", admin: true, project_manager: true, site_staff: false, client: false },

  // Schedule & Meetings
  { module: "Schedule", action: "View Calendar & Meeting Details", admin: true, project_manager: true, site_staff: true, client: true },
  { module: "Schedule", action: "Schedule New Meeting", admin: true, project_manager: true, site_staff: true, client: false },
  { module: "Schedule", action: "Update RSVP Status", admin: true, project_manager: true, site_staff: true, client: true },
  { module: "Schedule", action: "Edit Meeting Minutes & Notes", admin: true, project_manager: false, site_staff: false, client: false },

  // Leaves Management
  { module: "Leaves", action: "Submit Leave Request", admin: true, project_manager: true, site_staff: true, client: false },
  { module: "Leaves", action: "Approve or Reject Leave Requests", admin: true, project_manager: true, site_staff: false, client: false },

  // Resource Allocation
  { module: "Resources", action: "Request Site Resource Allocation", admin: true, project_manager: true, site_staff: true, client: false },
  { module: "Resources", action: "Approve & Dispatch Resource Requests", admin: true, project_manager: true, site_staff: false, client: false },

  // Project Documents
  { module: "Documents", action: "Upload Project Documents & Drawings", admin: true, project_manager: true, site_staff: true, client: false },
  { module: "Documents", action: "Delete Project Documents", admin: true, project_manager: true, site_staff: false, client: false },

  // Safety Incidents
  { module: "Safety", action: "Report Safety Incident or Near Miss", admin: true, project_manager: true, site_staff: true, client: false },
  { module: "Safety", action: "Resolve & Close Safety Incident Tickets", admin: true, project_manager: true, site_staff: false, client: false },

  // Grievance Portal
  { module: "Grievances", action: "File Grievance Ticket", admin: true, project_manager: true, site_staff: true, client: true },
  { module: "Grievances", action: "Resolve & Update Grievance Status", admin: true, project_manager: true, site_staff: false, client: false },

  // Client Portal
  { module: "Client Portal", action: "Access Dedicated Client View & Sign-Off", admin: false, project_manager: false, site_staff: false, client: true },

  // Reports & Analytics
  { module: "Reports", action: "Access Reports & Analytics Page", admin: true, project_manager: true, site_staff: false, client: false },
  { module: "Reports", action: "Export CSV & PDF Reports", admin: true, project_manager: true, site_staff: false, client: false },

  // Admin Module
  { module: "Admin", action: "Access Admin Console", admin: true, project_manager: false, site_staff: false, client: false },
  { module: "Admin", action: "Invite & Provision Users", admin: true, project_manager: false, site_staff: false, client: false },
  { module: "Admin", action: "Update User Roles & Active Status", admin: true, project_manager: false, site_staff: false, client: false },
  { module: "Admin", action: "Force Sign-Out & Delete Users", admin: true, project_manager: false, site_staff: false, client: false },
];

export function RolesTab() {
  return (
    <div className="space-y-6">
      {/* Informational Banner */}
      <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-900 dark:text-indigo-200 text-xs flex items-start gap-3">
        <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Access Control Matrix Reference</p>
          <p className="mt-0.5 text-indigo-700 dark:text-indigo-300">
            This reference table documents system permission boundaries enforced across Row-Level Security (RLS) policies, middleware routes, and navigation UI elements.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Module & Capability</th>
                <th className="px-5 py-3.5 text-center w-28">Admin</th>
                <th className="px-5 py-3.5 text-center w-36">Project Manager</th>
                <th className="px-5 py-3.5 text-center w-28">Site Staff</th>
                <th className="px-5 py-3.5 text-center w-28">Client</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PERMISSIONS_MATRIX.map((row, idx) => (
                <tr key={idx} className="hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-secondary text-muted-foreground uppercase tracking-wider">
                        {row.module}
                      </span>
                      <span className="font-semibold text-foreground">{row.action}</span>
                    </div>
                  </td>

                  {/* Admin */}
                  <td className="px-5 py-3 text-center">
                    {row.admin ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mx-auto">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>

                  {/* Project Manager */}
                  <td className="px-5 py-3 text-center">
                    {row.project_manager ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mx-auto">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>

                  {/* Site Staff */}
                  <td className="px-5 py-3 text-center">
                    {row.site_staff ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mx-auto">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>

                  {/* Client */}
                  <td className="px-5 py-3 text-center">
                    {row.client ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mx-auto">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
