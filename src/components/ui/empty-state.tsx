import { CampIllustration } from "@/components/brand/skyline";
import { cn } from "@/lib/utils";

/**
 * A tent under the ridge (sun by day, moon by night) and a line in the house voice.
 * `children` is the one-line message; add `title` for a headline above it.
 */
export function EmptyState({
  title,
  children,
  action,
  illustration = true,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  illustration?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-8 text-center", className)}>
      {illustration && <CampIllustration className="mb-3 h-20 w-44" />}
      {title && <p className="font-display text-lg font-bold tracking-tight">{title}</p>}
      <div className={cn("text-sm text-muted-foreground", title && "mt-1")}>{children}</div>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
