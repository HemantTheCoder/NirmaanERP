"use client";

import { useState, useRef, useEffect } from "react";
import { X, MapPin, Video, Users, ChevronDown, Check, Loader2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LocationType } from "@/lib/queries/meetings";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MeetingFormData {
  title: string;
  project_id: string;
  start_datetime: string; // datetime-local value "YYYY-MM-DDTHH:MM"
  end_datetime: string;
  location_type: LocationType;
  location_detail: string;
  attendee_ids: string[];
}

interface MeetingFormModalProps {
  isOpen: boolean;
  projects: { id: string; name: string }[];
  users: { id: string; full_name: string | null; email: string }[];
  currentUserId: string;
  prefilledDatetime?: string; // optional pre-fill for start_datetime
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (data: MeetingFormData) => Promise<void>;
}

// ── Attendee multi-select ─────────────────────────────────────────────────────

function AttendeeSelect({
  users,
  currentUserId,
  selected,
  onChange,
}: {
  users: { id: string; full_name: string | null; email: string }[];
  currentUserId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const filtered = users
    .filter((u) => u.id !== currentUserId) // exclude self (organizer)
    .filter((u) => {
      const name = u.full_name?.toLowerCase() ?? "";
      const email = u.email.toLowerCase();
      const q = search.toLowerCase();
      return name.includes(q) || email.includes(q);
    });

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const selectedUsers = users.filter((u) => selected.includes(u.id));

  return (
    <div className="relative" ref={panelRef}>
      {/* Selected chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedUsers.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 text-xs bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 rounded-full px-2 py-0.5 font-medium"
            >
              {u.full_name ?? u.email}
              <button
                type="button"
                onClick={() => toggle(u.id)}
                className="hover:text-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 text-sm bg-background border border-border rounded-lg",
          "text-muted-foreground hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        )}
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span>{selected.length === 0 ? "Add attendees…" : `${selected.length} selected`}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 text-center">No users found</p>
            ) : (
              filtered.map((u) => {
                const isChecked = selected.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    className={cn(
                      "w-full text-left flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                      isChecked && "bg-indigo-50/50 dark:bg-indigo-950/20"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                        isChecked
                          ? "bg-indigo-600 border-indigo-600"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {isChecked && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p className="font-medium text-foreground leading-tight">
                        {u.full_name ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main form component ───────────────────────────────────────────────────────

export function MeetingFormModal({
  isOpen,
  projects,
  users,
  currentUserId,
  prefilledDatetime,
  isSubmitting = false,
  onClose,
  onSubmit,
}: MeetingFormModalProps) {
  const now = new Date();
  // Default start = next full hour, end = start + 1h
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaultDate = prefilledDatetime
    ? prefilledDatetime.split("T")[0]
    : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const defaultHour = pad(now.getHours() + 1);
  const defaultStart = prefilledDatetime ?? `${defaultDate}T${defaultHour}:00`;
  const defaultEnd = prefilledDatetime
    ? `${prefilledDatetime.split("T")[0]}T${pad(parseInt(prefilledDatetime.split("T")[1]?.split(":")[0] ?? "9", 10) + 1)}:00`
    : `${defaultDate}T${pad(now.getHours() + 2)}:00`;

  const [form, setForm] = useState<MeetingFormData>({
    title: "",
    project_id: "",
    start_datetime: defaultStart,
    end_datetime: defaultEnd,
    location_type: "virtual",
    location_detail: "",
    attendee_ids: [],
  });

  // Reset when opened fresh
  useEffect(() => {
    if (isOpen) {
      setForm({
        title: "",
        project_id: "",
        start_datetime: prefilledDatetime ?? defaultStart,
        end_datetime: defaultEnd,
        location_type: "virtual",
        location_detail: "",
        attendee_ids: [],
      });
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const set = <K extends keyof MeetingFormData>(key: K, value: MeetingFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (form.start_datetime >= form.end_datetime) {
      alert("End time must be after start time.");
      return;
    }
    await onSubmit(form);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-4.5 h-4.5 text-muted-foreground" />
            <h2 className="text-sm font-bold text-foreground">New Meeting</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground" htmlFor="meeting-title">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="meeting-title"
              type="text"
              required
              maxLength={120}
              placeholder="e.g. Weekly site coordination call"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Project (optional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground" htmlFor="meeting-project">
              Project <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <select
              id="meeting-project"
              value={form.project_id}
              onChange={(e) => set("project_id", e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— Not project-specific —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start datetime */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground" htmlFor="meeting-start">
              Start <span className="text-rose-500">*</span>
            </label>
            <input
              id="meeting-start"
              type="datetime-local"
              required
              value={form.start_datetime}
              onChange={(e) => set("start_datetime", e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* End datetime */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground" htmlFor="meeting-end">
              End <span className="text-rose-500">*</span>
            </label>
            <input
              id="meeting-end"
              type="datetime-local"
              required
              value={form.end_datetime}
              onChange={(e) => set("end_datetime", e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Location type toggle */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">Location Type</p>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["virtual", "on_site"] as LocationType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => set("location_type", type)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-colors",
                    form.location_type === type
                      ? type === "virtual"
                        ? "bg-indigo-600 text-white"
                        : "bg-emerald-600 text-white"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {type === "virtual" ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                  {type === "virtual" ? "Virtual" : "On-site"}
                </button>
              ))}
            </div>
          </div>

          {/* Location detail */}
          <div className="space-y-1.5">
            <label
              className="block text-xs font-semibold text-foreground"
              htmlFor="meeting-location-detail"
            >
              {form.location_type === "virtual" ? "Meeting Link" : "Address / Site Location"}
              <span className="text-muted-foreground font-normal ml-1">(optional)</span>
            </label>
            <input
              id="meeting-location-detail"
              type="text"
              placeholder={
                form.location_type === "virtual"
                  ? "https://meet.google.com/..."
                  : "Site address or gate number"
              }
              value={form.location_detail}
              onChange={(e) => set("location_detail", e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Attendees */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">
              Attendees <span className="text-muted-foreground font-normal">(optional)</span>
            </p>
            <AttendeeSelect
              users={users}
              currentUserId={currentUserId}
              selected={form.attendee_ids}
              onChange={(ids) => set("attendee_ids", ids)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-secondary/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !form.title.trim()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground transition-all"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Meeting
          </button>
        </div>
      </form>
    </div>
  );
}
