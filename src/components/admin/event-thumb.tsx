import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { Skyline } from "@/components/brand/skyline";
import { cn } from "@/lib/utils";

/**
 * Square poster thumb for organiser lists and headers. No poster: the event's
 * own seeded skyline, or a dashed "add one" tile for drafts. Cancelled events
 * get a struck-through tile so the row reads as dead at a glance.
 */
export function EventThumb({ cover, slug, status, className }: { cover: string | null; slug: string; status: string; className?: string }) {
  const box = cn("relative size-11 shrink-0 overflow-hidden rounded-[10px]", className);
  if (status === "cancelled") {
    return <span className={cn(box, "grid place-items-center bg-destructive-soft text-destructive")}><X className="size-5" aria-hidden /></span>;
  }
  if (cover) {
    return <span className={box}><Image src={cover} alt="" fill unoptimized sizes="88px" className="object-cover" /></span>;
  }
  if (status === "draft") {
    return <span className={cn(box, "grid place-items-center border border-dashed bg-surface-2 text-muted-foreground")}><ImagePlus className="size-5" aria-hidden /></span>;
  }
  return <span className={box} aria-hidden><Skyline size="card" seed={slug} animated={false} className="absolute inset-0" /></span>;
}
