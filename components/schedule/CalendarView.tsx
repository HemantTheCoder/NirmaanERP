"use client";

import { useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  CalendarDays,
  Video,
  MapPin,
  X,
  Loader2,
} from "lucide-react";
import { cn, toLocalDateStr } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  getMeetings,
  getMeetingById,
  createMeetingWithAttendees,
  type MeetingForCalendar,
  type MeetingWithDetails,
  type LocationType,
} from "@/lib/queries/meetings";
import { MeetingFormModal, type MeetingFormData } from "./MeetingFormModal";
import { MeetingDetailModal } from "./MeetingDetailModal";
import type { UserRole } from "@/types/database";

// ── Calendar helper fns ───────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const WEEK_DAYS_LONG = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

/** ISO YYYY-MM-DD in local timezone */
function localDateStr(date: Date): string {
  return toLocalDateStr(date);
}

/** YYYY-MM-DD of a meeting's start_time in local timezone */
function meetingLocalDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-CA");
}

/** "09:30 AM" from ISO */
function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "Wed, 6 Aug" */
function formatDayHeader(date: Date): string {
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** "Wednesday, 6 August 2026" */
function formatDayFull(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Build a 42-element (6-week) grid starting on the Monday before the 1st of the month.
 */
function buildMonthGrid(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay(); // 0=Sun … 6=Sat
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon-first offset

  const grid: Date[] = [];
  const cursor = new Date(firstDay);
  cursor.setDate(cursor.getDate() - daysBack);

  for (let i = 0; i < 42; i++) {
    grid.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return grid;
}

/**
 * Returns the Monday of the week containing `date`.
 */
function weekMonday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function buildWeekGrid(anchorDate: Date): Date[] {
  const monday = weekMonday(anchorDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

// ── Meeting block pill ────────────────────────────────────────────────────────

function MeetingPill({
  meeting,
  onClick,
}: {
  meeting: MeetingForCalendar;
  onClick: (m: MeetingForCalendar) => void;
}) {
  const isVirtual = meeting.location_type === "virtual";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(meeting);
      }}
      title={meeting.title}
      className={cn(
        "w-full text-left text-[10px] px-1.5 py-0.5 rounded font-medium truncate",
        "hover:brightness-95 transition-all duration-100 leading-tight",
        isVirtual
          ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300"
          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
      )}
    >
      {formatTimeShort(meeting.start_time)} {meeting.title}
    </button>
  );
}

// ── Side panel: day detail ────────────────────────────────────────────────────

function DayPanel({
  dateStr,
  meetings,
  onClose,
  onMeetingClick,
  onNewMeeting,
}: {
  dateStr: string;
  meetings: MeetingForCalendar[];
  onClose: () => void;
  onMeetingClick: (m: MeetingForCalendar) => void;
  onNewMeeting: (prefilledDatetime: string) => void;
}) {
  const date = new Date(dateStr + "T12:00"); // parse at noon to avoid DST issues
  const prefilledDatetime = `${dateStr}T09:00`;

  return (
    <div className="w-72 shrink-0 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
        <div>
          <p className="text-xs font-bold text-foreground leading-tight">
            {date.toLocaleDateString("en-IN", { weekday: "long" })}
          </p>
          <p className="text-xs text-muted-foreground">
            {date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Meeting list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {meetings.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CalendarDays className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs">No meetings on this day</p>
          </div>
        ) : (
          meetings.map((m) => {
            const isVirtual = m.location_type === "virtual";
            return (
              <button
                key={m.id}
                onClick={() => onMeetingClick(m)}
                className="w-full text-left group p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/40 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  {isVirtual ? (
                    <Video className="w-3 h-3 text-indigo-500 shrink-0" />
                  ) : (
                    <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                  )}
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                      isVirtual
                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    )}
                  >
                    {isVirtual ? "Virtual" : "On-site"}
                  </span>
                </div>
                <p className="text-xs font-semibold text-foreground leading-tight truncate">
                  {m.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatTimeShort(m.start_time)} – {formatTimeShort(m.end_time)}
                </p>
                {m.project_name && (
                  <p className="text-[11px] text-muted-foreground truncate">{m.project_name}</p>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Quick add */}
      <div className="p-3 border-t border-border">
        <button
          onClick={() => onNewMeeting(prefilledDatetime)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New meeting on this day
        </button>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CalendarViewProps {
  initialMeetings: MeetingForCalendar[];
  projects: { id: string; name: string }[];
  users: { id: string; full_name: string | null; email: string }[];
  currentUserId: string;
  currentUserRole: UserRole;
}

// ── Main component ────────────────────────────────────────────────────────────

export function CalendarView({
  initialMeetings,
  projects,
  users,
  currentUserId,
  currentUserRole,
}: CalendarViewProps) {
  const supabase = createClient();
  const todayStr = localDateStr(new Date());

  // ── State ──────────────────────────────────────────────────────────────────
  const [meetings, setMeetings] = useState<MeetingForCalendar[]>(initialMeetings);
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithDetails | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [prefilledDatetime, setPrefilledDatetime] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const prevPeriod = () => {
    if (viewMode === "month") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    } else {
      setCurrentDate((d) => new Date(d.getTime() - 7 * 86_400_000));
    }
    setSelectedDay(null);
  };

  const nextPeriod = () => {
    if (viewMode === "month") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    } else {
      setCurrentDate((d) => new Date(d.getTime() + 7 * 86_400_000));
    }
    setSelectedDay(null);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(todayStr);
  };

  // ── Period label ───────────────────────────────────────────────────────────

  const periodLabel =
    viewMode === "month"
      ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
      : (() => {
          const days = buildWeekGrid(currentDate);
          const first = days[0];
          const last = days[6];
          if (first.getMonth() === last.getMonth()) {
            return `${first.getDate()}–${last.getDate()} ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
          }
          return `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`;
        })();

  // ── Meetings for a day ─────────────────────────────────────────────────────

  const meetingsForDay = useCallback(
    (dateStr: string) =>
      meetings
        .filter((m) => meetingLocalDate(m.start_time) === dateStr && m.status !== "cancelled")
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [meetings]
  );

  // ── Meeting click → load detail ────────────────────────────────────────────

  const handleMeetingClick = async (m: MeetingForCalendar) => {
    setIsLoadingDetail(true);
    const detail = await getMeetingById(supabase, m.id);
    setSelectedMeeting(detail);
    setIsLoadingDetail(false);
  };

  // Re-fetch detail after RSVP / minutes update
  const handleMeetingUpdated = async (meetingId: string) => {
    const detail = await getMeetingById(supabase, meetingId);
    setSelectedMeeting(detail);
  };

  // ── Open form ──────────────────────────────────────────────────────────────

  const openForm = (prefilledDatetime?: string) => {
    setPrefilledDatetime(prefilledDatetime);
    setIsFormOpen(true);
  };

  // ── Create meeting ─────────────────────────────────────────────────────────

  const handleCreateMeeting = async (formData: MeetingFormData) => {
    setIsSubmitting(true);
    try {
      const start_time = new Date(formData.start_datetime).toISOString();
      const end_time = new Date(formData.end_datetime).toISOString();

      const { data, error } = await createMeetingWithAttendees(
        supabase,
        {
          title: formData.title,
          project_id: formData.project_id || undefined,
          organizer_id: currentUserId,
          start_time,
          end_time,
          location_type: formData.location_type,
          location_detail: formData.location_detail || undefined,
        },
        formData.attendee_ids
      );

      if (error) {
        console.error("Failed to create meeting:", error);
        alert(`Failed to create meeting: ${error.message || "Database insert error"}`);
        return;
      }

      // Re-fetch all meetings to sync state
      const fresh = await getMeetings(supabase);
      setMeetings(fresh);
      setIsFormOpen(false);
    } catch (err: any) {
      console.error("Error creating meeting:", err);
      alert(`Error creating meeting: ${err.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderMonthView = () => {
    const grid = buildMonthGrid(currentDate);
    const currentMonth = currentDate.getMonth();

    return (
      <>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEK_DAYS_LONG.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[11px] font-semibold text-muted-foreground tracking-wide"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 flex-1">
          {grid.map((date, idx) => {
            const ds = localDateStr(date);
            const isCurrentMonth = date.getMonth() === currentMonth;
            const isToday = ds === todayStr;
            const isSelected = ds === selectedDay;
            const dayMeetings = meetingsForDay(ds);

            return (
              <div
                key={idx}
                onClick={() => setSelectedDay(isSelected ? null : ds)}
                className={cn(
                  "min-h-24 p-1.5 border-r border-b border-border cursor-pointer transition-colors",
                  "hover:bg-muted/30",
                  isSelected && "bg-indigo-50/60 dark:bg-indigo-950/20",
                  isToday && !isSelected && "bg-primary/5",
                  !isCurrentMonth && "text-muted-foreground opacity-75"
                )}
              >
                {/* Date number */}
                <div className="flex justify-start mb-1">
                  <span
                    className={cn(
                      "w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-full",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground"
                    )}
                  >
                    {date.getDate()}
                  </span>
                </div>

                {/* Meeting pills */}
                <div className="space-y-0.5">
                  {dayMeetings.slice(0, 2).map((m) => (
                    <MeetingPill key={m.id} meeting={m} onClick={handleMeetingClick} />
                  ))}
                  {dayMeetings.length > 2 && (
                    <p className="text-[10px] text-muted-foreground pl-1 font-medium">
                      +{dayMeetings.length - 2} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderWeekView = () => {
    const days = buildWeekGrid(currentDate);

    return (
      <>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {days.map((date, idx) => {
            const ds = localDateStr(date);
            const isToday = ds === todayStr;
            const isSelected = ds === selectedDay;
            return (
              <div
                key={idx}
                onClick={() => setSelectedDay(isSelected ? null : ds)}
                className={cn(
                  "py-2 px-2 text-center cursor-pointer hover:bg-muted/30 transition-colors border-r border-border last:border-r-0",
                  isSelected && "bg-indigo-50/60 dark:bg-indigo-950/20",
                  isToday && !isSelected && "bg-primary/5"
                )}
              >
                <p className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                  {WEEK_DAYS_LONG[idx]}
                </p>
                <div
                  className={cn(
                    "mx-auto mt-1 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  )}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Week columns */}
        <div className="grid grid-cols-7 flex-1 overflow-y-auto">
          {days.map((date, idx) => {
            const ds = localDateStr(date);
            const dayMeetings = meetingsForDay(ds);

            return (
              <div
                key={idx}
                className="border-r border-border last:border-r-0 p-2 space-y-1.5 min-h-48"
              >
                {dayMeetings.length === 0 ? (
                  <div className="h-full" />
                ) : (
                  dayMeetings.map((m) => {
                    const isVirtual = m.location_type === "virtual";
                    return (
                      <button
                        key={m.id}
                        onClick={() => handleMeetingClick(m)}
                        className={cn(
                          "w-full text-left rounded-lg p-2 text-[11px] hover:brightness-95 transition-all",
                          isVirtual
                            ? "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-200"
                            : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200"
                        )}
                      >
                        <p className="font-bold text-xs leading-tight truncate">{m.title}</p>
                        <p className="mt-0.5 opacity-80">
                          {formatTimeShort(m.start_time)}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────

  const selectedDayMeetings = selectedDay ? meetingsForDay(selectedDay) : [];

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[680px] pb-6">
      {/* Calendar panel */}
      <div className="flex-1 min-w-0 bg-card border border-border rounded-xl flex flex-col shadow-xs">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
          {/* Prev / Next */}
          <div className="flex items-center gap-1">
            <button
              onClick={prevPeriod}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
              aria-label="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-foreground min-w-[180px] text-center px-1">
              {periodLabel}
            </span>
            <button
              onClick={nextPeriod}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
              aria-label="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Today button */}
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:bg-secondary transition-colors"
          >
            Today
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setViewMode("month")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 transition-colors",
                viewMode === "month"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              Month
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 transition-colors border-l border-border",
                viewMode === "week"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Week
            </button>
          </div>

          {/* New meeting */}
          <button
            id="new-meeting-btn"
            onClick={() => openForm()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Meeting
          </button>
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {viewMode === "month" ? renderMonthView() : renderWeekView()}
        </div>
      </div>

      {/* Day panel (slide in) */}
      {selectedDay && (
        <DayPanel
          dateStr={selectedDay}
          meetings={selectedDayMeetings}
          onClose={() => setSelectedDay(null)}
          onMeetingClick={handleMeetingClick}
          onNewMeeting={(dt) => openForm(dt)}
        />
      )}

      {/* Meeting detail loading indicator */}
      {isLoadingDetail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl p-5 shadow-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">Loading meeting…</span>
          </div>
        </div>
      )}

      {/* Modals */}
      <MeetingFormModal
        isOpen={isFormOpen}
        projects={projects}
        users={users}
        currentUserId={currentUserId}
        prefilledDatetime={prefilledDatetime}
        isSubmitting={isSubmitting}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateMeeting}
      />

      {selectedMeeting && (
        <MeetingDetailModal
          meeting={selectedMeeting}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onClose={() => setSelectedMeeting(null)}
          onUpdated={handleMeetingUpdated}
        />
      )}
    </div>
  );
}
