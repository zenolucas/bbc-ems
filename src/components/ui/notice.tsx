import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeTone = "success" | "info" | "warn" | "destructive";

/** Accent bar + icon carry the tone; the box itself stays a plain surface so stacks of notices don't shout. */
const tones: Record<NoticeTone, { bar: string; icon: string; Icon: LucideIcon }> = {
  success: { bar: "border-l-success", icon: "text-success-foreground", Icon: CheckCircle2 },
  info: { bar: "border-l-info", icon: "text-info-foreground", Icon: Info },
  warn: { bar: "border-l-warning", icon: "text-warning-foreground", Icon: AlertTriangle },
  destructive: { bar: "border-l-destructive", icon: "text-destructive", Icon: XCircle },
};

/**
 * Status banner: icon, title, optional body and actions. Destructive notices
 * are announced assertively; everything else politely.
 */
export function Notice({
  tone = "info",
  title,
  children,
  icon,
  actions,
  className,
}: {
  tone?: NoticeTone;
  title: React.ReactNode;
  children?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  const Icon = icon ?? t.Icon;
  return (
    <div
      role={tone === "destructive" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-2xl border border-l-4 bg-card p-4", t.bar, className)}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", t.icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-sm text-muted-foreground">{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
