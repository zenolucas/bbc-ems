"use client";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

/** The header's "Edit event", hidden on the edit page itself. Client-side: the layout persists across tab changes. */
export function EditEventButton({ href }: { href: string }) {
  if (usePathname() === href) return null;
  return (
    <Button asChild className="h-[38px] rounded-full px-4 text-[13px]">
      <Link href={href}><Pencil /> Edit event</Link>
    </Button>
  );
}
