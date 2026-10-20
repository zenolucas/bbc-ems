import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const stampVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full border-[3px] border-double border-current font-display font-extrabold uppercase tracking-[0.14em] -rotate-12 select-none",
  {
    variants: {
      tone: {
        success: "text-success-foreground",
        destructive: "text-destructive",
        info: "text-info-foreground",
        muted: "text-muted-foreground",
        inverse: "text-white",
      },
      size: {
        sm: "px-3 py-1 text-[11px]",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-2xl border-4",
      },
    },
    defaultVariants: { tone: "success", size: "md" },
  },
);

/**
 * Rubber-stamp overlay: CHECKED IN on a used ticket, SOLD OUT on a card, VALID on
 * the verify page. Rotated and double-ringed so it reads as applied, not printed.
 */
export function Stamp({ className, tone, size, ...props }: React.ComponentProps<"span"> & VariantProps<typeof stampVariants>) {
  return <span data-slot="stamp" className={cn(stampVariants({ tone, size }), className)} {...props} />;
}
