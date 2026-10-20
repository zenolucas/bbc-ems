"use client";
import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { BrokenIllustration, LostIllustration } from "./trail-illustrations";

const box = "mx-auto my-8 w-full max-w-md px-5 py-7 sm:my-12";
const title = "text-xl font-extrabold";
const art = "mb-2.5 h-[90px] w-[200px]";

export function NotFoundView({ homeHref = "/", homeLabel = "Browse events", className }: { homeHref?: string; homeLabel?: string; className?: string }) {
  return (
    <EmptyState
      titleAs="h1"
      title={<span className={title}>We couldn&apos;t find that trail</span>}
      illustration={<LostIllustration className={art} />}
      className={cn(box, className)}
      action={
        <Button asChild className="h-10 rounded-full px-[18px] text-sm font-semibold md:h-10">
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      }
    >
      <p className="leading-normal sm:text-[15px]">
        The link may be old, or the page moved. Opening a booking or ticket? Make sure you&apos;re signed in with the same email.
      </p>
    </EmptyState>
  );
}

export function ErrorView({
  error,
  retry,
  homeHref = "/",
  homeLabel = "Go home",
  className,
}: {
  error: unknown;
  retry: () => void;
  homeHref?: string;
  homeLabel?: string;
  className?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest: unknown }).digest) : null;
  return (
    <div role="alert">
      <EmptyState
        titleAs="h1"
        title={<span className={title}>Something went wrong</span>}
        illustration={<BrokenIllustration className={art} />}
        className={cn(box, className)}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => retry()} className="h-10 rounded-full px-[18px] text-sm font-semibold md:h-10">
              <RefreshCw aria-hidden /> Try again
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-full px-4 text-sm font-semibold md:h-10">
              <Link href={homeHref}>{homeLabel}</Link>
            </Button>
          </div>
        }
      >
        <p className="leading-normal sm:text-[15px]">
          {digest ? (
            <>
              Your data is safe. Try again; if it keeps happening, send the organisers this code: <span className="font-mono text-foreground select-all">{digest}</span>
            </>
          ) : (
            "Your data is safe. Try again; if it keeps happening, let the organisers know what you were doing."
          )}
        </p>
      </EmptyState>
    </div>
  );
}
