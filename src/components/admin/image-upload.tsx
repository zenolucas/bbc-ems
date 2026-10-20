"use client";
import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ImageUpload({
  name,
  folder,
  defaultValue,
  label,
  aspect = "aspect-[16/9]",
}: {
  name: string;
  folder: "posters" | "gcash" | "payments";
  defaultValue?: string | null;
  label: string;
  aspect?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("folder", folder);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return toast.error(json.error ?? "Upload failed");
    setUrl(json.url);
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url} />
      <div
        className={cn("relative overflow-hidden rounded-xl border border-dashed bg-muted/40", aspect)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFile(e.dataTransfer.files[0]);
        }}
      >
        {url ? (
          <Image src={url} alt="" fill unoptimized className="object-cover" />
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            <span className="flex flex-col items-center gap-1">
              {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
              {label}
            </span>
          </button>
        )}
        {url && (
          <div className="absolute right-2 top-2 flex gap-1">
            <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Replace"}
            </Button>
            <Button type="button" size="icon-sm" variant="secondary" aria-label="Remove image" onClick={() => setUrl("")}>
              <X className="size-4" />
            </Button>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
