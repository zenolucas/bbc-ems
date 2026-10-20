"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

export function Camera({ onText, paused }: { onText: (text: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onTextRef = useRef(onText);
  const pausedRef = useRef(paused);
  useEffect(() => { onTextRef.current = onText; }, [onText]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    let controls: IScannerControls | null = null;
    let cancelled = false;
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 800 });
    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        videoRef.current!,
        (result) => {
          if (result && !pausedRef.current) onTextRef.current(result.getText());
        },
      )
      .then((c) => {
        if (cancelled) c.stop();
        else controls = c;
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(/denied|permission/i.test(msg) ? "Camera permission denied. Allow camera access for this site and reload." : /secure|https/i.test(msg) ? "Camera needs HTTPS. Open the deployed site, not plain http." : `Camera unavailable: ${msg}`);
      });
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black sm:aspect-video">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="size-[62%] max-w-[320px] rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      {error && <div className="absolute inset-x-3 bottom-3 rounded-lg bg-destructive/90 p-3 text-sm text-white">{error}</div>}
    </div>
  );
}
