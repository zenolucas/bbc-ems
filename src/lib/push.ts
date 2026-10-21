import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { notificationLog, pushTokens } from "@/db/schema";
import { env } from "./env";

let client: Expo | null = null;
const expo = () => (client ??= new Expo({ accessToken: env.expoAccessToken }));

export type PushPayload = {
  title: string;
  body: string;
  /** App route to open when tapped, e.g. /bookings/abc. */
  url: string;
};

export async function registerPushToken(userId: string, token: string, platform: string, deviceId: string) {
  if (!Expo.isExpoPushToken(token)) throw new Error("Not an Expo push token");
  // A phone that signs in as someone else moves its token to the new account.
  await db
    .insert(pushTokens)
    .values({ id: nanoid(14), userId, token, platform, deviceId })
    .onConflictDoUpdate({ target: pushTokens.token, set: { userId, platform, deviceId, lastSeenAt: new Date() } });
}

export async function unregisterPushToken(userId: string, token: string) {
  await db.delete(pushTokens).where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
}

/**
 * Sends to every app the member is signed in on. Never throws: a push is a
 * nice-to-have next to the email, so a failure is logged and the caller moves on.
 */
export async function sendPush(userId: string, p: PushPayload) {
  try {
    const rows = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.userId, userId));
    if (rows.length === 0) return;
    const messages: ExpoPushMessage[] = rows.map((r) => ({
      to: r.token,
      title: p.title,
      body: p.body,
      data: { url: p.url },
      sound: "default",
      channelId: "default",
      priority: "high",
    }));
    const gone: string[] = [];
    for (const chunk of expo().chunkPushNotifications(messages)) {
      const tickets = await expo().sendPushNotificationsAsync(chunk);
      tickets.forEach((t, i) => {
        if (t.status === "error" && t.details?.error === "DeviceNotRegistered") gone.push(chunk[i].to as string);
        else if (t.status === "error") console.error("[push]", t.message);
      });
    }
    if (gone.length) await db.delete(pushTokens).where(inArray(pushTokens.token, gone));
  } catch (e) {
    console.error("[push]", e);
  }
}

/** Sends a reminder at most once per (kind, ref, user). Returns false if it already went out. */
export async function sendPushOnce(userId: string, kind: string, refId: string, p: PushPayload) {
  const [row] = await db
    .insert(notificationLog)
    .values({ id: nanoid(14), userId, kind, refId })
    .onConflictDoNothing()
    .returning({ id: notificationLog.id });
  if (!row) return false;
  await sendPush(userId, p);
  return true;
}
