"use client";
import type { ConfigDTO, DemoPersonaKey } from "@bbc/shared/demo";
import { FlaskConical, Loader2, ScanLine, Shield, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { signInAsPersonaAction } from "@/app/demo-actions";
import { runAction } from "@/lib/run-action";

const ICONS: Record<DemoPersonaKey, typeof UserRound> = { member: UserRound, door: ScanLine, organiser: Shield };

type Persona = NonNullable<ConfigDTO["demo"]>["personas"][number];

/** Signs in as the persona, then a full page load (see signInAsPersonaAction for why). */
export async function switchPersona(key: DemoPersonaKey, next?: string) {
  const r = await signInAsPersonaAction(key, next).catch(() => null);
  if (r?.ok) window.location.assign(r.href);
  else await runAction(async () => r ?? { error: "Couldn't sign in. Try again." });
}

/** Demo site: skip the email and sign in as one of the three personas. */
export function PersonaPicker({ personas, next }: { personas: Persona[]; next: string }) {
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<DemoPersonaKey | null>(null);
  return (
    <section aria-labelledby="persona-h" className="rounded-[18px] border border-dashed bg-card p-3.5">
      <h2 id="persona-h" className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
        <FlaskConical className="size-4 text-muted-foreground" aria-hidden /> Demo: skip the email, sign in as
      </h2>
      <div className="grid gap-2">
        {personas.map((p) => {
          const Icon = ICONS[p.key];
          return (
            <button
              key={p.key}
              type="button"
              disabled={pending}
              onClick={() => {
                setChosen(p.key);
                start(() => switchPersona(p.key, next));
              }}
              className="flex items-center gap-3 rounded-[14px] border bg-background px-3 py-2.5 text-left transition-colors outline-none hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2" aria-hidden>
                {pending && chosen === p.key ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{p.name} · {p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
