"use client";

import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";
import { NotificationBell } from "./NotificationBell";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects":  "Projects",
  "/workspace": "My Workspace",
  "/schedule":  "Schedule",
  "/reports":   "Reports",
  "/admin":     "Admin",
};

interface HeaderProps {
  user: {
    full_name: string;
    role: UserRole;
  };
  userId: string;
  onMenuToggle: () => void;
}

export function Header({ user, userId, onMenuToggle }: HeaderProps) {
  const pathname = usePathname();

  const title =
    Object.entries(PAGE_TITLES).find(([path]) =>
      pathname === path || pathname.startsWith(path + "/")
    )?.[1] ?? "Nirmaan ERP";

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="h-16 flex items-center gap-4 px-6 bg-white border-b border-slate-200 shrink-0 shadow-sm">
      {/* Mobile menu toggle */}
      <button
        id="mobile-menu-toggle"
        onClick={onMenuToggle}
        className="md:hidden text-muted-foreground hover:text-foreground transition-colors p-1"
        aria-label="Toggle menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title + date */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-foreground leading-none">{title}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{today}</p>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 w-48 lg:w-64">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          id="global-search"
          type="text"
          placeholder="Search…"
          className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full"
        />
      </div>

      {/* Notifications */}
      <NotificationBell userId={userId} />

      {/* User initials chip */}
      <div
        className={cn(
          "hidden sm:flex items-center gap-2 text-sm font-medium text-foreground"
        )}
      >
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          {user.full_name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
      </div>
    </header>
  );
}
