"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Briefcase,
  CalendarDays,
  BarChart3,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  CheckCircle2,
  Building2,
  AlertCircle,
  ShieldAlert,
  Gavel,
  Info,
  ShoppingCart,
  HardHat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",       href: "/dashboard",   icon: LayoutDashboard },
  { label: "Projects",        href: "/projects",    icon: FolderKanban },
  { label: "My Workspace",    href: "/workspace",   icon: Briefcase },
  { label: "Tenders & Bids",  href: "/tenders",     icon: Gavel, allowedRoles: ["admin", "project_manager"] },
  { label: "Procurement",     href: "/procurement", icon: ShoppingCart, allowedRoles: ["admin", "project_manager"] },
  { label: "Subcontractors",  href: "/subcontractors", icon: HardHat, allowedRoles: ["admin", "project_manager"] },
  { label: "Schedule",        href: "/schedule",    icon: CalendarDays },
  { label: "Safety Reports",  href: "/safety",      icon: ShieldAlert },
  { label: "Report an Issue", href: "/grievances",  icon: AlertCircle },
  { label: "Approvals",       href: "/approvals",   icon: CheckCircle2, allowedRoles: ["admin", "project_manager"] },
  { label: "Reports",         href: "/reports",     icon: BarChart3, allowedRoles: ["admin", "project_manager"] },
  { label: "Admin",           href: "/admin",       icon: ShieldCheck, allowedRoles: ["admin"] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin:           "Administrator",
  project_manager: "Project Manager",
  site_staff:      "Site Staff",
  client:          "Client",
  contractor:      "Contractor",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin:           "bg-rose-500/20 text-rose-300",
  project_manager: "bg-indigo-500/20 text-indigo-300",
  site_staff:      "bg-emerald-500/20 text-emerald-300",
  client:          "bg-amber-500/20 text-amber-300",
  contractor:      "bg-violet-500/20 text-violet-300",
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  user: {
    email: string;
    full_name: string;
    role: UserRole;
    avatar_url: string | null;
  };
}

export function Sidebar({ collapsed, onToggle, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const CLIENT_NAV_ITEMS: NavItem[] = [
    { label: "Client Portal",   href: "/dashboard",   icon: LayoutDashboard },
    { label: "Safety Reports",  href: "/safety",      icon: ShieldAlert },
    { label: "Report an Issue", href: "/grievances",  icon: AlertCircle },
  ];

  const CONTRACTOR_NAV_ITEMS: NavItem[] = [
    { label: "Tenders & Bids",  href: "/tenders",     icon: Gavel },
    { label: "Report an Issue", href: "/grievances",  icon: AlertCircle },
  ];

  const visibleNav = user.role === "client"
    ? CLIENT_NAV_ITEMS
    : user.role === "contractor"
    ? CONTRACTOR_NAV_ITEMS
    : NAV_ITEMS.filter(
        (item) => !item.allowedRoles || item.allowedRoles.includes(user.role)
      );

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className={cn(
        "sidebar-transition flex flex-col bg-sidebar-bg border-r border-sidebar-border shrink-0 overflow-hidden",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border",
          collapsed && "justify-center px-0"
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-base tracking-tight leading-none">
            Nirmaan
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {visibleNav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative",
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-fg",
                collapsed && "justify-center px-0 w-10 mx-auto"
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive ? "text-white" : "text-sidebar-muted group-hover:text-sidebar-fg"
                )}
              />
              {!collapsed && <span>{item.label}</span>}

              {/* Tooltip when collapsed */}
              {collapsed && (
                <span className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl border border-white/10">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-sidebar-fg truncate leading-none mb-1">
                {user.full_name}
              </p>
              <span
                className={cn(
                  "inline-block text-xs px-1.5 py-0.5 rounded font-medium",
                  ROLE_COLORS[user.role]
                )}
              >
                {ROLE_LABELS[user.role]}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-3">
            <div
              className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold"
              title={user.full_name}
            >
              {initials}
            </div>
          </div>
        )}

        <Link
          href="/about"
          title={collapsed ? "About" : undefined}
          className={cn(
            "flex items-center gap-2 text-sm text-sidebar-muted hover:text-indigo-300 transition-colors rounded-lg px-2 py-1.5 hover:bg-white/5 w-full mb-1",
            pathname === "/about" && "bg-indigo-600 text-white font-medium shadow-md shadow-indigo-500/20",
            collapsed && "justify-center px-0"
          )}
        >
          <Info className={cn("w-4 h-4 shrink-0", pathname === "/about" ? "text-white" : "text-indigo-400")} />
          {!collapsed && <span>About</span>}
        </Link>

        <button
          id="logout-btn"
          onClick={handleLogout}
          title="Sign out"
          className={cn(
            "flex items-center gap-2 text-sm text-sidebar-muted hover:text-rose-400 transition-colors rounded-lg px-2 py-1.5 hover:bg-white/5 w-full",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        id="sidebar-toggle"
        onClick={onToggle}
        className="absolute right-0 translate-x-1/2 top-[72px] w-5 h-5 rounded-full bg-sidebar-border border border-sidebar-border text-sidebar-muted hover:text-white hover:bg-indigo-600 transition-all flex items-center justify-center shadow-md z-10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </aside>
  );
}
