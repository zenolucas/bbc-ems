"use client";
import { Bell, ChevronDown, Mail, MessagesSquare, Paperclip } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export type OutboxItem = {
  id: string;
  kind: "email" | "push" | "discord";
  to: string | null;
  subject: string | null;
  html: string | null;
  text: string | null;
  url: string | null;
  attachments: string[];
  at: string;
};

/** Every email, push and Discord post the demo site "sent", newest first. Emails open in a sandboxed frame. */
export function OutboxList({ rows }: { rows: OutboxItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (rows.length === 0) {
    return <div className="border-t p-4"><EmptyState title="Nothing sent yet">Book something as Mara or approve a payment as Bea, and the email lands here.</EmptyState></div>;
  }
  return (
    <ul>
      {rows.map((r) => {
        const isOpen = open === r.id;
        const Icon = r.kind === "email" ? Mail : r.kind === "discord" ? MessagesSquare : Bell;
        return (
          <li key={r.id} className="border-t">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : r.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", r.kind === "email" ? "bg-info-soft text-info-foreground" : r.kind === "discord" ? "bg-accent text-accent-foreground" : "bg-success-soft text-success-foreground")} aria-hidden>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.subject || "(no subject)"}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.kind === "email" ? `To ${r.to}` : r.kind === "discord" ? "Discord" : `Push · ${r.text}`} · {r.at}
                  {r.attachments.length > 0 && <> · <Paperclip className="inline size-3" aria-label="attachments" /> {r.attachments.length}</>}
                </span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
            </button>
            {isOpen && (
              <div className="px-4 pb-4">
                {r.kind === "email" && r.html ? (
                  <iframe title={r.subject ?? "Email"} sandbox="" srcDoc={r.html} className="h-[560px] w-full rounded-xl border bg-white" />
                ) : (
                  <div className="rounded-xl border bg-surface-2 p-3 text-sm">
                    <div className="font-semibold">{r.subject}</div>
                    <div className="whitespace-pre-line text-muted-foreground">{r.text}</div>
                    {r.url && <div className="mt-1 font-mono text-xs text-muted-foreground">opens {r.url}</div>}
                  </div>
                )}
                {r.attachments.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Attached: {r.attachments.join(", ")}</p>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
