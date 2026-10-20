import { cn } from "@/lib/utils";

/** The dark stage the camera feed (or the start button) sits on. */
export const stageClass =
  "relative aspect-[9/10] w-full overflow-hidden rounded-[22px] bg-[radial-gradient(ellipse_at_50%_40%,#233a40_0%,#0b161a_70%)] sm:aspect-[4/3]";

const corner = "absolute size-[34px] border-lime";

/**
 * What the door crew aims at: a dimmed surround, lime corner brackets and a
 * sweeping scan line. Purely decorative; under reduced motion the line rests
 * across the middle.
 */
export function ViewfinderFrame({ scanning = true, className }: { scanning?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 grid place-items-center", className)}>
      <div className="relative aspect-square w-[min(240px,64%)] -translate-y-[2%] rounded-[18px] shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]">
        <span className={cn(corner, "left-0 top-0 rounded-tl-[10px] border-l-[3px] border-t-[3px]")} />
        <span className={cn(corner, "right-0 top-0 rounded-tr-[10px] border-r-[3px] border-t-[3px]")} />
        <span className={cn(corner, "bottom-0 left-0 rounded-bl-[10px] border-b-[3px] border-l-[3px]")} />
        <span className={cn(corner, "bottom-0 right-0 rounded-br-[10px] border-b-[3px] border-r-[3px]")} />
        {scanning && (
          <span className="absolute inset-x-2.5 top-1/2 h-0.5 animate-scanline bg-linear-to-r from-transparent via-lime to-transparent shadow-[0_0_12px_var(--color-lime)]" />
        )}
      </div>
    </div>
  );
}
