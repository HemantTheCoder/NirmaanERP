"use client";

import { useState } from "react";
import {
  Building2,
  Layers,
  ShieldCheck,
  Calendar,
  BarChart3,
  Gavel,
  HardHat,
  Cpu,
  GraduationCap,
  Briefcase,
  ChevronDown,
  ChevronUp,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { ROLE_DEFINITIONS, type RoleDefinition } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";

function LinkedInIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck: ShieldCheck,
  Briefcase: Briefcase,
  HardHat: HardHat,
  Building2: Building2,
  Gavel: Gavel,
};

export default function AboutPage() {
  const [openRole, setOpenRole] = useState<string | null>("admin");

  const TECH_STACK = [
    { name: "Next.js 16", desc: "React Framework & Turbopack", category: "Core" },
    { name: "Supabase", desc: "PostgreSQL, Auth & Storage", category: "Database" },
    { name: "Tailwind CSS", desc: "Vanilla CSS & Responsive UI", category: "Styling" },
    { name: "Recharts", desc: "Executive KPI Analytics", category: "Charts" },
    { name: "TypeScript", desc: "Strict Type Safety", category: "Language" },
    { name: "Lucide React", desc: "Iconography System", category: "Icons" },
  ];

  const MODULES = [
    { title: "Project Tracking", icon: Layers, desc: "Multi-project progress monitoring, milestones, and document management." },
    { title: "LPS Scheduling", icon: Calendar, desc: "Last Planner System workflow with PPC metrics and meeting minutes." },
    { title: "Resource Allocation", icon: HardHat, desc: "Equipment, labor, and materials request and dispatch lifecycle." },
    { title: "Safety & Grievances", icon: ShieldCheck, desc: "Site incident reporting, near-miss logging, and resolution tracking." },
    { title: "Tendering & Bidding", icon: Gavel, desc: "Subcontractor portal for tender creation, proposal submission, and contract awards." },
    { title: "Executive Reports", icon: BarChart3, desc: "Real-time visual reports with print/PDF export and CSV data downloads." },
  ];

  const DEVELOPERS = [
    {
      name: "Hemant Kumar",
      role: "Lead Developer & System Architect",
      linkedin: "https://www.linkedin.com/in/hemantkumar2430/",
    },
    {
      name: "Dhvij Shah",
      role: "Co-Developer & Domain Specialist",
      linkedin: "https://www.linkedin.com/in/dhvij-shah-511927339/",
    },
  ];

  function toggleAccordion(id: string) {
    setOpenRole((prev) => (prev === id ? null : id));
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header Banner (Left untouched dark block) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/40 via-slate-900/60 to-slate-950 border border-white/10 p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  About Nirmaan ERP
                </h1>
                <p className="text-xs text-indigo-300 font-medium">
                  Version 1.0 — Construction Operations & Enterprise Resource Planning
                </p>
              </div>
            </div>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Nirmaan ERP is a comprehensive, multi-project construction management platform designed to unify site operations, scheduling, trade tendering, safety compliance, and executive decision-making into a single secure workspace.
            </p>
          </div>
        </div>
      </div>

      {/* Core Platform Capabilities Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2 tracking-tight">
          <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Core Platform Capabilities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m) => (
            <div
              key={m.title}
              className="bg-card border border-border hover:border-indigo-500/50 rounded-xl p-5 transition-all duration-200 shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3.5 shadow-xs">
                <m.icon className="w-5 h-5" />
              </div>
              <h3 className="text-foreground font-bold text-sm tracking-tight mb-1.5">{m.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed font-normal">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Built With Tech Stack */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2 tracking-tight">
          <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Built With
        </h2>
        <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
          <div className="flex flex-wrap gap-3">
            {TECH_STACK.map((tech) => (
              <div
                key={tech.name}
                className="flex items-center gap-2.5 bg-muted/40 border border-border/60 rounded-lg px-3.5 py-2 hover:bg-muted/80 transition-colors"
              >
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  {tech.category}
                </span>
                <span className="text-sm font-bold text-foreground">{tech.name}</span>
                <span className="text-xs text-muted-foreground font-medium">— {tech.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Developed By Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2 tracking-tight">
          <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Developed By
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DEVELOPERS.map((dev) => (
            <div
              key={dev.name}
              className="bg-card border border-border hover:border-indigo-500/50 rounded-xl p-6 flex flex-col justify-between space-y-4 transition-all duration-200 shadow-xs"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-extrabold text-foreground tracking-tight">{dev.name}</h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{dev.role}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-xs">
                  <LinkedInIcon className="w-5 h-5" />
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <a
                  href={dev.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-blue-500/20"
                >
                  <LinkedInIcon className="w-4 h-4" />
                  Connect on LinkedIn
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roles & Capabilities Accordion Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2 tracking-tight">
          <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Roles & Capabilities Overview
        </h2>
        <p className="text-xs text-muted-foreground font-medium">
          Nirmaan ERP enforces fine-grained access control boundaries across 5 specialized system roles. Click any role below to view detailed capabilities and permissions.
        </p>

        <div className="space-y-3">
          {ROLE_DEFINITIONS.map((r: RoleDefinition) => {
            const IconComp = ROLE_ICONS[r.iconName] || ShieldCheck;
            const isOpen = openRole === r.id;

            return (
              <div
                key={r.id}
                className={cn(
                  "border rounded-xl transition-all duration-200 overflow-hidden bg-card shadow-xs",
                  isOpen ? "border-indigo-500/60 shadow-md shadow-indigo-500/10" : "border-border hover:border-border/80"
                )}
              >
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleAccordion(r.id)}
                  className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-extrabold text-foreground tracking-tight">{r.title}</h3>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider", r.badgeStyle)}>
                          {r.badge}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5 font-normal">{r.summary}</p>
                    </div>
                  </div>

                  <div className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    {isOpen ? <ChevronUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                  </div>
                </button>

                {/* Accordion Content */}
                {isOpen && (
                  <div className="px-6 pb-5 pt-3 border-t border-border bg-muted/20 space-y-3">
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                      Authorized Capabilities & System Permissions:
                    </p>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-foreground">
                      {r.capabilities.map((cap, i) => (
                        <li key={i} className="flex items-start gap-2.5 bg-card border border-border/60 rounded-lg p-3">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-relaxed font-medium">{cap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Coursework Note */}
      <div className="text-center pt-8 border-t border-border text-xs text-muted-foreground">
        <p>
          Built as part of <span className="text-foreground font-medium">Computer Applications in Construction Management</span> coursework.
        </p>
        <p className="mt-1 text-muted-foreground/70">
          © 2026 Nirmaan ERP. All rights reserved.
        </p>
      </div>
    </div>
  );
}
