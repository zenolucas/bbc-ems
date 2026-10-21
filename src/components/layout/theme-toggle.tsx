"use client";
import { useSyncExternalStore, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/**
 * Switches the theme with a circular reveal: the new theme grows out of the
 * toggle until it covers the screen. Uses the View Transitions API; browsers
 * without it, and reduced-motion users, get the instant swap.
 */
function useThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  return (event: MouseEvent<HTMLButtonElement>) => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduced) {
      setTheme(next);
      return;
    }
    // Percentages of the snapshot, not px: under fractional scaling (Wayland at
    // 1.5x) Chromium can resolve px on the view-transition layer in device
    // pixels, which pulls the circle two-thirds of the way toward the corner.
    // A circle's % radius is relative to hypot(w, h) / √2.
    const rect = event.currentTarget.getBoundingClientRect();
    const w = innerWidth;
    const h = innerHeight;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const at = `at ${(x / w) * 100}% ${(y / h) * 100}%`;
    const radius = (Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) / (Math.hypot(w, h) / Math.SQRT2)) * 100;
    const transition = document.startViewTransition(() => {
      // Paint the class now; next-themes applies it in an effect, too late for the snapshot.
      const root = document.documentElement;
      root.classList.toggle("dark", next === "dark");
      root.classList.toggle("light", next === "light");
      root.style.colorScheme = next;
      flushSync(() => setTheme(next));
    });
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0% ${at})`, `circle(${radius}% ${at})`] },
        { duration: 600, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    });
  };
}

/**
 * Day/night switch: a little sky with a ridge, the sun on the left by day and a
 * crescent on the right by night. State is painted by the `.dark` class, so the
 * server render matches the client without reading the theme. `aria-checked`
 * waits for hydration: the server cannot know the theme.
 *
 * `variant="icon"` is the compact phone header version: a 40px round button with
 * the sun by day and the moon by night, same switch semantics.
 */
export function ThemeToggle({ className, variant = "switch" }: { className?: string; variant?: "switch" | "icon" }) {
  const { resolvedTheme } = useTheme();
  const switchTheme = useThemeSwitch();
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  if (variant === "icon") {
    return (
      <button
        type="button"
        role="switch"
        aria-label="Night mode"
        aria-checked={hydrated ? resolvedTheme === "dark" : undefined}
        onClick={switchTheme}
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-star",
          className,
        )}
      >
        <Sun className="size-5 dark:hidden" aria-hidden />
        <Moon className="hidden size-5 dark:block" aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-label="Night mode"
      aria-checked={hydrated ? resolvedTheme === "dark" : undefined}
      onClick={switchTheme}
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
