import Link from "next/link";
import { TrendingUp, TrendingDown, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricColor = "indigo" | "emerald" | "violet" | "amber";
type TrendState = "up" | "down" | "neutral";

const colorMap: Record<MetricColor, { iconBg: string; iconText: string }> = {
  indigo: {
    iconBg:   "bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800",
    iconText: "text-indigo-700 dark:text-indigo-300",
  },
  emerald: {
    iconBg:   "bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800",
    iconText: "text-emerald-700 dark:text-emerald-300",
  },
  violet: {
    iconBg:   "bg-violet-100 dark:bg-violet-950/80 border border-violet-200 dark:border-violet-800",
    iconText: "text-violet-700 dark:text-violet-300",
  },
  amber: {
    iconBg:   "bg-amber-100 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800",
    iconText: "text-amber-700 dark:text-amber-300",
  },
};

const trendMap: Record<TrendState, { icon: LucideIcon; badgeBg: string; text: string; label: string }> = {
  up: {
    icon: TrendingUp,
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    label: "Positive",
  },
  down: {
    icon: TrendingDown,
    badgeBg: "bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800",
    text: "text-rose-700 dark:text-rose-300",
    label: "Negative",
  },
  neutral: {
    icon: CheckCircle2,
    badgeBg: "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
    text: "text-slate-700 dark:text-slate-300",
    label: "Normal",
  },
};

interface KpiCardProps {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: TrendState;
  icon: LucideIcon;
  color: MetricColor;
  href?: string;
}

export function KpiCard({ id, label, value, change, trend, icon: Icon, color, href }: KpiCardProps) {
  const colors = colorMap[color];
  const trendInfo = trendMap[trend];
  const TrendIcon = trendInfo.icon;

  const content = (
    <div
      id={id}
      className={cn(
        "rounded-xl p-5 border border-border bg-card shadow-2xs h-full",
        "hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between cursor-pointer"
      )}
    >
      {/* Top Header: Icon + Trend Pill */}
      <div className="flex items-center justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", colors.iconBg)}>
          <Icon className={cn("w-4.5 h-4.5", colors.iconText)} />
        </div>

        <div className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", trendInfo.badgeBg, trendInfo.text)}>
          <TrendIcon className="w-3 h-3 shrink-0" aria-label={trendInfo.label} />
          <span>{trendInfo.label}</span>
        </div>
      </div>

      {/* Main Content: Number -> Label -> Subtext */}
      <div>
        <p className="text-3xl font-bold text-foreground tracking-tight leading-none">
          {value}
        </p>
        <p className="text-xs font-semibold text-foreground/90 mt-1.5 leading-tight">
          {label}
        </p>
        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
          <span>{change}</span>
          {href && <span className="text-primary font-medium text-[11px]">View queue →</span>}
        </p>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block h-full">{content}</Link>;
  }

  return content;
}
