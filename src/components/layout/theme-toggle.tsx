"use client";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Day/night switch: a little sky with a ridge, the sun on the left by day and a
 * crescent on the right by night. State is painted by the `.dark` class, so the
 * server render matches the client without reading the theme.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      role="switch"
      aria-label="Night mode"
      aria-checked={resolvedTheme === "dark"}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "relative h-[34px] w-16 shrink-0 overflow-hidden rounded-full border border-border bg-[linear-gradient(180deg,#3cc5e8,#cdeefa)] transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-[linear-gradient(180deg,#0b161a,#1f4a5c)]",
        className,
      )}
    >
      <svg viewBox="0 0 64 34" aria-hidden className="absolute inset-0 h-full w-full">
        <g fill="#f5f0a0" className="opacity-0 transition-opacity dark:opacity-100">
          <circle cx="8" cy="8" r="1" />
          <circle cx="20" cy="5" r=".8" />
          <circle cx="30" cy="11" r="1.1" />
        </g>
        <path d="M0 34V26L10 20L20 27L32 16L44 26L54 20L64 28V34Z" className="fill-grass transition-colors dark:fill-[#17422f]" />
      </svg>
      {/* the knob: sun by day, moon by night */}
      <span
        aria-hidden
        className="absolute top-[4px] left-[4px] size-6 rounded-full bg-sun shadow-[0_0_0_4px_rgba(247,224,23,0.35)] transition-[transform,background-color,box-shadow] duration-300 ease-out dark:translate-x-[30px] dark:bg-star dark:shadow-[inset_-7px_-3px_0_0_#0e1c20]"
      />
    </button>
  );
}
