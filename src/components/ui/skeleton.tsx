import { cn } from "cn"

/** Shimmer in the surface tint, shaped like the content it replaces. Still under reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bbc-shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
