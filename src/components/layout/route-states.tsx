"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Compass, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundView({ homeHref = "/", homeLabel = "Browse events" }: { homeHref?: string; homeLabel?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <Compass className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">We couldn&apos;t find that</h1>
      <p className="mt-2 text-sm text-muted-foreground">The link may be old, or the page was moved. If you were opening a booking or ticket, make sure you&apos;re signed in with the same email.</p>
      <Button asChild className="mt-6"><Link href={homeHref}>{homeLabel}</Link></Button>
    </div>
  );
}

export function ErrorView({ error, retry, homeHref = "/" }: { error: unknown; retry: () => void; homeHref?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest: unknown }).digest) : null;
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <TriangleAlert className="size-12 text-destructive" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your data is safe. Try again, and if it keeps happening, send the organisers the code below.</p>
      {digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Error {digest}</p>}
      <div className="mt-6 flex gap-2">
        <Button onClick={() => retry()}><RefreshCw /> Try again</Button>
        <Button asChild variant="outline"><Link href={homeHref}>Go home</Link></Button>
      </div>
    </div>
  );
}
