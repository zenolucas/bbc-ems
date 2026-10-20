"use client";
import Image from "next/image";
import { CheckCircle2, Circle, CircleAlert } from "lucide-react";
import { Skyline } from "@/components/brand/skyline";
import { Meter } from "./panel";
import { cn } from "@/lib/utils";

/** A datetime-local value ("2026-11-22T18:00") read as the Manila wall time it already is. */
export function wallTime(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  // UTC fields only, so the server and the browser format the same wall time
  return new Date(Date.UTC(y, mo - 1, d, h, mi));
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtWall(v: string, withTime = true) {
  const d = wallTime(v);
  if (!d) return "";
  const h = d.getUTCHours() % 12 || 12;
  const time = `${h}:${String(d.getUTCMinutes()).padStart(2, "0")} ${d.getUTCHours() < 12 ? "AM" : "PM"}`;
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}${withTime ? ` · ${time}` : ""}`;
}

/**
 * The public event card as it will look, redrawn from the form as you type:
 * poster (or the event's skyline), date tab, title, tagline, when and where,
 * and the cheapest tier on the perforated tear-off.
 */
export function EventPreview({ title, tagline, startsAt, venue, cover, slug, tiers }: { title: string; tagline: string; startsAt: string; venue: string; cover: string; slug: string; tiers: { name: string; price: string }[] }) {
  const d = wallTime(startsAt);
  const named = tiers.filter((t) => t.name.trim());
  const cheapest = [...named].sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0];
  const price = cheapest ? (Number(cheapest.price) > 0 ? `₱${Number(cheapest.price).toLocaleString("en-PH")}` : "Free") : "—";
  return (
    <div className="bbc-stub" style={{ "--stub-notch": "calc(100% - 23px)" } as React.CSSProperties}>
      <div className="flex flex-col overflow-hidden rounded-[20px] border bg-card">
        <div className="relative h-[170px] border-b border-dashed bg-surface-2">
          {cover ? <Image src={cover} alt="" fill unoptimized className="object-cover" /> : <Skyline size="card" seed={slug || "preview"} animated={false} className="absolute inset-0" />}
          {d && (
            <div className="absolute top-2.5 left-2.5 rounded-[10px] bg-background px-[9px] py-[5px] text-center leading-none shadow-[0_2px_8px_rgb(0_0_0/0.12)]">
              <div className="bbc-eyebrow text-[9px] text-muted-foreground">{MONTHS[d.getUTCMonth()]}</div>
              <div className="font-display text-xl font-extrabold">{d.getUTCDate()}</div>
            </div>
          )}
          {!cover && <span className="absolute right-2.5 bottom-2.5 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">No poster yet</span>}
        </div>
        <div className="flex flex-col gap-[5px] px-3.5 pt-3 pb-2.5">
          <div className={cn("line-clamp-2 font-display text-[17px] leading-tight font-bold", !title && "text-muted-foreground")}>{title || "Event title"}</div>
          {tagline && <div className="line-clamp-2 text-xs text-muted-foreground">{tagline}</div>}
          <div className="text-xs text-muted-foreground">{[fmtWall(startsAt), venue].filter(Boolean).join(" · ") || "Date and venue"}</div>
        </div>
        <div className="bbc-perforation flex h-[46px] items-center justify-between px-3.5">
          <span className="truncate text-xs text-muted-foreground">{named.length > 1 ? `${named.length} tiers, from` : cheapest?.name ?? "No tiers yet"}</span>
          <span className="font-display text-[17px] font-extrabold text-primary">{price}</span>
        </div>
      </div>
    </div>
  );
}

export type Check = { label: string; ok: boolean; required: boolean };

/** Publish checklist with a meter; red blocks publishing, yellow only makes it look better. */
export function ChecklistCard({ checks, children }: { checks: Check[]; children?: React.ReactNode }) {
  const green = checks.filter((c) => c.ok).length;
  return (
    <section aria-labelledby="checklist-h" className="flex flex-col gap-2 rounded-[18px] border bg-card px-4 py-3.5">
      <div className="flex items-center justify-between">
        <h2 id="checklist-h" className="font-display text-[15px] font-extrabold">Publish checklist</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{green} of {checks.length}</span>
      </div>
      <Meter value={(green / Math.max(1, checks.length)) * 100} label="Publish checklist" />
      <ul className="mt-1 flex flex-col gap-1.5 text-[13px]">
        {checks.map((c) => (
          <li key={c.label} className={cn("flex items-center gap-2", !c.ok && !c.required && "text-muted-foreground", !c.ok && c.required && "text-destructive")}>
            {c.ok ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden /> : c.required ? <CircleAlert className="size-4 shrink-0" aria-hidden /> : <Circle className="size-4 shrink-0 text-warning-foreground" aria-hidden />}
            <span>
              {c.label}
              {!c.required && !c.ok && <span className="text-[11px]"> (recommended)</span>}
              <span className="sr-only">{c.ok ? ", done" : c.required ? ", required" : ", not done"}</span>
            </span>
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}
