import "server-only";
import { DEMO_PERSONAS, type DemoPersonaKey, PERSONA_LABELS } from "@bbc/shared/demo";
import { type Db, db } from "@/db/client";
import { users } from "@/db/schema";

export const DEMO_EMAIL_DOMAIN = "demo.invalid";

/** Stable ids so a reset keeps everyone signed in. */
export const PERSONAS = Object.fromEntries(
  DEMO_PERSONAS.map((key) => {
    const p = PERSONA_LABELS[key];
    const home = key === "member" ? "/me" : key === "door" ? "/admin/scan" : "/admin";
    return [key, { key, id: `demo_${key}`, email: `${key}@${DEMO_EMAIL_DOMAIN}`, name: p.name, role: p.role, home }];
  }),
) as Record<DemoPersonaKey, { key: DemoPersonaKey; id: string; email: string; name: string; role: "member" | "staff" | "admin"; home: string }>;

export function personaForUser(user: { id: string } | null | undefined): DemoPersonaKey | null {
  if (!user) return null;
  return DEMO_PERSONAS.find((k) => PERSONAS[k].id === user.id) ?? null;
}

/** Creates the persona accounts, or puts their names and roles back if someone changed them. */
export async function upsertPersonas(tx: Pick<Db, "insert"> = db) {
  for (const p of Object.values(PERSONAS)) {
    await tx
      .insert(users)
      .values({ id: p.id, email: p.email, name: p.name, role: p.role, emailVerified: true })
      .onConflictDoUpdate({ target: users.id, set: { email: p.email, name: p.name, role: p.role, emailVerified: true, updatedAt: new Date() } });
  }
}
