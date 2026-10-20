import { CampIllustration } from "@/components/brand/skyline";
import { cn } from "@/lib/utils";

/**
 * A tent under the ridge (sun by day, moon by night) and a line in the house voice.
 * `children` is the one-line message; add `title` for a headline above it.
 * `illustration` also takes a node to swap the tent for another scene (404, error),
 * and `titleAs` lets a full-page state make its title the page's h1.
 */
export function EmptyState({
  title,
  children,
  action,
  illustration = true,
  titleAs: Title = "p",
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  illustration?: boolean | React.ReactNode;
  titleAs?: "p" | "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-8 text-center", className)}>
      {illustration === true ? <CampIllustration className="mb-3 h-20 w-44" /> : illustration || null}
      {title && <Title className="font-display text-lg font-bold tracking-tight">{title}</Title>}
      <div className={cn("text-sm text-muted-foreground", title && "mt-1")}>{children}</div>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
