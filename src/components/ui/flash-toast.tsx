"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Shows a toast for a one-shot query flag (e.g. ?saved=1) set by a server
 * action redirect, then strips the flag so a refresh doesn't repeat it.
 */
export function FlashToast({ messages }: { messages: Record<string, string> }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    const hit = Object.keys(messages).find((k) => params.has(k));
    if (!hit) return;
    shown.current = true;
    toast.success(messages[hit]);
    const next = new URLSearchParams(params);
    for (const k of Object.keys(messages)) next.delete(k);
    router.replace(next.size ? `${path}?${next}` : path, { scroll: false });
  }, [params, messages, router, path]);
  return null;
}
