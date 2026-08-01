import { Video, MapPin, CalendarDays, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { UpcomingMeetingItem } from "@/lib/queries/meetings";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMeetingTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatMeetingDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Avatar colors (cycling) ───────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-indigo-600 text-white",
  "bg-violet-600 text-white",
  "bg-emerald-600 text-white",
  "bg-rose-600 text-white",
  "bg-amber-600 text-white",
];

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  virtual: {
    icon: Video,
    label: "Virtual",
    color:
      "bg-indigo-100 text-indigo-900 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  },
  on_site: {
    icon: MapPin,
    label: "On-site",
    color:
      "bg-emerald-100 text-emerald-900 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface UpcomingMeetingsProps {
  meetings: UpcomingMeetingItem[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UpcomingMeetings({ meetings }: UpcomingMeetingsProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 h-full">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-foreground text-base">Upcoming Meetings</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">
            {meetings.length} scheduled
          </span>
          <Link
            href="/schedule"
            className="text-xs text-primary hover:underline font-medium flex items-center gap-0.5"
          >
            View all
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No upcoming meetings</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Head to{" "}
              <Link href="/schedule" className="text-primary hover:underline">
                Schedule
              </Link>{" "}
              to create one.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting, mi) => {
            const config = TYPE_CONFIG[meeting.location_type];
            const TypeIcon = config.icon;

            return (
              <div
                key={meeting.id}
                id={`meeting-${meeting.id}`}
                className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-default"
              >
                {/* Time column */}
                <div className="shrink-0 text-right w-16">
                  <p className="text-xs font-bold text-foreground">
                    {formatMeetingTime(meeting.start_time)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMeetingDate(meeting.start_time)}
                  </p>
                </div>

                {/* Timeline divider */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1 shrink-0" />
                  {mi < meetings.length - 1 && <div className="w-px flex-1 bg-border" />}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-sm font-semibold text-foreground leading-tight truncate">
                    {meeting.title}
                  </p>

                  <div
                    className={cn(
                      "inline-flex items-center gap-1 mt-1.5 text-xs px-2 py-0.5 rounded-md font-semibold",
                      config.color
                    )}
                  >
                    <TypeIcon className="w-3 h-3" />
                    {config.label}
                  </div>

                  {/* Attendee avatars */}
                  {meeting.attendee_initials.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      {meeting.attendee_initials.slice(0, 4).map((initials, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border border-card shadow-xs",
                            i > 0 && "-ml-1",
                            AVATAR_COLORS[i % AVATAR_COLORS.length]
                          )}
                          title={initials}
                        >
                          {initials}
                        </div>
                      ))}
                      {meeting.attendee_count > 4 && (
                        <span className="text-xs text-muted-foreground ml-1 font-medium">
                          +{meeting.attendee_count - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
