import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, size = 36, withText = true }: { className?: string; size?: number; withText?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <Image src="/brand/bbc-logo.png" alt="Baguio Base Camp" width={size} height={size} priority />
      {withText && (
        <span className="leading-none">
          <span className="block text-sm text-muted-foreground font-medium">Baguio</span>
          <span className="block text-base">Base Camp</span>
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
