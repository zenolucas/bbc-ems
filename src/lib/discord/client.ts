import "server-only";
import { discordBotEnabled, env } from "@/lib/env";

// DISCORD_API_BASE is for the smoke test's fake Discord only (scripts/discord-smoke.ts)
const API = process.env.DISCORD_API_BASE || "https://discord.com/api/v10";

export type DiscordResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code?: number; message: string };

type Options = {
  body?: unknown;
  /** Shown in the server's audit log, so moderators can tell the EMS did it. */
  reason?: string;
  /** Statuses that are an answer, not a failure (e.g. 404 for "not in the server"), so they aren't logged. */
  expect?: number[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One call to Discord's REST API as the bot. Never throws: Discord is a nice-to-have next
 * to email and push, so every failure comes back as `{ ok: false }` and is logged. A rate
 * limit is waited out once if Discord asks for a short pause.
 */
export async function discordApi<T = unknown>(method: string, path: string, opts: Options = {}): Promise<DiscordResult<T>> {
  if (!env.discordBotToken) return { ok: false, status: 0, message: "Discord bot isn't configured" };
  const headers: Record<string, string> = {
    Authorization: `Bot ${env.discordBotToken}`,
    "User-Agent": `DiscordBot (${env.appUrl}, 1.0)`,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.reason) headers["X-Audit-Log-Reason"] = encodeURIComponent(opts.reason.slice(0, 400));

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
    } catch (e) {
      console.error(`[discord] ${method} ${path}`, e);
      return { ok: false, status: 0, message: e instanceof Error ? e.message : "Network error" };
    }
    if (res.status === 429 && attempt === 0) {
      const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
      const wait = (body.retry_after ?? Number(res.headers.get("retry-after") ?? 1)) * 1000;
      if (wait <= 10_000) {
        await sleep(wait + 100);
        continue;
      }
    }
    if (res.ok) {
      const data = res.status === 204 ? (undefined as T) : ((await res.json().catch(() => undefined)) as T);
      return { ok: true, status: res.status, data };
    }
    const err = (await res.json().catch(() => ({}))) as { code?: number; message?: string; errors?: unknown };
    const message = err.message ?? res.statusText;
    if (!opts.expect?.includes(res.status)) {
      console.error(`[discord] ${method} ${path} → ${res.status} ${err.code ?? ""} ${message}`, err.errors ? JSON.stringify(err.errors) : "");
    }
    return { ok: false, status: res.status, code: err.code, message };
  }
}

/** The guild every bot call works in. Only meaningful when discordBotEnabled. */
export const guildPath = (rest = "") => `/guilds/${env.discordGuildId}${rest}`;

export { discordBotEnabled };

/** Link to a message, for the admin UI. */
export const messageUrl = (channelId: string, messageId: string) =>
  `https://discord.com/channels/${env.discordGuildId}/${channelId}/${messageId}`;
export const scheduledEventUrl = (id: string) => `https://discord.com/events/${env.discordGuildId}/${id}`;
export const channelUrl = (channelId: string) => `https://discord.com/channels/${env.discordGuildId}/${channelId}`;
