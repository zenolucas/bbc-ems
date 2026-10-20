import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeTone = "success" | "info" | "warn" | "destructive";

const tones: Record<NoticeTone, { box: string; icon: string; Icon: LucideIcon }> = {
  success: { box: "border-grass/40 bg-fog/60 dark:bg-slate", icon: "text-grass", Icon: CheckCircle2 },
  info: { box: "border-sky/40 bg-accent", icon: "text-sky-deep dark:text-sky", Icon: Info },
  warn: { box: "border-sun/60 bg-sun/15", icon: "text-yellow-700 dark:text-star", Icon: AlertTriangle },
  destructive: { box: "border-destructive/40 bg-destructive/5", icon: "text-destructive", Icon: XCircle },
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
    <div role={tone === "destructive" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-xl border p-4", t.box, className)}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", t.icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {children && <div className="mt-0.5 text-sm text-muted-foreground">{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
