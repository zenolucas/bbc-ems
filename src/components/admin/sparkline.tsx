"use client";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

type Point = { label: string; n: number };

const W = 240;
const H = 60;
const PAD = 4;

/**
 * One-hue area sparkline (the primary: pine by day, lime by night). Hover or
 * focus + arrow keys move a crosshair that snaps to the nearest day and shows
 * its count; numbers stay in text colours, only the line carries the hue. Every
 * value is also in a visually hidden list, so the tooltip never gates data.
 * The SVG stretches to the tile, so the dot and tooltip are HTML on top of it.
 */
export function Sparkline({ points, unit, label, className }: { points: Point[]; unit: [string, string]; label: string; className?: string }) {
  const [at, setAt] = useState<number | null>(null);
  const gid = useId();
  const max = Math.max(1, ...points.map((p) => p.n));
  const x = (i: number) => (points.length < 2 ? 0 : (i / (points.length - 1)) * W);
  const y = (n: number) => PAD + (1 - n / max) * (H - PAD * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.n).toFixed(1)}`).join(" ");
  const fmt = (n: number) => `${n} ${n === 1 ? unit[0] : unit[1]}`;

  function pick(clientX: number, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const i = Math.round(((clientX - r.left) / r.width) * (points.length - 1));
    setAt(Math.max(0, Math.min(points.length - 1, i)));
  }

  const p = at === null ? null : points[at];
  const cx = at === null ? 0 : x(at);
  const left = (cx / W) * 100;
  return (
    <div className={cn("space-y-1", className)}>
      <div
        role="group"
        tabIndex={0}
        aria-label={`${label}. Use the arrow keys to read each day.`}
        aria-describedby={`${gid}-days`}
        className="relative h-[60px] cursor-crosshair touch-none rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={() => setAt(null)}
        onBlur={() => setAt(null)}
        onFocus={() => setAt(points.length - 1)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); setAt((i) => Math.max(0, (i ?? points.length) - 1)); }
          if (e.key === "ArrowRight") { e.preventDefault(); setAt((i) => Math.min(points.length - 1, (i ?? -1) + 1)); }
          if (e.key === "Escape") setAt(null);
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible text-primary" aria-hidden>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} V${H} H0 Z`} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {p && <line x1={cx} x2={cx} y1="0" y2={H} className="stroke-muted-foreground" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        </svg>
        {p && (
          <>
            <span aria-hidden className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card" style={{ left: `${left}%`, top: `${(y(p.n) / H) * 100}%` }} />
            <span
              role="status"
              className="pointer-events-none absolute -top-7 z-10 rounded-md bg-foreground px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-background shadow-sm"
              style={{ left: `${left}%`, transform: `translateX(${left < 25 ? "-10%" : left > 75 ? "-90%" : "-50%"})` }}
            >
              {p.label} · {fmt(p.n)}
            </span>
          </>
        )}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground" aria-hidden>
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
      <p id={`${gid}-days`} className="sr-only">{points.map((d) => `${d.label}: ${fmt(d.n)}`).join("; ")}</p>
    </div>
  );
}
