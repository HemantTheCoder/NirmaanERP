"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone, Shield, Pencil, MessageSquare } from "lucide-react";
import type { UserContactProfile } from "@/lib/queries/profile";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./ChatPanel";

interface ContactCardProps {
  profile: UserContactProfile;
  isOwnProfile: boolean;
  currentUserId: string;
}

const ROLE_BADGES: Record<UserRole, { label: string; bg: string; text: string }> = {
  admin: { label: "Administrator", bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-800 dark:text-rose-300" },
  project_manager: { label: "Project Manager", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  site_staff: { label: "Site Staff / Engineer", bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  client: { label: "Client Observer", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
  contractor: { label: "Bidding Contractor", bg: "bg-violet-100 dark:bg-violet-950/60", text: "text-violet-800 dark:text-violet-300" },
};

function getInitials(name: string | null): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

export function ContactCard({ profile, isOwnProfile, currentUserId }: ContactCardProps) {
  const roleCfg = ROLE_BADGES[profile.role] || ROLE_BADGES.site_staff;
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.full_name || "User avatar"}
              className="w-20 h-20 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
              {getInitials(profile.full_name)}
            </div>
          )}

          <h1 className="text-xl font-bold text-foreground mt-4">
            {profile.full_name || "Unnamed User"}
          </h1>

          <span className={cn("mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg", roleCfg.bg, roleCfg.text)}>
            <Shield className="w-3.5 h-3.5" />
            {roleCfg.label}
          </span>
        </div>

        <div className="mt-6 pt-6 border-t border-border space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-foreground truncate">{profile.email}</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
            {profile.phone ? (
              <span className="text-foreground">{profile.phone}</span>
            ) : (
              <span className="text-muted-foreground italic">No phone number added</span>
            )}
          </div>
        </div>

        {isOwnProfile ? (
          <>
            <Link
              href="/workspace"
              className="mt-6 flex items-center justify-center gap-2 w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted/40 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Your Profile
            </Link>
            <p className="text-[11px] text-muted-foreground text-center mt-1.5">
              Open the Profile tab in My Workspace to edit
            </p>
          </>
        ) : (
          <button
            onClick={() => setIsChatOpen(true)}
            className="mt-6 flex items-center justify-center gap-2 w-full px-4 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Message
          </button>
        )}
      </div>

      {!isOwnProfile && (
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          currentUserId={currentUserId}
          otherUser={{ id: profile.id, full_name: profile.full_name }}
        />
      )}
    </div>
  );
}
