import { cn } from "@/lib/utils";

/**
 * KPI tile: eyebrow label, display-face number, optional hint and a thin meter
 * when the number is a share of a capacity. `highlight` gives it the sun tint
 * for the one number that needs acting on (receipts waiting).
 */
export function Stat({
  label,
  value,
  hint,
  highlight,
  progress,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  highlight?: boolean;
  /** 0–100; renders a meter under the number. */
  progress?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl border bg-card p-4", highlight && "border-warning bg-warning-soft", className)}>
      <div className={cn("bbc-eyebrow", highlight ? "text-warning-foreground" : "text-muted-foreground")}>{label}</div>
      <div className="font-display text-3xl font-extrabold leading-none tabular-nums tracking-tight">{value}</div>
      {progress !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {hint && <div className={cn("text-xs", highlight ? "text-warning-foreground" : "text-muted-foreground")}>{hint}</div>}
    </div>
  );
}
