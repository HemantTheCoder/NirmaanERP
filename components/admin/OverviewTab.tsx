"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ShieldAlert,
  Calendar,
  Package,
  FolderKanban,
  Users,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import type { AdminOverviewData } from "@/lib/queries/admin";

interface OverviewTabProps {
  overviewData: AdminOverviewData;
  onNavigateToUsers: () => void;
}

export function OverviewTab({ overviewData, onNavigateToUsers }: OverviewTabProps) {
  const cards = [
    {
      id: "card-safety",
      title: "Safety Incidents",
      value: overviewData.openSafetyIncidents.toString(),
      subtext: overviewData.criticalSafetyIncidents > 0
        ? `${overviewData.criticalSafetyIncidents} critical incident(s) open`
        : "No critical incidents pending",
      isCritical: overviewData.criticalSafetyIncidents > 0,
      icon: ShieldAlert,
      color: overviewData.criticalSafetyIncidents > 0 ? "rose" : "amber",
      href: "/safety",
      actionText: "View Safety Console",
    },
    {
      id: "card-grievances",
      title: "Open Grievances",
      value: overviewData.openGrievances.toString(),
      subtext: overviewData.openGrievances > 0 ? "Awaiting review or resolution" : "All tickets resolved",
      isCritical: false,
      icon: AlertTriangle,
      color: "amber",
      href: "/grievances",
      actionText: "Open Grievances",
    },
    {
      id: "card-leaves",
      title: "Pending Leaves",
      value: overviewData.pendingLeaves.toString(),
      subtext: overviewData.pendingLeaves > 0 ? "Staff leave applications pending" : "No pending leave requests",
      isCritical: false,
      icon: Calendar,
      color: "indigo",
      href: "/approvals",
      actionText: "Review Approvals",
    },
    {
      id: "card-resources",
      title: "Pending Resource Requests",
      value: overviewData.pendingResourceRequests.toString(),
      subtext: overviewData.pendingResourceRequests > 0 ? "Site equipment/material requests" : "No pending resource requests",
      isCritical: false,
      icon: Package,
      color: "violet",
      href: "/approvals",
      actionText: "Manage Allocations",
    },
    {
      id: "card-projects",
      title: "Active Projects",
      value: overviewData.activeProjects.toString(),
      subtext: "Live active construction sites",
      isCritical: false,
      icon: FolderKanban,
      color: "emerald",
      href: "/projects",
      actionText: "View Projects",
    },
    {
      id: "card-users",
      title: "Registered Users",
      value: overviewData.totalUsers.toString(),
      subtext: "Total provisioned staff & client accounts",
      isCritical: false,
      icon: Users,
      color: "indigo",
      onAction: onNavigateToUsers,
      actionText: "Manage Users",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            System Operations Snapshot
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time overview of open safety incidents, pending approvals, unresolved grievances, and active projects across Nirmaan ERP.
          </p>
        </div>

        {overviewData.criticalSafetyIncidents > 0 && (
          <div className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 shrink-0 animate-pulse">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{overviewData.criticalSafetyIncidents} Critical Safety Incident(s) Require Attention</span>
          </div>
        )}
      </div>

      {/* Grid of Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className={`bg-card border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between ${
                card.isCritical
                  ? "border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20"
                  : "border-border"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      card.color === "rose"
                        ? "bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300"
                        : card.color === "amber"
                        ? "bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-300"
                        : card.color === "violet"
                        ? "bg-violet-100 dark:bg-violet-950/80 text-violet-600 dark:text-violet-300"
                        : card.color === "emerald"
                        ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300"
                        : "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300"
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>

                  {card.isCritical && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 uppercase tracking-wider">
                      Action Required
                    </span>
                  )}
                </div>

                <p className="text-3xl font-bold text-foreground tracking-tight">
                  {card.value}
                </p>
                <p className="text-xs font-semibold text-foreground/90 mt-1">
                  {card.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.subtext}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border/60">
                {card.href ? (
                  <Link
                    href={card.href}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <span>{card.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={card.onAction}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <span>{card.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
