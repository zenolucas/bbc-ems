"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Flashlight, FlashlightOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type CamError = { message: string; retry: boolean };

function describe(e: unknown): CamError {
  const name = e instanceof DOMException || e instanceof Error ? e.name : "";
  const msg = e instanceof Error ? e.message : String(e);
  if (name === "NotAllowedError" || /denied|permission/i.test(msg))
    return { message: "Camera access was blocked. Allow it in your browser's site settings (the icon left of the address), then tap Try again.", retry: true };
  if (name === "NotFoundError" || name === "OverconstrainedError") return { message: "No usable camera found. Use Type code instead.", retry: true };
  if (name === "NotReadableError") return { message: "Another app is using the camera. Close it and tap Try again.", retry: true };
  return { message: `Camera unavailable (${msg}). Use Type code instead.`, retry: true };
}

export function Camera({ onText, paused }: { onText: (text: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  // Camera only mounts after a tap, never during SSR, so window is available here
  const [insecure] = useState(() => !window.isSecureContext || !navigator.mediaDevices?.getUserMedia);
  const [error, setError] = useState<CamError | null>(() =>
    insecure ? { message: "The camera only works on the secure (https://) site. Open the live link, or use Type code.", retry: false } : null,
  );
  const [starting, setStarting] = useState(!insecure);
  const [torch, setTorch] = useState<boolean | null>(null); // null = not supported
  const [attempt, setAttempt] = useState(0);
  const onTextRef = useRef(onText);
  const pausedRef = useRef(paused);
  useEffect(() => { onTextRef.current = onText; }, [onText]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    if (insecure) return;
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
        if (cancelled) { c.stop(); return; }
        controlsRef.current = c;
        setStarting(false);
        setTorch(c.switchTorch ? false : null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStarting(false);
        setError(describe(e));
      });
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [attempt, insecure]);

  // Keep the screen awake while scanning; the OS drops the lock when the tab hides, so re-take it.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const take = async () => {
      try { lock = await navigator.wakeLock.request("screen"); } catch { /* battery saver etc. */ }
    };
    const onVis = () => { if (document.visibilityState === "visible") void take(); };
    void take();
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); void lock?.release().catch(() => {}); };
  }, []);

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-black sm:aspect-video">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Camera viewfinder" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="size-[62%] max-w-[320px] rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      {starting && !error && <div className="absolute inset-x-0 top-3 text-center text-sm text-white/80">Starting camera…</div>}
      {!starting && !error && <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-white/80">Point at the QR code</div>}
      {torch !== null && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute right-3 top-3 rounded-full"
          aria-label={torch ? "Turn flashlight off" : "Turn flashlight on"}
          aria-pressed={torch}
          onClick={async () => {
            try { await controlsRef.current?.switchTorch?.(!torch); setTorch(!torch); } catch { setTorch(null); }
          }}
        >
          {torch ? <FlashlightOff /> : <Flashlight />}
        </Button>
      )}
      {error && (
        <div role="alert" className="absolute inset-x-3 bottom-3 space-y-2 rounded-lg bg-destructive/95 p-3 text-sm text-white">
          <p>{error.message}</p>
          {error.retry && <Button type="button" size="sm" variant="secondary" onClick={() => { setError(null); setStarting(true); setAttempt((a) => a + 1); }}><RefreshCw /> Try again</Button>}
        </div>
      )}
    </div>
  );
}
