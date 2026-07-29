import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Color = "indigo" | "emerald" | "violet" | "amber";
type Trend = "up" | "down" | "neutral";

const colorMap: Record<Color, { bg: string; icon: string; ring: string }> = {
  indigo: {
    bg:   "bg-indigo-50 dark:bg-indigo-950/40",
    icon: "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400",
    ring: "ring-indigo-100 dark:ring-indigo-900/40",
  },
  emerald: {
    bg:   "bg-emerald-50 dark:bg-emerald-950/40",
    icon: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-100 dark:ring-emerald-900/40",
  },
  violet: {
    bg:   "bg-violet-50 dark:bg-violet-950/40",
    icon: "bg-violet-100 dark:bg-violet-900/60 text-violet-600 dark:text-violet-400",
    ring: "ring-violet-100 dark:ring-violet-900/40",
  },
  amber: {
    bg:   "bg-amber-50 dark:bg-amber-950/40",
    icon: "bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400",
    ring: "ring-amber-100 dark:ring-amber-900/40",
  },
};

const trendMap: Record<Trend, { icon: LucideIcon; color: string; label: string }> = {
  up:      { icon: TrendingUp,   color: "text-emerald-500", label: "Trending up" },
  down:    { icon: TrendingDown, color: "text-rose-500",    label: "Trending down" },
  neutral: { icon: Minus,        color: "text-amber-500",   label: "No change" },
};

interface KpiCardProps {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: Trend;
  icon: LucideIcon;
  color: Color;
}

export function KpiCard({ id, label, value, change, trend, icon: Icon, color }: KpiCardProps) {
  const colors = colorMap[color];
  const trendInfo = trendMap[trend];
  const TrendIcon = trendInfo.icon;

  return (
    <div
      id={id}
      className={cn(
        "rounded-xl p-5 border border-border bg-card",
        "hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colors.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-medium", trendInfo.color)}>
          <TrendIcon className="w-3.5 h-3.5" aria-label={trendInfo.label} />
        </div>
      </div>

      <div>
        <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
        <p className="text-sm font-medium text-muted-foreground mt-0.5">{label}</p>
        <p className="text-xs text-muted-foreground/70 mt-2">{change}</p>
      </div>
    </div>
  );
}
