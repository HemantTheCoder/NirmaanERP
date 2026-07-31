"use client";

import { useState } from "react";
import { CheckSquare, CalendarDays, User, Clock } from "lucide-react";
import { KanbanBoard } from "@/components/workspace/KanbanBoard";
import { MyLeavesTab } from "@/components/workspace/MyLeavesTab";
import { ProfileTab } from "@/components/workspace/ProfileTab";
import { AttendanceTab } from "@/components/workspace/AttendanceTab";
import type { TaskWithProject } from "@/lib/queries/tasks";
import type { LeaveItem } from "@/lib/queries/leaves";
import type { AttendanceItem } from "@/lib/queries/attendance";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface WorkspaceViewProps {
  initialTasks: TaskWithProject[];
  initialLeaves: LeaveItem[];
  projects: { id: string; name: string }[];
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
    phone?: string | null;
    avatar_url?: string | null;
  };
  initialTodayAttendance: AttendanceItem | null;
  initialAttendanceHistory: AttendanceItem[];
}

export function WorkspaceView({
  initialTasks,
  initialLeaves,
  projects,
  user,
  initialTodayAttendance,
  initialAttendanceHistory,
}: WorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "leaves" | "profile" | "attendance">("tasks");

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">My Workspace</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Personal task Kanban board, leave requests, attendance check-in, and profile management.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap bg-secondary/80 p-1 rounded-xl border border-border self-start sm:self-auto gap-1">
          <button
            onClick={() => setActiveTab("tasks")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
              activeTab === "tasks"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckSquare className="w-3.5 h-3.5 text-primary" />
            My Tasks
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {initialTasks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("leaves")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
              activeTab === "leaves"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
            My Leaves
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {initialLeaves.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("attendance")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
              activeTab === "attendance"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            Attendance
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
              activeTab === "profile"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="w-3.5 h-3.5 text-amber-500" />
            Profile
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === "tasks" && (
        <KanbanBoard initialTasks={initialTasks} projects={projects} userId={user.id} />
      )}

      {activeTab === "leaves" && (
        <MyLeavesTab initialLeaves={initialLeaves} userId={user.id} />
      )}

      {activeTab === "attendance" && (
        <AttendanceTab
          userId={user.id}
          initialToday={initialTodayAttendance}
          initialHistory={initialAttendanceHistory}
        />
      )}

      {activeTab === "profile" && (
        <ProfileTab user={user} />
      )}
    </div>
  );
}
