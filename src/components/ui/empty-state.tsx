import { cn } from "@/lib/utils";

export function EmptyState({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-dashed p-10 text-center", className)}>
      <div className="text-muted-foreground">{children}</div>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
