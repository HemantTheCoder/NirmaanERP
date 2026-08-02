"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, Sun, Moon } from "lucide-react";
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
  "/tenders":   "Tenders & Bidding",
  "/about":     "About Nirmaan ERP",
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
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check saved theme or system preference
    const savedTheme = localStorage.getItem("nirmaan-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    }
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("nirmaan-theme", "light");
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("nirmaan-theme", "dark");
      setIsDarkMode(true);
    }
  };

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
    <header className="h-16 flex items-center gap-4 px-6 bg-card border-b border-border shrink-0 shadow-xs transition-colors">
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

      {/* Theme Toggle Button */}
      <button
        id="theme-toggle"
        onClick={toggleTheme}
        className="p-2 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        aria-label="Toggle Theme"
      >
        {isDarkMode ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        )}
      </button>

      {/* Notifications */}
      <NotificationBell userId={userId} />

      {/* User initials chip */}
      <Link
        href="/workspace"
        title="View Profile & Security Settings"
        className={cn(
          "hidden sm:flex items-center gap-2 text-sm font-medium text-foreground hover:opacity-80 transition-opacity"
        )}
      >
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-xs">
          {user.full_name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
      </Link>
    </header>
  );
}
