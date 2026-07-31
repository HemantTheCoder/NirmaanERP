"use client";

import { useState, useEffect } from "react";
import { X, MapPin, Video, Clock, Calendar, User, Users, Loader2, CheckCircle2, XCircle, FileText, Save, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { updateRsvpStatus, saveMeetingMinutes, type MeetingWithDetails, type RsvpStatus } from "@/lib/queries/meetings";
import type { UserRole } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTimeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const RSVP_CONFIG: Record<RsvpStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending: {
    label: "Pending",
    bg: "bg-amber-100 dark:bg-amber-950/60",
    text: "text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  accepted: {
    label: "Accepted",
    bg: "bg-emerald-100 dark:bg-emerald-950/60",
    text: "text-emerald-800 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  declined: {
    label: "Declined",
    bg: "bg-rose-100 dark:bg-rose-950/60",
    text: "text-rose-800 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface MeetingDetailModalProps {
  meeting: MeetingWithDetails;
  currentUserId: string;
  currentUserRole: UserRole;
  onClose: () => void;
  onUpdated: (meetingId: string) => void; // parent re-fetches detail
}

export function MeetingDetailModal({
  meeting,
  currentUserId,
  currentUserRole,
  onClose,
  onUpdated,
}: MeetingDetailModalProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<"details" | "minutes">("details");
  const [rsvpLoading, setRsvpLoading] = useState<RsvpStatus | null>(null);
  const [minutesContent, setMinutesContent] = useState(meeting.minutes?.content ?? "");
  const [isSavingMinutes, setIsSavingMinutes] = useState(false);
  const [minutesSaved, setMinutesSaved] = useState(false);

  // Sync minutes content when prop changes (after re-fetch)
  useEffect(() => {
    setMinutesContent(meeting.minutes?.content ?? "");
  }, [meeting.minutes?.content]);

  const isOrganizer = meeting.organizer_id === currentUserId;
  const isAdmin = currentUserRole === "admin";
  const canEditMinutes = isOrganizer || isAdmin;

  const currentAttendee = meeting.attendees.find((a) => a.user?.id === currentUserId);
  const showRsvpButtons = !!currentAttendee && !isOrganizer && meeting.status === "scheduled";

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleRsvp = async (status: RsvpStatus) => {
    setRsvpLoading(status);
    await updateRsvpStatus(supabase, meeting.id, currentUserId, status);
    setRsvpLoading(null);
    onUpdated(meeting.id);
  };

  const handleSaveMinutes = async () => {
    setIsSavingMinutes(true);
    await saveMeetingMinutes(supabase, meeting.id, minutesContent, currentUserId);
    setIsSavingMinutes(false);
    setMinutesSaved(true);
    setTimeout(() => setMinutesSaved(false), 2000);
    onUpdated(meeting.id);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div
          className={cn(
            "px-6 py-4 border-b border-border",
            meeting.location_type === "virtual"
              ? "bg-indigo-50 dark:bg-indigo-950/30"
              : "bg-emerald-50 dark:bg-emerald-950/30"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {meeting.location_type === "virtual" ? (
                  <Video className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                )}
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-md",
                    meeting.location_type === "virtual"
                      ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  )}
                >
                  {meeting.location_type === "virtual" ? "Virtual" : "On-site"}
                </span>
                {meeting.status !== "scheduled" && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                    {meeting.status}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-foreground leading-tight">{meeting.title}</h2>
              {meeting.project_name && (
                <p className="text-xs text-muted-foreground mt-0.5">{meeting.project_name}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(["details", "minutes"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold capitalize transition-colors",
                activeTab === tab
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "details" ? "Details" : "Minutes"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-5">
          {activeTab === "details" ? (
            <>
              {/* Time */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Time</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {formatDateTime(meeting.start_time)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ends at {formatTimeOnly(meeting.end_time)}
                  </p>
                </div>
              </div>

              {/* Location */}
              {meeting.location_detail && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    {meeting.location_type === "virtual" ? (
                      <Video className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">
                      {meeting.location_type === "virtual" ? "Meeting Link" : "Location"}
                    </p>
                    {meeting.location_type === "virtual" ? (
                      <a
                        href={meeting.location_detail}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-primary hover:underline break-all flex items-center gap-1 mt-0.5"
                      >
                        {meeting.location_detail}
                        <ChevronRight className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {meeting.location_detail}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Organizer */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Organizer</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {meeting.organizer_name ?? "Unknown"}
                    {isOrganizer && (
                      <span className="ml-1.5 text-xs text-muted-foreground font-normal">(you)</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Attendees */}
              {meeting.attendees.length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-medium mb-2">
                      Attendees ({meeting.attendees.length})
                    </p>
                    <div className="space-y-1.5">
                      {meeting.attendees.map((a, idx) => {
                        const cfg = RSVP_CONFIG[a.rsvp_status];
                        return (
                          <div
                            key={a.user?.id ?? `att-${idx}`}
                            className="flex items-center justify-between"
                          >
                            <span className="text-sm text-foreground">
                              {a.user?.full_name ?? a.user?.email ?? "Unknown"}
                              {a.user?.id === currentUserId && (
                                <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                              )}
                            </span>
                            <div
                              className={cn(
                                "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md",
                                cfg.bg,
                                cfg.text
                              )}
                            >
                              <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                              {cfg.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* RSVP buttons */}
              {showRsvpButtons && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground font-medium mb-2">Your RSVP</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRsvp("accepted")}
                      disabled={!!rsvpLoading || currentAttendee?.rsvp_status === "accepted"}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
                        currentAttendee?.rsvp_status === "accepted"
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950"
                      )}
                    >
                      {rsvpLoading === "accepted" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={() => handleRsvp("declined")}
                      disabled={!!rsvpLoading || currentAttendee?.rsvp_status === "declined"}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
                        currentAttendee?.rsvp_status === "declined"
                          ? "bg-rose-600 text-white"
                          : "bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-950"
                      )}
                    >
                      {rsvpLoading === "declined" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      Decline
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Minutes tab */
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span className="text-xs font-medium">
                  {canEditMinutes ? "Edit meeting notes" : "View meeting notes"}
                </span>
              </div>

              {canEditMinutes ? (
                <>
                  <textarea
                    id="meeting-minutes-textarea"
                    value={minutesContent}
                    onChange={(e) => setMinutesContent(e.target.value)}
                    placeholder="Record decisions, action items, and discussion notes…"
                    rows={8}
                    className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {meeting.minutes ? "Last saved" : "No notes saved yet"}
                    </p>
                    <button
                      onClick={handleSaveMinutes}
                      disabled={isSavingMinutes}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                        minutesSaved
                          ? "bg-emerald-600 text-white"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                    >
                      {isSavingMinutes ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : minutesSaved ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      {minutesSaved ? "Saved!" : "Save Notes"}
                    </button>
                  </div>
                </>
              ) : minutesContent ? (
                <div className="text-sm text-foreground bg-secondary/40 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                  {minutesContent}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No meeting notes recorded yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
