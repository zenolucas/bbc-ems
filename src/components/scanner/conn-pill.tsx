import { Cloud, CloudOff, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Connection } from "./use-scanner";

const CONN: Record<Connection, { cls: string; Icon: typeof Cloud; label: string }> = {
  online: { cls: "bg-success-soft text-success-foreground", Icon: Cloud, label: "Online" },
  offline: { cls: "bg-warning-soft text-warning-foreground", Icon: CloudOff, label: "Offline · saving here" },
  auth: { cls: "bg-destructive-soft text-destructive", Icon: LogIn, label: "Signed out" },
};

/** Connection state in a pill. On a result flood, pass `tint` so it takes the flood's ink instead. */
export function ConnPill({ conn, tint, live = true }: { conn: Connection; tint?: string; live?: boolean }) {
  const cfg = CONN[conn];
  return (
    <span
      role={live ? "status" : undefined}
      className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", tint ?? cfg.cls)}
    >
      <cfg.Icon className="size-3.5" aria-hidden /> {cfg.label}
    </span>
  );
}
