"use client";
import { formatDistanceToNowStrict } from "date-fns";
import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtLeft } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Milliseconds until `to`, ticking every minute (every 15 s in the last hour).
 * Refreshes the page once when it reaches zero unless `refreshAtZero` is off.
 */
export function useCountdown(to: string, { refreshAtZero = true }: { refreshAtZero?: boolean } = {}) {
  const router = useRouter();
  const target = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());
  const left = target - now;
  useEffect(() => {
    if (left <= 0) {
      if (refreshAtZero) router.refresh();
      return;
    }
    const t = setTimeout(() => setNow(Date.now()), left < 3600e3 ? 15_000 : 60_000);
    return () => clearTimeout(t);
  }, [now, left, router, refreshAtZero]);
  return { left, target };
}

/** Live "expires in …" line. Turns amber under an hour and refreshes the page when it hits zero. */
export function Countdown({ to, prefix = "Hold expires", absolute, className }: { to: string; prefix?: string; absolute?: string; className?: string }) {
  const { left, target } = useCountdown(to);
  const urgent = left < 3600e3;
  return (
    <p className={cn("flex items-center gap-1.5 text-sm", urgent ? "font-medium text-yellow-800 dark:text-star" : "text-muted-foreground", className)}>
      <Clock className="size-4 shrink-0" aria-hidden />
      <span suppressHydrationWarning>
        {left > 0 ? `${prefix} in ${formatDistanceToNowStrict(target)}` : "Hold expired"}
        {absolute && <span className="text-muted-foreground"> ({absolute})</span>}
      </span>
    </p>
  );
}

/** The compact time left ("Doors in 2h 14m"), live. `done` replaces the whole line once the moment has passed. */
export function CountdownText({ to, prefix = "", done = "now", refreshAtZero = false, className }: { to: string; prefix?: string; done?: string; refreshAtZero?: boolean; className?: string }) {
  const { left } = useCountdown(to, { refreshAtZero });
  return (
    <span className={className} suppressHydrationWarning>
      {left > 0 ? `${prefix}${fmtLeft(left)}` : done}
    </span>
  );
}

const R = 33;
const C = 2 * Math.PI * R;

/**
 * The hold as a draining ring: the arc is the share of the hold still left
 * (`from` is when the hold started), the centre reads "23h / 41m left".
 * Pine by day, lime by night; amber in the last hour.
 */
export function CountdownRing({ to, from, size = 72, className }: { to: string; from: string; size?: number; className?: string }) {
  const { left, target } = useCountdown(to);
  const total = Math.max(1, target - new Date(from).getTime());
  const share = Math.min(1, Math.max(0, left / total));
  const urgent = left < 3600e3;
  const [big, small] = ringLabel(left);
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label={left > 0 ? `${fmtLeft(left)} left on your hold` : "Hold expired"} className={cn("shrink-0", className)} suppressHydrationWarning>
      <circle cx="40" cy="40" r={R} fill="none" strokeWidth="7" className="stroke-surface-3" />
      <circle
        cx="40"
        cy="40"
        r={R}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={C.toFixed(2)}
        strokeDashoffset={(C * (1 - share)).toFixed(2)}
        transform="rotate(-90 40 40)"
        className={cn("transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none", urgent ? "stroke-warning" : "stroke-primary")}
        suppressHydrationWarning
      />
      <text x="40" y={small ? 37 : 46} textAnchor="middle" className="fill-foreground font-display text-[17px] font-extrabold" suppressHydrationWarning>{big}</text>
      {small && <text x="40" y="53" textAnchor="middle" className="fill-muted-foreground text-[11px] font-semibold" suppressHydrationWarning>{small}</text>}
    </svg>
  );
}

function ringLabel(ms: number): [string, string | null] {
  const m = Math.floor(Math.max(0, ms) / 60e3);
  if (ms <= 0) return ["0m", "expired"];
  if (m < 1) return ["<1m", "left"];
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
  if (d > 0) return [`${d}d`, `${h}h left`];
  if (h > 0) return [`${h}h`, `${String(min).padStart(2, "0")}m left`];
  return [`${min}m`, "left"];
}
