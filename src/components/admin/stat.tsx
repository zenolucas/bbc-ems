import { cn } from "@/lib/utils";

/**
 * KPI tile: eyebrow label, display-face number, optional hint and a thin meter
 * when the number is a share of a capacity. `highlight` gives it the sun tint
 * for the one number that needs acting on (receipts waiting). `aside` sits
 * opposite the label (a delta); `children` go under the number (a sparkline).
 */
export function Stat({
  label,
  value,
  hint,
  highlight,
  progress,
  aside,
  children,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  highlight?: boolean;
  /** 0–100; renders a meter under the number. */
  progress?: number;
  aside?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-2xl border bg-card p-4", highlight && "border-warning bg-warning-soft", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <div className={cn("bbc-eyebrow", highlight ? "text-warning-foreground" : "text-muted-foreground")}>{label}</div>
        {aside}
      </div>
      <div className="font-display text-[28px] leading-none font-extrabold tracking-tight tabular-nums lg:text-[34px]">{value}</div>
      {progress !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {children}
      {hint && <div className={cn("text-xs", highlight ? "text-warning-foreground" : "text-muted-foreground")}>{hint}</div>}
    </div>
  );
}
