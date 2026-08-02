"use client";

import { useState } from "react";
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  History,
  MapPin,
  ShieldAlert,
  Navigation,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkIn, checkOut, type AttendanceItem } from "@/lib/queries/attendance";
import { calculateHaversineDistanceMeters } from "@/lib/utils/haversine";
import type { ProjectWithManager } from "@/lib/queries/projects";
import { cn } from "@/lib/utils";

interface AttendanceTabProps {
  userId: string;
  initialToday: AttendanceItem | null;
  initialHistory: AttendanceItem[];
  projects?: ProjectWithManager[];
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  present:  { label: "Present (On-Time)", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
  late:     { label: "Late Arrival",      bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
  absent:   { label: "Absent",            bg: "bg-rose-100 dark:bg-rose-950/60",     text: "text-rose-800 dark:text-rose-300" },
  half_day: { label: "Half Day",          bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  on_leave: { label: "On Leave",          bg: "bg-slate-100 dark:bg-slate-800",       text: "text-slate-700 dark:text-slate-300" },
};

function formatTime(isoString: string | null): string {
  if (!isoString) return "--:--";
  return new Date(isoString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function calculateHoursWorked(checkInIso: string | null, checkOutIso: string | null): string {
  if (!checkInIso || !checkOutIso) return "N/A";
  const start = new Date(checkInIso).getTime();
  const end = new Date(checkOutIso).getTime();
  const diffMs = end - start;
  if (diffMs <= 0) return "0 hrs";

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function AttendanceTab({
  userId,
  initialToday,
  initialHistory,
  projects = [],
}: AttendanceTabProps) {
  const supabase = createClient();

  const [todayRecord, setTodayRecord] = useState<AttendanceItem | null>(initialToday);
  const [history, setHistory] = useState<AttendanceItem[]>(initialHistory);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Soft-Warn Geofence Modal State
  const [pendingGeofenceWarning, setPendingGeofenceWarning] = useState<{
    latitude: number;
    longitude: number;
    distanceMeters: number;
    radiusMeters: number;
    projectName: string;
  } | null>(null);

  // Default project selection for site geofencing check
  const activeProject = projects.find((p) => p.site_latitude !== null && p.site_longitude !== null) || projects[0];

  const executeCheckInMutation = async (geofenceData?: {
    latitude?: number | null;
    longitude?: number | null;
    withinGeofence?: boolean | null;
    distanceMeters?: number | null;
  }) => {
    setIsLoading(true);
    setErrorMsg(null);

    const res = await checkIn(supabase, userId, geofenceData);
    setIsLoading(false);

    if (!res.success || !res.attendance) {
      setErrorMsg(res.error || "Failed to record check-in.");
    } else {
      setTodayRecord(res.attendance);
      setHistory((prev) => [res.attendance!, ...prev.filter((h) => h.id !== res.attendance!.id)]);
    }
  };

  const handleCheckInClick = () => {
    setIsLoading(true);
    setErrorMsg(null);

    if (!navigator.geolocation) {
      // Geolocation unsupported — proceed without geofence data (soft pass)
      executeCheckInMutation({ withinGeofence: null, distanceMeters: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        if (activeProject && activeProject.site_latitude !== null && activeProject.site_longitude !== null) {
          const siteLat = Number(activeProject.site_latitude);
          const siteLng = Number(activeProject.site_longitude);
          const radiusMeters = activeProject.geofence_radius_meters || 250;

          const distanceMeters = calculateHaversineDistanceMeters(userLat, userLng, siteLat, siteLng);

          if (distanceMeters > radiusMeters) {
            // Trigger Soft-Warn Confirmation Dialog!
            setIsLoading(false);
            setPendingGeofenceWarning({
              latitude: userLat,
              longitude: userLng,
              distanceMeters,
              radiusMeters,
              projectName: activeProject.name,
            });
            return;
          }

          // Within geofence radius
          executeCheckInMutation({
            latitude: userLat,
            longitude: userLng,
            withinGeofence: true,
            distanceMeters,
          });
        } else {
          // No site lat/lng configured — store coordinates
          executeCheckInMutation({
            latitude: userLat,
            longitude: userLng,
            withinGeofence: true,
            distanceMeters: 0,
          });
        }
      },
      (err) => {
        console.warn("Geolocation permission denied or error:", err.message);
        // Permission denied / GPS unavailable — soft-warn pass (no block)
        executeCheckInMutation({ withinGeofence: null, distanceMeters: null });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const handleConfirmSoftWarnCheckIn = () => {
    if (!pendingGeofenceWarning) return;
    const { latitude, longitude, distanceMeters } = pendingGeofenceWarning;
    setPendingGeofenceWarning(null);

    executeCheckInMutation({
      latitude,
      longitude,
      withinGeofence: false,
      distanceMeters,
    });
  };

  const handleCheckOut = async () => {
    if (!todayRecord) return;

    setIsLoading(true);
    setErrorMsg(null);

    const res = await checkOut(supabase, userId);
    setIsLoading(false);

    if (!res.success || !res.attendance) {
      setErrorMsg(res.error || "Failed to record check-out.");
    } else {
      setTodayRecord(res.attendance);
      setHistory((prev) => prev.map((h) => (h.id === res.attendance!.id ? res.attendance! : h)));
    }
  };

  const todayStatusCfg = todayRecord ? STATUS_BADGES[todayRecord.status] || STATUS_BADGES.present : null;

  return (
    <div className="space-y-6">
      {/* Banner Error */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Today's Status Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Status info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Today&apos;s Attendance Status
              </span>
            </div>

            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-foreground">
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h3>

              {todayStatusCfg && (
                <span
                  className={cn(
                    "inline-block px-3 py-1 rounded-full text-xs font-semibold",
                    todayStatusCfg.bg,
                    todayStatusCfg.text
                  )}
                >
                  {todayStatusCfg.label}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Official shift cutoff: <span className="font-semibold text-foreground">9:30 AM</span>. GPS geofence boundary: <span className="font-semibold text-foreground">{activeProject?.geofence_radius_meters || 250}m radius</span> around {activeProject?.name || "site"}.
            </p>
          </div>

          {/* Timestamps & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-secondary/40 p-4 rounded-xl border border-border shrink-0">
            <div className="flex items-center gap-6 text-xs">
              <div>
                <p className="text-muted-foreground font-medium">Check In</p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {todayRecord?.check_in ? formatTime(todayRecord.check_in) : "--:--"}
                </p>
              </div>

              <div className="h-8 w-px bg-border" />

              <div>
                <p className="text-muted-foreground font-medium">Check Out</p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {todayRecord?.check_out ? formatTime(todayRecord.check_out) : "--:--"}
                </p>
              </div>

              <div className="h-8 w-px bg-border" />

              <div>
                <p className="text-muted-foreground font-medium">Hours</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {calculateHoursWorked(todayRecord?.check_in || null, todayRecord?.check_out || null)}
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto">
              {!todayRecord ? (
                <button
                  onClick={handleCheckInClick}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all shadow-md shadow-emerald-500/20"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  Check In Now
                </button>
              ) : !todayRecord.check_out ? (
                <button
                  onClick={handleCheckOut}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold bg-amber-600 text-white rounded-xl hover:bg-amber-500 transition-all shadow-sm"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  Check Out
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Shift Completed
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-500" />
            Attendance Logs & GPS Geofence Audit (Last 30 Days)
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Check In</th>
                <th className="px-5 py-3.5">Check Out</th>
                <th className="px-5 py-3.5">Hours Worked</th>
                <th className="px-5 py-3.5">GPS Site Geofence Audit</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground">
                    No attendance records found for the past 30 days.
                  </td>
                </tr>
              ) : (
                history.map((record) => {
                  const statusCfg = STATUS_BADGES[record.status] || STATUS_BADGES.present;

                  return (
                    <tr key={record.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-foreground">
                        {new Date(record.date).toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="px-5 py-3.5 text-muted-foreground font-medium">
                        {formatTime(record.check_in)}
                      </td>

                      <td className="px-5 py-3.5 text-muted-foreground font-medium">
                        {formatTime(record.check_out)}
                      </td>

                      <td className="px-5 py-3.5 font-semibold text-foreground">
                        {calculateHoursWorked(record.check_in, record.check_out)}
                      </td>

                      {/* GPS Geofence Audit Column */}
                      <td className="px-5 py-3.5">
                        {record.check_in_within_geofence === true ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            On-Site ({record.check_in_distance_meters ?? 0}m)
                          </span>
                        ) : record.check_in_within_geofence === false ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
                            title={`Flagged: ${record.check_in_distance_meters}m from site boundary`}
                          >
                            <ShieldAlert className="w-3 h-3 text-amber-600" />
                            ⚠ {record.check_in_distance_meters}m from site
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            <Navigation className="w-3 h-3" />
                            Location Access Denied / Unavailable
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <span
                          className={cn(
                            "inline-block px-2.5 py-1 rounded-md text-xs font-semibold",
                            statusCfg.bg,
                            statusCfg.text
                          )}
                        >
                          {statusCfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SOFT-WARN GEOFENCE CONFIRMATION MODAL */}
      {pendingGeofenceWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Geofence Distance Soft-Warn</h3>
                <p className="text-[11px] text-muted-foreground">Location Audit Verification</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 space-y-2 text-xs">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                You appear to be approximately <strong className="text-foreground font-extrabold">{pendingGeofenceWarning.distanceMeters} meters</strong> away from the {pendingGeofenceWarning.projectName} site boundary.
              </p>
              <p className="text-amber-700/90 dark:text-amber-300/80 text-[11px] leading-relaxed">
                The configured geofence radius for this site is {pendingGeofenceWarning.radiusMeters}m. GPS signal drift, indoor interference, or dense urban building shade may cause minor distance variances.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Would you like to proceed with check-in anyway? Your computed distance will be recorded in the site manager audit log.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setPendingGeofenceWarning(null)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel & Retry
              </button>

              <button
                type="button"
                onClick={handleConfirmSoftWarnCheckIn}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-xs transition-all"
              >
                Proceed Check-In Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
