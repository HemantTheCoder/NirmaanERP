"use client";

import { useState } from "react";
import Link from "next/link";
import type { TenderItem } from "@/lib/queries/tenders";
import type { UserRole } from "@/types/database";
import { TenderCreationWizard } from "@/components/tenders/TenderCreationWizard";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  IndianRupee,
  Building2,
  CheckCircle2,
  AlertCircle,
  Gavel,
  ChevronRight,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

interface TendersListViewProps {
  tenders: TenderItem[];
  projects: { id: string; name: string }[];
  user: {
    id: string;
    role: UserRole;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  civil: "Civil & Structural",
  electrical: "Electrical & Power",
  mechanical: "HVAC & Mechanical",
  interior: "Interior Fit-Out",
  plumbing: "Plumbing & Fire",
  structural_steel: "Structural Steel",
  landscaping: "Landscaping",
  other: "General Subcontract",
};

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  published: { label: "Published & Open", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
  closed: { label: "Closed / Evaluation", bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  awarded: { label: "Awarded", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  cancelled: { label: "Cancelled", bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-800 dark:text-rose-300" },
};

export function TendersListView({ tenders, projects, user }: TendersListViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const isStaff = user.role === "admin" || user.role === "project_manager";

  // Filter tenders
  const filteredTenders = tenders.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.project?.name || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Calculate deadline countdown helper
  const getDeadlineBadge = (deadlineStr: string, status: string) => {
    if (status === "closed" || status === "awarded" || status === "cancelled") {
      return { text: "Bidding Closed", color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" };
    }

    const now = new Date().getTime();
    const deadline = new Date(deadlineStr).getTime();
    const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { text: "Expired", color: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300" };
    }
    if (diffDays < 3) {
      return { text: `${diffDays} day${diffDays === 1 ? "" : "s"} left`, color: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 animate-pulse" };
    }
    if (diffDays <= 7) {
      return { text: `${diffDays} days left`, color: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300" };
    }
    return { text: `${diffDays} days left`, color: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300" };
  };

  // Stats for Admin/PM
  const totalCount = tenders.length;
  const publishedCount = tenders.filter((t) => t.status === "published").length;
  const closedCount = tenders.filter((t) => t.status === "closed").length;
  const awardedCount = tenders.filter((t) => t.status === "awarded").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Gavel className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            {isStaff ? "Tendering & Subcontracts Portal" : "Subcontract Tenders & Bidding"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isStaff
              ? "Manage subcontract scope specifications, invite competitive bids, and award trade packages."
              : "Browse open subcontract packages, download specs, and submit formal proposals."}
          </p>
        </div>

        {isStaff && (
          <button
            onClick={() => setIsWizardOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create Tender Package
          </button>
        )}
      </div>

      {/* Stats row for Staff */}
      {isStaff && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Packages</p>
              <p className="text-lg font-bold text-foreground">{totalCount}</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Active & Open</p>
              <p className="text-lg font-bold text-foreground">{publishedCount}</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Under Evaluation</p>
              <p className="text-lg font-bold text-foreground">{closedCount}</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Awarded Trades</p>
              <p className="text-lg font-bold text-foreground">{awardedCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenders by title or project..."
            className="w-full pl-9 pr-3.5 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent border-0 text-foreground font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Trade Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Status Tabs for Admin/PM */}
          {isStaff && (
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50 text-xs">
              {["all", "draft", "published", "closed", "awarded"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-semibold capitalize transition-all",
                    statusFilter === st
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tenders Grid */}
      {filteredTenders.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <Gavel className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-bold text-foreground">No Tender Packages Found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {isStaff
              ? "Get started by creating your first tender package using the guided creation helper."
              : "There are currently no open tender packages matching your search filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTenders.map((tender) => {
            const statusCfg = STATUS_BADGES[tender.status] || STATUS_BADGES.draft;
            const deadlineBadge = getDeadlineBadge(tender.submission_deadline, tender.status);
            const myBid = tender.my_bid;

            return (
              <div
                key={tender.id}
                className="bg-card border border-border hover:border-indigo-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                      {CATEGORY_LABELS[tender.category] || tender.category}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-semibold px-2 py-0.5 rounded-lg",
                        statusCfg.bg,
                        statusCfg.text
                      )}
                    >
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 mb-2">
                    {tender.title}
                  </h3>

                  {/* Project & Creator */}
                  <div className="space-y-1 text-xs text-muted-foreground mb-4">
                    {tender.project && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="font-medium text-foreground truncate">{tender.project.name}</span>
                      </div>
                    )}
                    {tender.creator && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span>Issued by: {tender.creator.full_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Estimated Value */}
                  {(tender.estimated_value_min || tender.estimated_value_max) && (
                    <div className="p-2.5 bg-muted/40 rounded-xl mb-4 text-xs">
                      <span className="text-muted-foreground block text-[11px]">Estimated Package Value</span>
                      <span className="font-bold text-foreground">
                        {tender.estimated_value_min
                          ? `₹${tender.estimated_value_min.toLocaleString("en-IN")}`
                          : "N/A"}{" "}
                        -{" "}
                        {tender.estimated_value_max
                          ? `₹${tender.estimated_value_max.toLocaleString("en-IN")}`
                          : "N/A"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer info & CTA */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1 text-xs">
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold",
                          deadlineBadge.color
                        )}
                      >
                        {deadlineBadge.text}
                      </span>
                    </div>
                    {isStaff && (
                      <span className="text-[11px] text-muted-foreground mt-1 block">
                        {tender.bids_count || 0} Bid(s) Received
                      </span>
                    )}
                    {user.role === "contractor" && myBid && (
                      <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1 block">
                        ✓ Bid Submitted (₹{myBid.bid_amount.toLocaleString("en-IN")})
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/tenders/${tender.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
                  >
                    View Package <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Guided Creation Wizard Modal */}
      <TenderCreationWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        projects={projects}
        userId={user.id}
      />
    </div>
  );
}
