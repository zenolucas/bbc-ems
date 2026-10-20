"use client";
import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Mirrors lib/storage.ts so problems show before a slow upload, not after
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 8 * 1024 * 1024;

export function ImageUpload({
  id,
  name,
  folder,
  defaultValue,
  label,
  aspect = "aspect-[16/9]",
  fit = "cover",
  onBusyChange,
  onChange,
}: {
  id?: string;
  name: string;
  folder: "posters" | "gcash" | "payments";
  defaultValue?: string | null;
  label: string;
  aspect?: string;
  fit?: "cover" | "contain";
  onBusyChange?: (busy: boolean) => void;
  onChange?: (url: string) => void;
}) {
  const [url, setUrlState] = useState(defaultValue ?? "");
  const [busy, setBusyState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const setBusy = (b: boolean) => { setBusyState(b); onBusyChange?.(b); };
  const setUrl = (u: string) => { setUrlState(u); onChange?.(u); };

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!ALLOWED.includes(file.type)) {
      const msg = file.type.includes("heic") || /\.heic$/i.test(file.name)
        ? "iPhone HEIC photos aren't supported. Take a screenshot instead, or share as JPEG."
        : "Use a JPEG, PNG, WebP or GIF image.";
      setError(msg);
      return;
    }
    if (file.size > MAX_BYTES) { setError("That image is over 8 MB. A screenshot is usually much smaller."); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Upload failed. Try again."); return; }
      setUrl(json.url);
      toast.success("Image uploaded");
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url} />
      <div
        className={cn("relative overflow-hidden rounded-xl border border-dashed bg-muted/40", aspect)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onFile(e.dataTransfer.files[0]);
        }}
      >
        {url ? (
          <Image src={url} alt={`${label} preview`} fill unoptimized className={fit === "contain" ? "object-contain" : "object-cover"} />
        ) : (
          <button id={id} type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="absolute inset-0 grid place-items-center p-3 text-sm text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <span className="flex flex-col items-center gap-1 text-center">
              {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
              {busy ? "Uploading…" : label}
              {!busy && <span className="text-xs">JPEG, PNG or WebP · up to 8 MB</span>}
            </span>
          </button>
        )}
        {url && (
          <div className="absolute right-2 top-2 flex gap-1">
            <Button id={id} type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Replace"}
            </Button>
            <Button type="button" size="icon-sm" variant="secondary" aria-label="Remove image" disabled={busy} onClick={() => setUrl("")}>
              <X className="size-4" />
            </Button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <input ref={inputRef} type="file" accept={ALLOWED.join(",")} className="hidden" tabIndex={-1} aria-hidden onChange={(e) => void onFile(e.target.files?.[0])} />
    </div>
  );
}
