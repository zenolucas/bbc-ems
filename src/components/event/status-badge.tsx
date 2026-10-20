import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-grass/15 text-forest dark:text-lime border-grass/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  ended: "bg-slate/10 text-muted-foreground",
  pending_payment: "bg-sun/20 text-yellow-800 dark:text-star border-sun/40",
  under_review: "bg-sky/15 text-sky-deep dark:text-sky border-sky/30",
  approved: "bg-grass/15 text-forest dark:text-lime border-grass/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground",
  valid: "bg-grass/15 text-forest dark:text-lime border-grass/30",
  used: "bg-muted text-muted-foreground",
  void: "bg-destructive/10 text-destructive border-destructive/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", styles[status], className)}>
      {status.replace("_", " ")}
    </Badge>
  );
}
