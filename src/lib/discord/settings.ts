import "server-only";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { appSettings } from "@/db/schema";

const KEY = "discord";

const id = z.string().regex(/^\d{5,25}$/).optional().catch(undefined);

/**
 * Channel and role picks from /admin/discord. Kept in the database rather than env so an
 * organiser can change them without a redeploy. Everything is optional: a missing channel
 * or role just switches that feature off.
 */
export const discordSettingsSchema = z.object({
  /** Where new events are announced. */
  eventsChannelId: id,
  /** Category the ticket holders' chats are created in, and the one they move to afterwards. */
  chatsCategoryId: id,
  archiveCategoryId: id,
  /** Server roles mirrored from the EMS: admin → organiser, staff → door crew. */
  organiserRoleId: id,
  doorRoleId: id,
  /** Anyone who has ever had an approved booking. */
  camperRoleId: id,
  /** Native Discord events alongside each announcement. */
  scheduledEvents: z.boolean().catch(true),
  /** A role per event for its ticket holders. */
  eventRoles: z.boolean().catch(true),
  /** "Tomorrow: …" post in the events channel the day before. */
  reminderPosts: z.boolean().catch(true),
  /** Add members to the server when they link Discord. */
  autoJoin: z.boolean().catch(true),
});

export type DiscordSettings = z.infer<typeof discordSettingsSchema>;

export async function getDiscordSettings(): Promise<DiscordSettings> {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, KEY) });
  return discordSettingsSchema.parse(row?.value ?? {});
}

export async function saveDiscordSettings(value: DiscordSettings) {
  const clean = discordSettingsSchema.parse(value);
  await db
    .insert(appSettings)
    .values({ key: KEY, value: clean })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: clean, updatedAt: sql`now()` } });
  return clean;
}

/** The server roles the EMS hands out and takes back. Anything else on a member is left alone. */
export function staffRoleFor(s: DiscordSettings, role: string) {
  if (role === "admin") return s.organiserRoleId;
  if (role === "staff") return s.doorRoleId;
  return undefined;
}
