import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { demoOutbox } from "@/db/schema";
import { env } from "@/lib/env";
import { isDemoDeployment } from "./flag";

const KEEP = 500;

/**
 * On the demo deployment, persona addresses (@demo.invalid, undeliverable by RFC 2606) always
 * land in the outbox, and so does everything else when there is no Resend key.
 */
export async function routeToOutbox(to: string) {
  if (!(await isDemoDeployment())) return false;
  return to.toLowerCase().endsWith(".invalid") || !env.resendApiKey;
}

export type OutboxRow = Omit<typeof demoOutbox.$inferInsert, "id" | "createdAt">;

export async function writeOutbox(row: OutboxRow) {
  const id = nanoid(14);
  await db.insert(demoOutbox).values({ id, ...row });
  // Keep the newest few hundred; the outbox is a showcase, not an archive
  await db.execute(
    sql`delete from ${demoOutbox} where ${demoOutbox.id} in (select ${demoOutbox.id} from ${demoOutbox} order by ${demoOutbox.createdAt} desc offset ${KEEP})`,
  );
  return { id: `outbox:${id}` };
}

export async function listOutbox(opts: { limit?: number; kind?: "email" | "push" | "discord" } = {}) {
  return db
    .select()
    .from(demoOutbox)
    .where(opts.kind ? eq(demoOutbox.kind, opts.kind) : undefined)
    .orderBy(desc(demoOutbox.createdAt))
    .limit(opts.limit ?? 50);
}

export async function clearOutbox() {
  await db.delete(demoOutbox);
}
