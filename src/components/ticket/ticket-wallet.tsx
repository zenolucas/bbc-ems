"use client";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Stamp } from "@/components/brand/stamp";
import { TicketSvg } from "@/components/ticket/ticket-svg";
import { cn } from "@/lib/utils";

type Sibling = { href: string; name: string } | null;

/** Which way the last swipe went, so the next ticket slides in from the side it was pulled from. */
let lastDir = 0;

/**
 * The ticket on the wallet stage. Drag it sideways to move to the booking's
 * previous or next ticket (each is its own route); the arrows and ← → keys do
 * the same. A used ticket dims under a CHECKED IN stamp.
 */
export function TicketWallet({
  svg,
  label,
  width,
  height,
  used,
  prev,
  next,
  index,
  total,
  hint,
}: {
  svg: string;
  label: string;
  width: number;
  height: number;
  used: boolean;
  prev: Sibling;
  next: Sibling;
  index: number;
  total: number;
  hint: string | null;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-5, 5]);
  const fade = useTransform(x, [-300, 0, 300], [0.4, 1, 0.4]);
  const [enter] = useState(() => lastDir);
  useEffect(() => {
    lastDir = 0;
  }, []);

  const go = useCallback(
    async (dir: 1 | -1) => {
      const target = dir > 0 ? next : prev;
      if (!target) return;
      lastDir = dir;
      if (!reduce) await animate(x, -dir * 460, { duration: 0.18, ease: "easeIn" });
      router.push(target.href, { scroll: false });
    },
    [next, prev, reduce, router, x],
  );

  useEffect(() => {
    if (total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey || e.defaultPrevented) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") void go(1);
      if (e.key === "ArrowLeft") void go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, total]);

  const portrait = height > width;

  return (
    <div className="relative flex w-full flex-col items-center gap-4">
      <motion.div
        className={cn("relative w-full", portrait ? "max-w-[300px] sm:max-w-[320px]" : "max-w-[560px]")}
        initial={reduce || !enter ? false : { x: enter * 140, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
      >
        <motion.div
          drag={total > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: next ? 0.85 : 0.15, right: prev ? 0.85 : 0.15 }}
          dragSnapToOrigin
          onDragEnd={(_, info) => {
            if ((info.offset.x < -80 || info.velocity.x < -600) && next) void go(1);
            else if ((info.offset.x > 80 || info.velocity.x > 600) && prev) void go(-1);
          }}
          style={{ x, rotate: reduce ? 0 : rotate, opacity: reduce ? 1 : fade, touchAction: "pan-y" }}
          className={cn("relative select-none", total > 1 && "cursor-grab active:cursor-grabbing")}
        >
          <TicketSvg
            svg={svg}
            label={used ? `${label}, already checked in` : label}
            className={cn("pointer-events-none w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)] [&>svg]:h-auto [&>svg]:w-full", used && "opacity-55 grayscale-[0.4]")}
          />
          {used && (
            <Stamp tone="success" size="lg" aria-hidden className="pointer-events-none absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] bg-midnight/35 px-7 py-4 whitespace-nowrap backdrop-blur-[1px]">
              Checked in
            </Stamp>
          )}
        </motion.div>
      </motion.div>

      {total > 1 && (
        <nav aria-label="Other tickets on this booking" className="flex w-full max-w-[360px] items-center justify-between gap-1">
          {prev ? (
            <Link href={prev.href} scroll={false} onClick={() => (lastDir = -1)} aria-label={`Previous ticket: ${prev.name}`} className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground">
              <ChevronLeft className="size-5" />
            </Link>
          ) : (
            <span className="size-11 shrink-0" />
          )}
          <div className="flex min-w-0 items-center gap-2">
            {total <= 8 && (
              <span className="flex shrink-0 items-center gap-2" aria-hidden>
                {Array.from({ length: total }, (_, i) => (
                  <span key={i} className={cn("size-2 rounded-full bg-foreground", i !== index && "opacity-30")} />
                ))}
              </span>
            )}
            <span className="truncate pl-1.5 text-xs text-muted-foreground">{hint ?? `Ticket ${index + 1} of ${total}`}</span>
          </div>
          {next ? (
            <Link href={next.href} scroll={false} onClick={() => (lastDir = 1)} aria-label={`Next ticket: ${next.name}`} className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground">
              <ChevronRight className="size-5" />
            </Link>
          ) : (
            <span className="size-11 shrink-0" />
          )}
        </nav>
      )}
    </div>
  );
}
