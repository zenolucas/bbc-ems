"use server";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { roleGrants, sessions, users, type UserRole } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { syncMemberRolesLater } from "@/lib/discord/sync";
import { requireAdmin } from "@/lib/session";

const roleSchema = z.enum(["member", "staff", "admin"]);

async function adminCount(excludingId?: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(excludingId ? and(eq(users.role, "admin"), ne(users.id, excludingId)) : eq(users.role, "admin"));
  return n;
}

async function applyRole(userId: string, role: UserRole, current: UserRole) {
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  // Losing access should bite now, not when the 5-minute session cache expires
  const rank = { member: 0, staff: 1, admin: 2 } as const;
  if (rank[role] < rank[current]) await db.delete(sessions).where(eq(sessions.userId, userId));
  // Organiser / door crew roles on the Discord server follow
  syncMemberRolesLater(userId);
}

/** Gives an email door or admin access. Works whether or not they've signed up yet. */
export async function inviteAction(rawEmail: string, rawRole: string): Promise<ActionResult<{ message: string }>> {
  const admin = await requireAdmin();
  const email = rawEmail.trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { error: "That doesn't look like an email address" };
  const role = roleSchema.exclude(["member"]).safeParse(rawRole);
  if (!role.success) return { error: "Pick door crew or admin" };
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    if (existing.role === role.data) return { error: `${email} is already ${role.data === "admin" ? "an admin" : "door crew"}` };
    if (existing.id === admin.id) return { error: "You can't change your own role" };
    if (existing.role === "admin" && (await adminCount(existing.id)) === 0) return { error: "Keep at least one admin" };
    await applyRole(existing.id, role.data, existing.role);
    revalidatePath("/admin/team");
    return { ok: true, message: `${existing.name || email} is now ${role.data === "admin" ? "an admin" : "door crew"}. They may need to sign in again.` };
  }
  await db
    .insert(roleGrants)
    .values({ email, role: role.data, createdBy: admin.id })
    .onConflictDoUpdate({ target: roleGrants.email, set: { role: role.data, createdBy: admin.id, createdAt: new Date() } });
  revalidatePath("/admin/team");
  return { ok: true, message: `Invite saved. When ${email} signs in, they'll have ${role.data === "admin" ? "admin" : "door"} access.` };
}

export async function setRoleAction(userId: string, rawRole: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const role = roleSchema.safeParse(rawRole);
  if (!role.success) return { error: "Unknown role" };
  if (userId === admin.id) return { error: "You can't change your own role. Ask another admin." };
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) return { error: "User not found" };
  if (u.role === "admin" && role.data !== "admin" && (await adminCount(u.id)) === 0) return { error: "Keep at least one admin" };
  await applyRole(u.id, role.data, u.role);
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function revokeInviteAction(email: string): Promise<ActionResult> {
  await requireAdmin();
  await db.delete(roleGrants).where(eq(roleGrants.email, email.toLowerCase()));
  revalidatePath("/admin/team");
  return { ok: true };
}
