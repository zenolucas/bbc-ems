"use client";
import type { ScanSample } from "@bbc/shared/demo";
import { FlaskConical, QrCode, Type } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const TONE: Record<ScanSample["kind"], string> = {
  valid: "bg-success",
  used: "bg-warning",
  "wrong-event": "bg-warning",
  forged: "bg-destructive",
  unknown: "bg-destructive",
};

/**
 * Demo: one tap feeds the scanner a sample ticket (good, already in, another event,
 * edited QR, made-up code), for showing the door without a second phone.
 */
export function ScanSamples({ eventId, onText, onCode }: { eventId: string; onText: (text: string) => void; onCode: (code: string) => void }) {
  const [samples, setSamples] = useState<ScanSample[] | null>(null);
  useEffect(() => {
    fetch(`/api/v1/demo/scan-samples?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { samples: ScanSample[] } | null) => setSamples(d?.samples ?? []))
      .catch(() => setSamples([]));
  }, [eventId]);
  if (!samples?.length) return null;
  return (
    <section aria-labelledby="samples-heading" className="rounded-2xl border border-dashed bg-card px-3.5 py-2.5">
      <h2 id="samples-heading" className="mb-1.5 flex items-center gap-1.5 font-sans text-xs font-bold tracking-normal text-muted-foreground">
        <FlaskConical className="size-3.5" aria-hidden /> Demo: scan a sample
      </h2>
      <ul className="grid gap-1">
        {samples.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => (s.via === "qr" ? onText(s.text) : onCode(s.text))}
              className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-[13px] outline-none hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className={cn("size-2 shrink-0 rounded-full", TONE[s.kind])} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              {s.via === "qr" ? <QrCode className="size-3.5 text-muted-foreground" aria-label="as a QR scan" /> : <Type className="size-3.5 text-muted-foreground" aria-label="as a typed code" />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
