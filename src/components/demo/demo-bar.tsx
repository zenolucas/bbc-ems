"use client";
import type { ConfigDTO, DemoPersonaKey } from "@bbc/shared/demo";
import { Check, ChevronDown, FlaskConical, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchPersona } from "./persona-picker";

/**
 * The demo site's strip above every page: says nothing here is real and, while
 * demo mode is on, switches persona in one tap. Reads /api/v1/config on each
 * navigation so it follows the admin switch without a redeploy. The door
 * scanner owns its whole screen, so the strip stays out of it.
 */
export function DemoBar() {
  const path = usePathname();
  const [config, setConfig] = useState<ConfigDTO | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(() => {
    fetch("/api/v1/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: ConfigDTO | null) => c && setConfig(c))
      .catch(() => {});
  }, []);

  useEffect(load, [load, path]);
  useEffect(() => {
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  if (/^\/admin\/scan\/[^/]+/.test(path)) return null;
  const demo = config?.demo;
  const current = demo?.personas.find((p) => p.key === demo.current);

  const become = (key: DemoPersonaKey) => start(() => switchPersona(key));

  return (
    <div className="flex min-h-9 items-center justify-center gap-x-3 gap-y-1 bg-sun px-4 py-1.5 text-[13px] text-deep-forest dark:bg-star">
      <span className="flex items-center gap-1.5 font-semibold">
        <FlaskConical className="size-4" aria-hidden /> Demo site
      </span>
      <span className="hidden sm:inline">Nothing here is real: no emails leave, no money moves.</span>
      {demo && (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded-full bg-deep-forest/10 px-2.5 py-0.5 font-semibold outline-none hover:bg-deep-forest/15 focus-visible:ring-3 focus-visible:ring-deep-forest/40">
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {current ? `You're ${current.name.split(" ")[0]} · ${current.label}` : "Try it as…"}
            <ChevronDown className="size-3.5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-72">
            <DropdownMenuLabel>Switch persona</DropdownMenuLabel>
            {demo.personas.map((p) => (
              <DropdownMenuItem key={p.key} disabled={pending} onSelect={() => become(p.key)} className="items-start gap-2.5 py-2">
                <span className="mt-0.5 grid size-4 place-items-center">{p.key === demo.current && <Check className="size-4" aria-hidden />}</span>
                <span className="min-w-0">
                  <span className="block font-semibold">{p.name} · {p.label}</span>
                  <span className="block text-xs text-muted-foreground">{p.blurb}</span>
                </span>
              </DropdownMenuItem>
            ))}
            {demo.current === "organiser" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/demo">Demo tools and outbox</Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
