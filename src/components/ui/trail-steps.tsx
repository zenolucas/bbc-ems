import { Check, Clock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrailStepStatus = "done" | "current" | "pending" | "waiting" | "error";

/**
 * The booking journey as trail markers on a dashed path: Pick → Pay → Ticket.
 * Done markers fill in, the current one is a sun-yellow mountain flag, a step
 * waiting on someone else shows a clock, a failed step an alert.
 */
export function TrailSteps({ steps, className }: { steps: { label: string; status: TrailStepStatus }[]; className?: string }) {
  return (
    <nav aria-label="Progress" className={cn("flex items-center", className)}>
      {steps.map((s, i) => (
        <div key={s.label} className="contents">
          {i > 0 && (
            <div
              aria-hidden
              className={cn(
                "mb-5 h-0 flex-1 border-t-2 border-dashed",
                steps[i - 1].status === "done" ? "border-primary" : steps[i - 1].status === "waiting" ? "border-info" : "border-border",
              )}
            />
          )}
          <div className="flex w-16 flex-col items-center gap-1.5" aria-current={s.status === "current" ? "step" : undefined}>
            <Marker status={s.status} index={i + 1} />
            <span
              className={cn(
                "text-xs",
                s.status === "current" ? "font-bold" : s.status === "waiting" ? "font-bold text-info-foreground" : s.status === "error" ? "font-bold text-destructive" : s.status === "done" ? "font-semibold" : "font-semibold text-muted-foreground",
              )}
            >
              {s.label}
            </span>
          </div>
        </div>
      ))}
    </nav>
  );
}

function Marker({ status, index }: { status: TrailStepStatus; index: number }) {
  switch (status) {
    case "done":
      return (
        <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3.5 stroke-[2.6]" aria-hidden />
        </span>
      );
    case "current":
      return (
        <span className="grid size-8 place-items-center rounded-full bg-sun text-deep-forest ring-4 ring-warning-soft dark:bg-star">
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
            <path d="M4 20 12 5l8 15H4Z" />
          </svg>
        </span>
      );
    case "waiting":
      return (
        <span className="grid size-8 place-items-center rounded-full bg-info-soft text-info-foreground ring-4 ring-info/10">
          <Clock className="size-4" aria-hidden />
        </span>
      );
    case "error":
      return (
        <span className="grid size-8 place-items-center rounded-full bg-destructive text-white ring-4 ring-destructive-soft">
          <TriangleAlert className="size-4" aria-hidden />
        </span>
      );
    default:
      return <span className="grid size-7 place-items-center rounded-full border-2 bg-card text-xs font-bold text-muted-foreground">{index}</span>;
  }
}
