import Link from "next/link";
import { cn } from "@/lib/utils";

/** Organiser page heading: display-face title with one line of context under it. */
export function PageHeader({ title, sub, actions, className }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[26px] leading-none font-extrabold tracking-tight lg:text-[32px]">{title}</h1>
        {sub && <div className="mt-1.5 text-[13px] text-muted-foreground lg:text-sm">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * A titled card whose rows are separated by hairlines. Rows go straight in as
 * children (use `PanelRow`); `link` puts a "See all →" in the header.
 */
export function Panel({
  title,
  id,
  meta,
  link,
  children,
  className,
}: {
  title: React.ReactNode;
  id: string;
  meta?: React.ReactNode;
  link?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("overflow-hidden rounded-[18px] border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <h2 id={id} className="flex items-center gap-2 font-display text-base font-extrabold lg:text-lg">{title}</h2>
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
        {link && <Link href={link.href} className="text-[13px] font-semibold text-accent-foreground hover:underline">{link.label} →</Link>}
      </div>
      {children}
    </section>
  );
}

export const panelRow = "flex items-center gap-3.5 border-t px-4 py-3 transition-colors";
export const panelRowLink = cn(panelRow, "hover:bg-surface-2/60");

/** Thin capacity meter on the surface-3 track. Decorative unless given a label. */
export function Meter({ value, label, className, tone = "primary" }: { value: number; label?: string; className?: string; tone?: "primary" | "muted" }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-surface-3", className)}
      {...(label ? { role: "progressbar", "aria-valuenow": Math.round(pct), "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": label } : { "aria-hidden": true })}
    >
      <div className={cn("h-full rounded-full", tone === "muted" ? "bg-muted-foreground" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** "7 to review" chip in sun: the one colour that says "you have work here". */
export function SunPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full bg-sun px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-deep-forest tabular-nums dark:bg-star", className)}>{children}</span>;
}
