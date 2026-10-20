"use client";
import { useEffect, useRef } from "react";
import { Check, CircleSlash, Loader2, RefreshCw, ShieldAlert, TriangleAlert, Undo2 } from "lucide-react";
import { Pop } from "@/components/motion";
import { cn } from "@/lib/utils";
import { ConnPill } from "./conn-pill";
import type { Connection, ScanKind, ScanResult } from "./use-scanner";

type Flood = { bg: string; tint: string; dot: string; Icon: typeof Check; title: string };

/*
 * Full-screen floods, read from across a dark doorway. Lime and sun carry deep
 * forest ink; the danger red is the light-theme #b4321f (the night token is a
 * pale coral that can't hold white text) and "not in list" is sky deep.
 */
const ink = { bg: "text-deep-forest", tint: "bg-deep-forest/12" };
const white = { bg: "text-white", tint: "bg-white/15" };
const danger = "bg-[#b4321f]";

export const KIND: Record<ScanKind, Flood> = {
  ok: { bg: cn("bg-lime", ink.bg), tint: ink.tint, dot: "bg-lime", Icon: Check, title: "Welcome in" },
  duplicate: { bg: cn("bg-sun", ink.bg), tint: ink.tint, dot: "bg-star", Icon: TriangleAlert, title: "Already scanned" },
  stale: { bg: cn("bg-sky-deep", white.bg), tint: white.tint, dot: "bg-sky", Icon: RefreshCw, title: "Not in list yet" },
  invalid: { bg: cn(danger, white.bg), tint: white.tint, dot: "bg-destructive", Icon: ShieldAlert, title: "Invalid ticket" },
  void: { bg: cn(danger, white.bg), tint: white.tint, dot: "bg-destructive", Icon: CircleSlash, title: "Voided ticket" },
  "wrong-event": { bg: cn(danger, white.bg), tint: white.tint, dot: "bg-destructive", Icon: ShieldAlert, title: "Wrong event" },
};

export type UndoState = "idle" | "armed" | "busy";

export function ResultOverlay({
  r,
  title,
  conn,
  stats,
  hint,
  onClose,
  onRetry,
  refreshing,
  onUndo,
  undo,
}: {
  r: ScanResult;
  /** Event title for the top bar. */
  title: string;
  conn: Connection;
  stats: { checkedIn: number; total: number };
  /** Extra advice under the detail (e.g. what a real ticket looks like). */
  hint?: React.ReactNode;
  onClose: () => void;
  onRetry?: () => void;
  refreshing: boolean;
  /** Present only when the earlier check-in can be reversed from here (online, already on the server). */
  onUndo?: () => void;
  undo: UndoState;
}) {
  const cfg = KIND[r.kind];
  const continueRef = useRef<HTMLButtonElement>(null);

  // Focus lands inside the dialog so Enter or Escape on a keyboard (or a wedge scanner) moves on
  useEffect(() => {
    continueRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const pill = "flex min-h-13 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-current/40";
  const long = r.kind !== "ok" && r.kind !== "invalid";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      aria-label={cfg.title}
      onClick={onClose}
      className={cn(
        "fixed inset-0 z-[60] flex flex-col overflow-y-auto pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
        cfg.bg,
      )}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5 py-4 text-xs font-semibold">
        <span className="min-w-0 truncate opacity-90">{title}</span>
        <ConnPill conn={conn} tint={cfg.tint} live={false} />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3.5 px-7 py-4 text-center">
        <Pop className={cn("grid size-[150px] place-items-center rounded-full [@media(max-height:700px)]:size-28", cfg.tint)}>
          <cfg.Icon className="size-[92px] [@media(max-height:700px)]:size-16" strokeWidth={r.kind === "ok" ? 2.6 : 2.2} aria-hidden />
        </Pop>
        <div className={cn("font-display font-extrabold leading-none tracking-tight", long ? "text-[40px]" : "text-[44px]")}>{cfg.title}</div>
        {r.ticket && <div className="font-display text-[28px] font-bold leading-tight tracking-tight">{r.ticket.holder}</div>}
        {r.ticket && (
          <div className="text-base opacity-90">
            {r.ticket.tier} · <span className="font-mono tracking-[0.06em]">{r.ticket.code}</span>
          </div>
        )}
        {r.detail && (
          r.kind === "duplicate" ? (
            <div className={cn("mt-1.5 max-w-[300px] rounded-[14px] px-4 py-3 text-sm leading-snug", cfg.tint)}>
              {r.detail}. Ask to see the ticket holder&apos;s name.
            </div>
          ) : (
            <div className="max-w-[300px] text-base leading-normal opacity-95">{r.detail}</div>
          )
        )}
        {hint && <div className={cn("mt-1.5 max-w-[300px] rounded-[14px] px-4 py-3 text-sm leading-snug", cfg.tint)}>{hint}</div>}
        {r.kind === "ok" && <div className="mt-2.5 text-[13px] font-medium opacity-90">{stats.checkedIn} of {stats.total} in</div>}
      </div>

      <div className="mx-auto w-full max-w-md px-5 pb-7">
        {r.kind === "stale" ? (
          <div className="flex flex-col gap-2">
            {onRetry && (
              <button type="button" disabled={refreshing} onClick={stop(onRetry)} className={cn(pill, "bg-white text-[15px] text-sky-deep disabled:opacity-70")}>
                {refreshing ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : <RefreshCw className="size-[18px]" strokeWidth={2.4} aria-hidden />}
                Refresh list and retry
              </button>
            )}
            <button ref={continueRef} type="button" onClick={stop(onClose)} className={cn(pill, "min-h-11", cfg.tint)}>Continue without checking in</button>
          </div>
        ) : r.kind === "duplicate" ? (
          <div className="flex gap-2">
            <button ref={continueRef} type="button" onClick={stop(onClose)} className={cn(pill, "flex-1", cfg.tint)}>Continue</button>
            {onUndo && (
              <button
                type="button"
                disabled={undo === "busy"}
                onClick={stop(onUndo)}
                className={cn(pill, "bg-deep-forest text-sun disabled:opacity-80")}
              >
                {undo === "busy" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
                {undo === "armed" ? "Tap again to undo" : undo === "busy" ? "Undoing…" : "Undo that check-in"}
              </button>
            )}
          </div>
        ) : (
          <button ref={continueRef} type="button" onClick={stop(onClose)} className={cn(pill, "w-full", cfg.tint)}>Tap anywhere to continue</button>
        )}
      </div>
    </div>
  );
}
