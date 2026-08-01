"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  submitBid,
  updateBidStatus,
  awardBid,
  updateTender,
  type TenderItem,
  type TenderDocumentItem,
  type BidItem,
} from "@/lib/queries/tenders";
import type { UserRole, BidStatus } from "@/types/database";
import {
  ArrowLeft,
  Calendar,
  Building2,
  FileText,
  Download,
  IndianRupee,
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  AlertCircle,
  Send,
  Loader2,
  ShieldCheck,
  User,
  Gavel,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TenderDetailViewProps {
  tender: TenderItem;
  documents: TenderDocumentItem[];
  bids: BidItem[];
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

const BID_STATUS_BADGES: Record<BidStatus, { label: string; bg: string; text: string }> = {
  submitted: { label: "Submitted", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  under_review: { label: "Under Review", bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  shortlisted: { label: "Shortlisted", bg: "bg-violet-100 dark:bg-violet-950/60", text: "text-violet-800 dark:text-violet-300" },
  awarded: { label: "Awarded Winner", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
  rejected: { label: "Not Selected", bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-800 dark:text-rose-300" },
};

export function TenderDetailView({
  tender,
  documents,
  bids,
  user,
}: TenderDetailViewProps) {
  const router = useRouter();
  const supabase = createClient();

  const isStaff = user.role === "admin" || user.role === "project_manager";
  const isContractor = user.role === "contractor";

  const [activeTab, setActiveTab] = useState<"specs" | "bids">("specs");

  // Contractor Bidding Form Modal State
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [proposalText, setProposalText] = useState("");
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);

  // Admin Review / Award Modal State
  const [selectedBid, setSelectedBid] = useState<BidItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Sorting for Admin Bids Table
  const [bidSort, setBidSort] = useState<"asc" | "desc">("asc");

  // Signed URL download helper
  const handleDownloadDoc = async (doc: TenderDocumentItem) => {
    const { data } = await supabase.storage
      .from("tender-documents")
      .createSignedUrl(doc.file_path, 60);

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  // Submit Bid Handler
  const handleSubmitBidForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingBid(true);
    setBidError(null);

    const amount = parseFloat(bidAmount);
    if (!amount || amount <= 0) {
      setBidError("Please enter a valid bid amount.");
      setIsSubmittingBid(false);
      return;
    }

    const { error } = await submitBid(
      supabase,
      tender.id,
      user.id,
      amount,
      proposalText
    );

    if (error) {
      setBidError(error.message || "Failed to submit bid.");
      setIsSubmittingBid(false);
      return;
    }

    setIsSubmittingBid(false);
    setShowBidModal(false);
    router.refresh();
  };

  // Status Action Handler (Shortlist / Reject)
  const handleBidStatusAction = async (status: BidStatus) => {
    if (!selectedBid) return;
    setIsProcessingAction(true);

    await updateBidStatus(supabase, selectedBid.id, status, user.id, reviewNotes);

    setIsProcessingAction(false);
    setSelectedBid(null);
    setReviewNotes("");
    router.refresh();
  };

  // Award Bid Handler
  const handleAwardContract = async () => {
    if (!selectedBid) return;
    setIsProcessingAction(true);

    await awardBid(supabase, tender.id, selectedBid.id, user.id, reviewNotes);

    setIsProcessingAction(false);
    setSelectedBid(null);
    setReviewNotes("");
    router.refresh();
  };

  // Publish Tender Handler for Drafts
  const handlePublishDraft = async () => {
    await updateTender(supabase, tender.id, { status: "published" });
    router.refresh();
  };

  // Deadline check
  const isDeadlinePassed = new Date(tender.submission_deadline) < new Date();
  const canBid =
    isContractor &&
    tender.status === "published" &&
    !isDeadlinePassed &&
    !tender.my_bid;

  const sortedBids = [...bids].sort((a, b) =>
    bidSort === "asc" ? a.bid_amount - b.bid_amount : b.bid_amount - a.bid_amount
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back Link */}
      <Link
        href="/tenders"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Tenders Portal
      </Link>

      {/* Header Banner */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                {CATEGORY_LABELS[tender.category] || tender.category}
              </span>
              <span className="text-xs font-semibold capitalize bg-muted px-2.5 py-0.5 rounded-lg text-foreground">
                Status: {tender.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{tender.title}</h1>
            {tender.project && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-500" />
                Linked Project: <span className="font-semibold text-foreground">{tender.project.name}</span>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isStaff && tender.status === "draft" && (
              <button
                onClick={handlePublishDraft}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
              >
                Publish Tender Package
              </button>
            )}

            {canBid && (
              <button
                onClick={() => setShowBidModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all"
              >
                <Send className="w-4 h-4" />
                Submit Proposal & Bid
              </button>
            )}
          </div>
        </div>

        {/* Deadline & Budget Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border/60 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Submission Deadline</span>
            <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              {new Date(tender.submission_deadline).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">Estimated Value Range</span>
            <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-500" />
              {tender.estimated_value_min ? `₹${tender.estimated_value_min.toLocaleString("en-IN")}` : "N/A"} -{" "}
              {tender.estimated_value_max ? `₹${tender.estimated_value_max.toLocaleString("en-IN")}` : "N/A"}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">Bids Evaluation Status</span>
            <span className="font-semibold text-foreground mt-0.5 block">
              {tender.status === "awarded"
                ? "Contract Awarded"
                : `${tender.bids_count || 0} Bid(s) Received`}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center border-b border-border gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("specs")}
          className={cn(
            "pb-3 border-b-2 transition-all flex items-center gap-2",
            activeTab === "specs"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <FileText className="w-4 h-4" /> Scope & Specifications
        </button>

        {isStaff && (
          <button
            onClick={() => setActiveTab("bids")}
            className={cn(
              "pb-3 border-b-2 transition-all flex items-center gap-2",
              activeTab === "bids"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Gavel className="w-4 h-4" /> Bids Received ({bids.length})
          </button>
        )}
      </div>

      {/* TAB 1: SCOPE & SPECS */}
      {activeTab === "specs" && (
        <div className="space-y-6">
          {/* Contractor's Own Bid Summary Card */}
          {isContractor && tender.my_bid && (
            <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-sm font-bold text-foreground">Your Submitted Proposal</h4>
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-lg",
                    BID_STATUS_BADGES[tender.my_bid.status].bg,
                    BID_STATUS_BADGES[tender.my_bid.status].text
                  )}
                >
                  {BID_STATUS_BADGES[tender.my_bid.status].label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Bid Amount Submitted:</span>
                  <p className="text-base font-bold text-foreground">
                    ₹{tender.my_bid.bid_amount.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Submission Date:</span>
                  <p className="text-xs font-medium text-foreground">
                    {new Date(tender.my_bid.submitted_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {tender.my_bid.proposal_text && (
                <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-800/40">
                  <p className="text-xs font-semibold text-foreground mb-1">Proposal Statement:</p>
                  <p className="text-xs text-muted-foreground bg-background p-3 rounded-xl whitespace-pre-wrap">
                    {tender.my_bid.proposal_text}
                  </p>
                </div>
              )}

              {tender.my_bid.review_notes && (
                <div className="p-3 bg-card border border-border rounded-xl text-xs">
                  <span className="font-semibold text-foreground">Evaluation Feedback: </span>
                  <span className="text-muted-foreground">{tender.my_bid.review_notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Scope of Work */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Detailed Scope of Work
            </h3>
            {tender.scope_description ? (
              <div className="text-sm text-foreground/90 leading-relaxed font-mono whitespace-pre-wrap bg-muted/20 p-4 rounded-xl border border-border/50">
                {tender.scope_description}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No detailed scope text provided.</p>
            )}
          </div>

          {/* Eligibility Criteria */}
          {tender.eligibility_criteria && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Eligibility Criteria & Trade Qualifications
              </h3>
              <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap bg-muted/20 p-4 rounded-xl border border-border/50">
                {tender.eligibility_criteria}
              </div>
            </div>
          )}

          {/* Tender Documents */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-500" />
              Supporting Tender Drawings & BOQ Documents ({documents.length})
            </h3>

            {documents.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No drawings or attachments uploaded for this tender.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl text-xs hover:border-indigo-500/50 transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="font-semibold text-foreground truncate">{doc.file_name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {(doc.file_size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>

                    <button
                      onClick={() => handleDownloadDoc(doc)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BIDS RECEIVED (ADMIN / PM) */}
      {activeTab === "bids" && isStaff && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Review received contractor proposals, shortlist candidates, or award the trade package.
            </p>
            <button
              onClick={() => setBidSort((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Sort Amount: {bidSort === "asc" ? "Lowest to Highest ↑" : "Highest to Lowest ↓"}
            </button>
          </div>

          {sortedBids.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Gavel className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">No Bids Submitted Yet</p>
              <p className="text-xs text-muted-foreground mt-1">Contractor proposals will appear here once submitted.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Contractor / Firm</th>
                      <th className="px-4 py-3">Bid Amount (₹)</th>
                      <th className="px-4 py-3">Submitted Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedBids.map((b) => {
                      const statusCfg = BID_STATUS_BADGES[b.status] || BID_STATUS_BADGES.submitted;
                      const isAwardedWinner = b.id === tender.awarded_bid_id;

                      return (
                        <tr
                          key={b.id}
                          className={cn(
                            "hover:bg-muted/40 transition-colors cursor-pointer",
                            isAwardedWinner && "bg-emerald-50/50 dark:bg-emerald-950/20"
                          )}
                          onClick={() => {
                            setSelectedBid(b);
                            setReviewNotes(b.review_notes || "");
                          }}
                        >
                          <td className="px-4 py-3.5 font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-indigo-500 shrink-0" />
                              <div>
                                <p className="font-bold">{b.contractor?.full_name || "Contractor"}</p>
                                <p className="text-[11px] text-muted-foreground">{b.contractor?.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 font-bold text-foreground text-sm">
                            ₹{b.bid_amount.toLocaleString("en-IN")}
                          </td>

                          <td className="px-4 py-3.5 text-muted-foreground">
                            {new Date(b.submitted_at).toLocaleDateString()}
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={cn(
                                "inline-block px-2.5 py-0.5 rounded-md font-semibold text-[11px]",
                                statusCfg.bg,
                                statusCfg.text
                              )}
                            >
                              {statusCfg.label}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                            Review Proposal →
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTRACTOR BID SUBMISSION MODAL */}
      {showBidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Submit Proposal for {tender.title}</h3>

            {bidError && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl">
                {bidError}
              </div>
            )}

            <form onSubmit={handleSubmitBidForm} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Total Commercial Bid Amount (₹) *
                </label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="Enter total lump-sum or itemized bid total"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Proposal Statement & Execution Terms
                </label>
                <textarea
                  rows={5}
                  value={proposalText}
                  onChange={(e) => setProposalText(e.target.value)}
                  placeholder="Summarize your trade methodology, key material brands proposed, payment terms, and timeline commitment..."
                  className="w-full p-3 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBidModal(false)}
                  className="px-4 py-2 bg-secondary text-foreground text-xs font-medium rounded-xl hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBid}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all"
                >
                  {isSubmittingBid && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Official Bid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN BID EVALUATION & AWARD MODAL */}
      {selectedBid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground">Contractor Proposal Review</span>
                <h3 className="text-lg font-bold text-foreground">{selectedBid.contractor?.full_name}</h3>
                <p className="text-xs text-muted-foreground">{selectedBid.contractor?.email}</p>
              </div>
              <button
                onClick={() => setSelectedBid(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Bid Commercial Value:</span>
                <span className="text-lg font-bold text-foreground">
                  ₹{selectedBid.bid_amount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Submitted On:</span>
                <span className="font-semibold text-foreground">
                  {new Date(selectedBid.submitted_at).toLocaleString()}
                </span>
              </div>
            </div>

            {selectedBid.proposal_text && (
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Proposal Statement:</label>
                <div className="text-xs text-foreground/90 bg-background p-3.5 rounded-xl border border-border whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                  {selectedBid.proposal_text}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Evaluation Notes / Feedback
              </label>
              <textarea
                rows={2}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Enter evaluation notes or justification for shortlisting/rejection..."
                className="w-full p-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => handleBidStatusAction("shortlisted")}
                  className="px-3 py-1.5 bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 font-semibold rounded-lg text-xs hover:bg-violet-200 transition-colors"
                >
                  Shortlist Bid
                </button>
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => handleBidStatusAction("rejected")}
                  className="px-3 py-1.5 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-semibold rounded-lg text-xs hover:bg-rose-200 transition-colors"
                >
                  Reject Bid
                </button>
              </div>

              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleAwardContract}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
              >
                {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Award className="w-4 h-4" /> Award Trade Contract
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
