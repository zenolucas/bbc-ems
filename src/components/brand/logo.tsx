import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The lockup: mark plus "Baguio" eyebrow over "Base Camp" in the display face.
 * `compactOnPhone` drops the eyebrow under 640px, where the header is tight.
 */
export function Logo({
  className,
  size = 36,
  withText = true,
  compactOnPhone = false,
}: {
  className?: string;
  size?: number;
  withText?: boolean;
  compactOnPhone?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label={withText ? "Baguio Base Camp, home" : undefined}
      className={cn("flex shrink-0 items-center gap-2.5 rounded-lg text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}
    >
      <Image
        src="/brand/bbc-logo.png"
        alt={withText ? "" : "Baguio Base Camp"}
        width={size}
        height={size}
        priority
        style={{ "--logo": `${size}px` } as React.CSSProperties}
        className={cn(compactOnPhone && "size-[34px] sm:size-(--logo)")}
      />
      {withText && (
        <span className="leading-[1.05]">
          <span className={cn("bbc-eyebrow block text-[10px] text-muted-foreground", compactOnPhone && "hidden sm:block")}>Baguio</span>
          <span className="block font-display text-[17px] font-bold tracking-[-0.02em] sm:text-lg">Base Camp</span>
        </span>
      )}
    </Link>
  );
}

/** Simplified mountain mark used inside QR codes and as decoration. */
export function MountainMark({ className, size = 48 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <circle cx="50" cy="50" r="48" fill="#fff" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="#3cc5e8" strokeWidth="4" />
      <path d="M8 72 L32 30 L44 50 L50 40 L60 56 L70 44 L92 72 Z" fill="#39b54a" />
      <path d="M8 72 L32 30 L44 50 L38 58 L46 72 Z" fill="#8cc63e" />
      <path d="M60 56 L70 44 L92 72 L76 72 Z" fill="#1f9a3e" />
      <path d="M8 76 H92 V80 H8 Z" fill="#1b5e3b" />
      <circle cx="26" cy="22" r="5" fill="#f7e017" />
    </svg>
  );
}
