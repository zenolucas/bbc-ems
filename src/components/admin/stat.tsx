import { cn } from "@/lib/utils";

export function Stat({ label, value, hint, highlight, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; highlight?: boolean; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", highlight && "border-sun bg-sun/10", className)}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
