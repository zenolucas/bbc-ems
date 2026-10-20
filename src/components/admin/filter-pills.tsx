"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The organiser filter: pills in a muted trough with a count after each label
 * (Upcoming 3, To review 7). Buttons with aria-pressed when it filters in place;
 * links with aria-current when the filter lives in the URL. Scrolls sideways on
 * a phone rather than wrapping.
 */
export type PillOption<T extends string> = { value: T; label: string; count?: number; href?: string; tone?: "warn" };

const trough = "flex max-w-full shrink-0 gap-1 overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none]";
const pill = (active: boolean) =>
  cn(
    "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors lg:h-8",
    active ? "bg-card text-foreground shadow-[0_1px_2px_rgb(11_61_46/0.1)] dark:bg-surface-3" : "text-muted-foreground hover:text-foreground",
  );

export function FilterPills<T extends string>({ label, value, options, onChange, className }: { label: string; value: T; options: PillOption<T>[]; onChange?: (v: T) => void; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn(trough, className)}>
      {options.map((o) => {
        const active = o.value === value;
        const inner = (
          <>
            {o.label}
            {o.count !== undefined && <span className={cn("tabular-nums", o.tone === "warn" && o.count > 0 ? "text-warning-foreground" : active ? "text-muted-foreground" : "")}>{o.count}</span>}
          </>
        );
        return o.href ? (
          <Link key={o.value} href={o.href} aria-current={active ? "page" : undefined} className={pill(active)} scroll={false}>{inner}</Link>
        ) : (
          <button key={o.value} type="button" aria-pressed={active} onClick={() => onChange?.(o.value)} className={pill(active)}>{inner}</button>
        );
      })}
    </div>
  );
}
