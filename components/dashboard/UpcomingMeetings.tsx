import { Video, Users, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface Meeting {
  id: string;
  title: string;
  time: string;
  date: string;
  type: "virtual" | "on_site" | "office";
  attendees: string[];
}

const MEETINGS: Meeting[] = [
  {
    id: "m1",
    title: "Site Review — Tower A",
    time: "09:30 AM",
    date: "Today",
    type: "on_site",
    attendees: ["AS", "PR", "RM"],
  },
  {
    id: "m2",
    title: "Stakeholder Sprint Review",
    time: "02:00 PM",
    date: "Today",
    type: "virtual",
    attendees: ["SR", "AM", "KP", "VB"],
  },
  {
    id: "m3",
    title: "Safety Briefing — NH-48",
    time: "10:00 AM",
    date: "Tomorrow",
    type: "on_site",
    attendees: ["PN", "DK"],
  },
];

const typeConfig = {
  virtual: {
    icon: Video,
    label: "Virtual",
    color: "bg-indigo-100 text-indigo-900 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  },
  on_site: {
    icon: MapPin,
    label: "On-site",
    color: "bg-emerald-100 text-emerald-900 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
  office: {
    icon: Users,
    label: "Office",
    color: "bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
};

const avatarColors = [
  "bg-indigo-600 text-white",
  "bg-violet-600 text-white",
  "bg-emerald-600 text-white",
  "bg-rose-600 text-white",
  "bg-amber-600 text-white",
];

export function UpcomingMeetings() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 h-full">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-foreground text-base">Upcoming Meetings</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{MEETINGS.length} scheduled</span>
      </div>

      <div className="space-y-4">
        {MEETINGS.map((meeting, mi) => {
          const config = typeConfig[meeting.type];
          const TypeIcon = config.icon;

          return (
            <div
              key={meeting.id}
              id={`meeting-${meeting.id}`}
              className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-default"
            >
              {/* Time column */}
              <div className="shrink-0 text-right w-16">
                <p className="text-xs font-bold text-foreground">{meeting.time}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{meeting.date}</p>
              </div>

              {/* Divider */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1 shrink-0" />
                {mi < MEETINGS.length - 1 && (
                  <div className="w-px flex-1 bg-border" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 pb-1">
                <p className="text-sm font-semibold text-foreground leading-tight">{meeting.title}</p>

                <div className={cn("inline-flex items-center gap-1 mt-1.5 text-xs px-2 py-0.5 rounded-md font-semibold", config.color)}>
                  <TypeIcon className="w-3 h-3" />
                  {config.label}
                </div>

                {/* Attendee avatars */}
                <div className="flex items-center gap-1 mt-2">
                  {meeting.attendees.slice(0, 4).map((initials, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-5.5 h-5.5 rounded-full flex items-center justify-center text-[9px] font-bold -ml-1 first:ml-0 border border-card shadow-2xs",
                        avatarColors[i % avatarColors.length]
                      )}
                      title={initials}
                    >
                      {initials}
                    </div>
                  ))}
                  {meeting.attendees.length > 4 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1 font-medium">
                      +{meeting.attendees.length - 4}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
