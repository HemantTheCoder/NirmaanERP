"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import type { UserRole } from "@/types/database";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    avatar_url: string | null;
  };
}

export function AppShell({ children, user }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Persist sidebar state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) setCollapsed(JSON.parse(saved));
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", JSON.stringify(!prev));
      return !prev;
    });
  };

  return (
    <div className="flex h-full bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} user={user} />

      {/* Main content area */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-250"
        style={{ marginLeft: 0 }}
      >
        <Header user={user} userId={user.id} onMenuToggle={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
