"use client";

import { useState } from "react";
import { User, Mail, Shield, Phone, Camera, Save, Edit3, Loader2, Check, AlertTriangle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateOwnProfile, uploadAvatar } from "@/lib/queries/profile";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface ProfileTabProps {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
    phone?: string | null;
    avatar_url?: string | null;
  };
}

const ROLE_BADGES: Record<UserRole, { label: string; bg: string; text: string }> = {
  admin:           { label: "Administrator",       bg: "bg-rose-100 dark:bg-rose-950/60",     text: "text-rose-800 dark:text-rose-300" },
  project_manager: { label: "Project Manager",    bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  site_staff:      { label: "Site Staff / Engineer", bg: "bg-amber-100 dark:bg-amber-950/60",  text: "text-amber-800 dark:text-amber-300" },
  client:          { label: "Client Observer",     bg: "bg-emerald-100 dark:bg-emerald-950/60",text: "text-emerald-800 dark:text-emerald-300" },
};

export function ProfileTab({ user }: ProfileTabProps) {
  const supabase = createClient();

  const [fullName, setFullName] = useState(user.full_name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url || null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const roleCfg = ROLE_BADGES[user.role] || ROLE_BADGES.site_staff;

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg("Full name cannot be empty.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await updateOwnProfile(supabase, user.id, {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
    });

    setIsSaving(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to update profile.");
    } else {
      setSuccessMsg("Profile details updated successfully!");
      setIsEditing(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Avatar file size must be less than 5MB.");
      return;
    }

    setIsUploadingAvatar(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await uploadAvatar(supabase, user.id, file);
    setIsUploadingAvatar(false);

    if (!res.success || !res.avatarUrl) {
      setErrorMsg(res.error || "Failed to upload avatar.");
    } else {
      setAvatarUrl(res.avatarUrl);
      setSuccessMsg("Profile picture updated!");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Banner Messages */}
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

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        {/* Header with Avatar & Role */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 border-b border-border pb-6">
          {/* Avatar Upload Container */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl bg-secondary flex items-center justify-center border-2 border-border overflow-hidden shadow-inner">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">{getInitials(fullName)}</span>
              )}
            </div>

            <label className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md hover:scale-105 transition-transform">
              {isUploadingAvatar ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={isUploadingAvatar}
              />
            </label>
          </div>

          <div className="text-center sm:text-left space-y-1.5 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-foreground">{fullName || "Unnamed User"}</h3>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>

              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold w-fit mx-auto sm:mx-0",
                  roleCfg.bg,
                  roleCfg.text
                )}
              >
                <Shield className="w-3.5 h-3.5" />
                {roleCfg.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Personal self-service profile and identity settings.
            </p>
          </div>
        </div>

        {/* Profile Info Details / Edit Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Full Name</label>
              {isEditing ? (
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              ) : (
                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-xs font-medium text-foreground flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>{fullName || "Not provided"}</span>
                </div>
              )}
            </div>

            {/* Email Address (Read-only) */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Email Address <span className="text-[10px] text-muted-foreground font-normal">(System Locked)</span>
              </label>
              <div className="p-2.5 rounded-lg bg-secondary/30 border border-border text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>{user.email}</span>
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Phone Number</label>
              {isEditing ? (
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-xs font-medium text-foreground flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>{phone || "No phone number added"}</span>
                </div>
              )}
            </div>

            {/* Role (Read-only) */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Assigned Role <span className="text-[10px] text-muted-foreground font-normal">(Admin Controlled)</span>
              </label>
              <div className="p-2.5 rounded-lg bg-secondary/30 border border-border text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>{roleCfg.label}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setFullName(user.full_name || "");
                    setPhone(user.phone || "");
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-sm"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground rounded-lg transition-all border border-border"
              >
                <Edit3 className="w-3.5 h-3.5 text-primary" />
                Edit Profile
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
