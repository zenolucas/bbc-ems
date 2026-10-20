"use client";
import { formatDistanceToNowStrict } from "date-fns";
import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Live "expires in …" line. Turns amber under an hour and refreshes the page when it hits zero. */
export function Countdown({ to, prefix = "Hold expires", absolute, className }: { to: string; prefix?: string; absolute?: string; className?: string }) {
  const router = useRouter();
  const target = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());
  const left = target - now;
  useEffect(() => {
    if (left <= 0) { router.refresh(); return; }
    const t = setTimeout(() => setNow(Date.now()), left < 3600e3 ? 15_000 : 60_000);
    return () => clearTimeout(t);
  }, [now, left, router]);
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
