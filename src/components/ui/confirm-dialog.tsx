"use client";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Replaces window.confirm(). Render it with a trigger; onConfirm runs inside a
 * transition and the dialog closes when it resolves (unless it returns false).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Keep it",
  destructive,
  onConfirm,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void | boolean> | void | boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>{cancelLabel}</Button>
            <Button
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const keepOpen = (await onConfirm()) === false;
                  if (!keepOpen) setOpen(false);
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
