"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({ value, label, className, children }: { value: string; label: string; className?: string; children?: React.ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size={children ? "sm" : "icon-sm"}
      className={cn(className)}
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          toast.success(`${label[0].toUpperCase()}${label.slice(1)} copied`);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Couldn't copy. Long-press to copy instead.");
        }
      }}
    >
      {done ? <Check /> : <Copy />}
      {children}
    </Button>
  );
}
