/*
 * Discord integration against a fake Discord (an in-process HTTP server that keeps
 * messages, scheduled events, roles, channels and members in memory) and the local DB.
 * Creates its own zz-discord-* event and users and removes them, and puts the Discord
 * settings back the way they were. No real Discord server or token needed.
 *
 *   pnpm smoke:discord
 *   pnpm smoke:discord --serve   # only the fake Discord, on :3199, to click through the UI
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

const GUILD = "9000000001";
const CH_EVENTS = "1000000001";
const CAT_CHATS = "2000000001";
const CAT_ARCHIVE = "3000000001";
const R_ORG = "4000000001";
const R_DOOR = "4000000002";
const R_CAMPER = "4000000003";
const R_HAND = "4000000099"; // given by a moderator, never touched by the EMS
const BOT = "1234567890";

// ---------- fake Discord ----------
type Msg = { id: string; channel: string; body: Record<string, unknown> };
const state = {
  messages: new Map<string, Msg>(),
  pins: new Set<string>(),
  scheduled: new Map<string, Record<string, unknown>>(),
  roles: new Map<string, { id: string; name: string; position: number; permissions: string; managed: boolean; color: number }>(),
  channels: new Map<string, Record<string, unknown> & { id: string; name: string; parent_id?: string | null }>(),
  members: new Map<string, { roles: string[] }>(),
  joins: [] as string[],
  calls: [] as string[],
  rateLimitNext: false,
};
let seq = 5_000_000_000;
const nextId = () => String(seq++);

for (const [id, name, position] of [[GUILD, "@everyone", 0], [R_ORG, "Organisers", 5], [R_DOOR, "Door crew", 4], [R_CAMPER, "Campers", 3], [R_HAND, "Moderator pick", 2], ["4000000100", "Bot", 10]] as const) {
  state.roles.set(id, { id, name, position, permissions: id === "4000000100" ? String(8) : "0", managed: false, color: 0 });
}
for (const [id, name, type] of [[CH_EVENTS, "events", 0], [CAT_CHATS, "Event chats", 4], [CAT_ARCHIVE, "Archive", 4]] as const) {
  state.channels.set(id, { id, name, type, position: 0, parent_id: null });
}
state.members.set(BOT, { roles: ["4000000100"] });

function fake(req: http.IncomingMessage, res: http.ServerResponse) {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    const method = req.method!;
    const path = req.url!.split("?")[0];
    state.calls.push(`${method} ${path}`);
    const send = (status: number, data?: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(data === undefined ? "" : JSON.stringify(data));
    };
    // For poking at the fake from outside in --serve mode
    if (path === "/_state") return send(200, { ...state, messages: [...state.messages.values()], scheduled: [...state.scheduled.values()], roles: [...state.roles.values()], channels: [...state.channels.values()], members: Object.fromEntries(state.members), pins: [...state.pins] });
    if (req.headers.authorization !== "Bot MTIzNDU2Nzg5MA.fake.token") return send(401, { message: "401: Unauthorized", code: 0 });
    if (state.rateLimitNext) {
      state.rateLimitNext = false;
      return send(429, { message: "You are being rate limited.", retry_after: 0.05, global: false });
    }
    let m: RegExpMatchArray | null;
    const r = (re: RegExp) => (m = path.match(re));

    if (method === "GET" && r(/^\/users\/@me$/)) return send(200, { id: BOT, username: "BaseCampBot" });
    if (method === "GET" && r(/^\/users\/(\d+)$/)) return send(200, { id: m![1], username: `user${m![1]}`, global_name: "Linked Person", avatar: null });
    if (method === "GET" && r(/^\/guilds\/\d+$/)) return send(200, { id: GUILD, name: "Fake Base Camp", icon: null, approximate_member_count: state.members.size });

    if (method === "POST" && r(/^\/channels\/(\d+)\/messages$/)) {
      const id = nextId();
      state.messages.set(id, { id, channel: m![1], body });
      return send(200, { id });
    }
    if (r(/^\/channels\/(\d+)\/messages\/(\d+)$/)) {
      const msg = state.messages.get(m![2]);
      if (!msg || msg.channel !== m![1]) return send(404, { message: "Unknown Message", code: 10008 });
      if (method === "PATCH") return (msg.body = body), send(200, { id: msg.id });
      if (method === "DELETE") return state.messages.delete(msg.id), send(204);
    }
    if (method === "PUT" && r(/^\/channels\/(\d+)\/pins\/(\d+)$/)) return state.pins.add(m![2]), send(204);
    if (r(/^\/channels\/(\d+)$/)) {
      const ch = state.channels.get(m![1]);
      if (!ch) return send(404, { message: "Unknown Channel", code: 10003 });
      if (method === "GET") return send(200, ch);
      if (method === "PATCH") return Object.assign(ch, body), send(200, ch);
    }

    if (method === "POST" && r(/^\/guilds\/\d+\/scheduled-events$/)) {
      const id = nextId();
      state.scheduled.set(id, { id, status: 1, ...body });
      return send(200, { id });
    }
    if (r(/^\/guilds\/\d+\/scheduled-events\/(\d+)$/)) {
      const ev = state.scheduled.get(m![1]);
      if (!ev) return send(404, { message: "Unknown Guild Scheduled Event", code: 10070 });
      if (method === "DELETE") return state.scheduled.delete(m![1]), send(204);
      if (method === "PATCH") {
        // Discord's rules: scheduled → active/canceled, active → completed
        if (body.status !== undefined) {
          const ok = (ev.status === 1 && [2, 4].includes(body.status)) || (ev.status === 2 && body.status === 3);
          if (!ok) return send(400, { message: "Invalid status transition", code: 180000 });
        }
        return Object.assign(ev, body), send(200, ev);
      }
    }

    if (method === "GET" && r(/^\/guilds\/\d+\/roles$/)) return send(200, [...state.roles.values()]);
    if (method === "GET" && r(/^\/guilds\/\d+\/channels$/)) return send(200, [...state.channels.values()]);
    if (method === "POST" && r(/^\/guilds\/\d+\/roles$/)) {
      const id = nextId();
      state.roles.set(id, { id, name: body.name, position: 1, permissions: body.permissions, managed: false, color: 0 });
      return send(200, { id });
    }
    if (r(/^\/guilds\/\d+\/roles\/(\d+)$/)) {
      const role = state.roles.get(m![1]);
      if (!role) return send(404, { message: "Unknown Role", code: 10011 });
      if (method === "PATCH") return Object.assign(role, body), send(200, role);
      if (method === "DELETE") {
        state.roles.delete(role.id);
        for (const mem of state.members.values()) mem.roles = mem.roles.filter((x) => x !== role.id);
        return send(204);
      }
    }
    if (method === "POST" && r(/^\/guilds\/\d+\/channels$/)) {
      const id = nextId();
      state.channels.set(id, { id, ...body });
      return send(200, { id });
    }
    if (r(/^\/guilds\/\d+\/members\/(\d+)$/)) {
      const mem = state.members.get(m![1]);
      if (method === "GET") return mem ? send(200, { roles: mem.roles, user: { id: m![1] } }) : send(404, { message: "Unknown Member", code: 10007 });
      if (method === "PUT") {
        if (mem) return send(204);
        if (!body.access_token) return send(400, { message: "access_token required" });
        state.members.set(m![1], { roles: [] });
        state.joins.push(m![1]);
        return send(201, { roles: [] });
      }
    }
    if (r(/^\/guilds\/\d+\/members\/(\d+)\/roles\/(\d+)$/)) {
      const mem = state.members.get(m![1]);
      if (!mem) return send(404, { message: "Unknown Member", code: 10007 });
      if (!state.roles.has(m![2])) return send(404, { message: "Unknown Role", code: 10011 });
      if (method === "PUT" && !mem.roles.includes(m![2])) mem.roles.push(m![2]);
      if (method === "DELETE") mem.roles = mem.roles.filter((x) => x !== m![2]);
      return send(204);
    }
    send(404, { message: `fake Discord has no ${method} ${path}`, code: 0 });
  });
}

// ---------- checks ----------
function check(label: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${!ok && extra !== undefined ? ` → ${JSON.stringify(extra)}` : ""}`);
  if (!ok) process.exitCode = 1;
}
const eventMessages = () => [...state.messages.values()].filter((x) => x.channel === CH_EVENTS);
const embedOf = (msg?: Msg) => (msg?.body.embeds as { title: string; footer: { text: string }; fields: { name: string; value: string }[] }[] | undefined)?.[0];

async function main() {
  // `--serve`: just run the fake Discord on :3199 for trying the UI against it
  if (process.argv.includes("--serve")) {
    http.createServer(fake).listen(3199, "127.0.0.1", () => console.log("fake Discord on http://127.0.0.1:3199 (bot token MTIzNDU2Nzg5MA.fake.token, guild 9000000001)"));
    process.on("SIGINT", () => {
      console.log(JSON.stringify(state.calls, null, 1));
      process.exit(0);
    });
    return;
  }
  const server = http.createServer(fake);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  Object.assign(process.env, {
    DISCORD_ENABLED: "1",
    DISCORD_API_BASE: `http://127.0.0.1:${port}`,
    DISCORD_BOT_TOKEN: "MTIzNDU2Nzg5MA.fake.token", // base64("1234567890") = the bot's user id
    DISCORD_GUILD_ID: GUILD,
    DISCORD_CLIENT_ID: "111",
    DISCORD_CLIENT_SECRET: "secret",
    DEMO_MODE: "",
  });

  // Env is read at import time, so everything loads after it's set
  const { eq, inArray, notInArray, sql } = await import("drizzle-orm");
  const { nanoid } = await import("nanoid");
  const { db } = await import("../src/db/client");
  const schema = await import("../src/db/schema");
  const { appSettings, accounts, bookings, bookingItems, discordEventSync, events, ticketTiers, tickets, users } = schema;
  const { createBooking } = await import("../src/lib/bookings");
  const { saveDiscordSettings } = await import("../src/lib/discord/settings");
  const { syncDiscordEvent, runDiscordCron } = await import("../src/lib/discord/sync");
  const { syncMemberRoles, removeManagedRoles } = await import("../src/lib/discord/roles");
  const { joinGuild } = await import("../src/lib/discord/members");
  const { guildOverview } = await import("../src/lib/discord/guild");
  const { discordApi } = await import("../src/lib/discord/client");

  const before = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "discord") });
  const syncedBefore = (await db.select({ id: discordEventSync.eventId }).from(discordEventSync)).map((r) => r.id);
  const tag = nanoid(6).toLowerCase();
  const eventId = `zz-discord-${tag}`;
  const userA = `zz-discord-a-${tag}`;
  const userB = `zz-discord-b-${tag}`;

  try {
    await saveDiscordSettings({
      eventsChannelId: CH_EVENTS,
      chatsCategoryId: CAT_CHATS,
      archiveCategoryId: CAT_ARCHIVE,
      organiserRoleId: R_ORG,
      doorRoleId: R_DOOR,
      camperRoleId: R_CAMPER,
      scheduledEvents: true,
      eventRoles: true,
      reminderPosts: true,
      autoJoin: true,
    });

    // --- admin overview
    const o = await guildOverview();
    check("overview connects to the server", o.state === "ok" && o.guild.name === "Fake Base Camp", o);
    if (o.state === "ok") {
      check("overview lists text channels and categories", o.textChannels.some((c) => c.id === CH_EVENTS) && o.categories.length === 2);
      check("overview: an admin bot is missing no permissions", o.missingPermissions.length === 0, o.missingPermissions);
    }

    // --- a draft has no post
    const startsAt = new Date(Date.now() + 2 * 86400e3);
    await db.insert(events).values({ id: eventId, slug: eventId, title: "Discord Smoke Hike", tagline: "Up the ridge before sunrise", venueName: "Mt. Test", mapUrl: "https://maps.example.com/x", startsAt, status: "draft", descriptionMd: "Bring water.\n\nWe meet at the gate." });
    const tierId = nanoid(12);
    await db.insert(ticketTiers).values({ id: tierId, eventId, name: "Free", priceCents: 0, quantity: 20, perOrderLimit: 4 });
    let r = await syncDiscordEvent(eventId);
    check("draft: nothing posted", eventMessages().length === 0 && r.announcement === "unchanged", r);

    // --- publish
    await db.update(events).set({ status: "published" }).where(eq(events.id, eventId));
    state.rateLimitNext = true; // the first call is rate limited once and retried
    r = await syncDiscordEvent(eventId);
    let row = await db.query.discordEventSync.findFirst({ where: eq(discordEventSync.eventId, eventId) });
    check("publish: announcement posted", r.announcement === "posted" && eventMessages().length === 1, r);
    check("publish: 429 was waited out and retried", !state.rateLimitNext && state.calls.filter((c) => c === `POST /channels/${CH_EVENTS}/messages`).length === 2);
    const posted = state.messages.get(row!.messageId!);
    check("post: embed has title, link and spots", embedOf(posted)?.title === "Discord Smoke Hike" && embedOf(posted)!.fields.some((f) => f.name === "Spots" && f.value === "20 of 20 left"), embedOf(posted));
    check("post: Get tickets + Map buttons", JSON.stringify(posted?.body.components).includes("Get tickets") && JSON.stringify(posted?.body.components).includes("Map"));
    check("post: pings nobody", JSON.stringify(posted?.body.allowed_mentions) === JSON.stringify({ parse: [] }));
    check("publish: scheduled event created", !!row?.scheduledEventId && state.scheduled.get(row.scheduledEventId)?.name === "Discord Smoke Hike");
    check("publish: event role created", !!row?.roleId && state.roles.get(row.roleId)?.name.startsWith("🎟 Discord Smoke Hike") === true);

    // --- idempotent
    const callsBefore = state.calls.length;
    r = await syncDiscordEvent(eventId);
    check("resync with no change: unchanged, no new post", r.announcement === "unchanged" && eventMessages().length === 1, r);
    check("resync with no change: no writes to Discord", state.calls.slice(callsBefore).every((c) => c.startsWith("GET")), state.calls.slice(callsBefore));

    // --- edit
    await db.update(events).set({ title: "Discord Smoke Sunrise Hike" }).where(eq(events.id, eventId));
    r = await syncDiscordEvent(eventId);
    row = await db.query.discordEventSync.findFirst({ where: eq(discordEventSync.eventId, eventId) });
    check("edit: post edited in place", r.announcement === "edited" && eventMessages().length === 1 && embedOf(state.messages.get(row!.messageId!))?.title === "Discord Smoke Sunrise Hike", r);
    check("edit: scheduled event renamed", state.scheduled.get(row!.scheduledEventId!)?.name === "Discord Smoke Sunrise Hike");
    check("edit: role renamed", state.roles.get(row!.roleId!)?.name.startsWith("🎟 Discord Smoke Sunrise Hike") === true);

    // --- chat
    await db.update(discordEventSync).set({ wantsChannel: true }).where(eq(discordEventSync.eventId, eventId));
    await syncDiscordEvent(eventId);
    row = await db.query.discordEventSync.findFirst({ where: eq(discordEventSync.eventId, eventId) });
    const chat = row?.channelId ? state.channels.get(row.channelId) : undefined;
    const ow = (chat?.permission_overwrites ?? []) as { id: string; allow: string; deny: string }[];
    check("chat: created in the chats category", chat?.parent_id === CAT_CHATS, chat);
    check("chat: hidden from @everyone, open to the event role, crew and bot", ow.some((x) => x.id === GUILD && x.deny !== "0") && [row?.roleId, R_ORG, R_DOOR, BOT].every((id) => ow.some((x) => x.id === id && x.allow !== "0")), ow);
    check("chat: welcome message pinned", [...state.messages.values()].some((x) => x.channel === row?.channelId && state.pins.has(x.id)));

    // --- members
    await db.insert(users).values([
      { id: userA, email: `${userA}@example.com`, name: "Disco A", emailVerified: true },
      { id: userB, email: `${userB}@example.com`, name: "No Discord B", emailVerified: true },
    ]);
    await db.insert(accounts).values({ id: nanoid(), userId: userA, providerId: "discord", accountId: "7770000001", accessToken: "user-token", scope: "identify,email,guilds.join" });
    check("roles: not in the server yet", (await syncMemberRoles(userA)) === "not-in-server");
    check("roles: not linked", (await syncMemberRoles(userB)) === "not-linked");
    check("link: joins the server with their token", (await joinGuild("7770000001", "user-token")) === "joined" && state.joins.includes("7770000001"));
    check("link: joining twice is fine", (await joinGuild("7770000001", "user-token")) === "already-member");
    state.members.get("7770000001")!.roles.push(R_HAND);

    check("roles: synced with no bookings", (await syncMemberRoles(userA)) === "synced");
    check("roles: no booking, no roles but the moderator's", JSON.stringify(state.members.get("7770000001")!.roles) === JSON.stringify([R_HAND]));
    await createBooking(userA, { eventId, items: [{ tierId, quantity: 2 }] }); // free → approved
    await syncMemberRoles(userA);
    let rolesA = state.members.get("7770000001")!.roles;
    check("roles: ticket gives the event role and Camper", rolesA.includes(row!.roleId!) && rolesA.includes(R_CAMPER) && rolesA.includes(R_HAND), rolesA);

    await db.update(users).set({ role: "staff" }).where(eq(users.id, userA));
    await syncMemberRoles(userA);
    check("roles: door crew role follows the site role", state.members.get("7770000001")!.roles.includes(R_DOOR));
    await db.update(users).set({ role: "admin" }).where(eq(users.id, userA));
    await syncMemberRoles(userA);
    rolesA = state.members.get("7770000001")!.roles;
    check("roles: promoted to organiser swaps door crew for organiser", rolesA.includes(R_ORG) && !rolesA.includes(R_DOOR), rolesA);
    await db.update(users).set({ role: "member" }).where(eq(users.id, userA));
    await syncMemberRoles(userA);
    check("roles: back to member drops the staff role", !state.members.get("7770000001")!.roles.includes(R_ORG));

    // --- seat count
    r = await syncDiscordEvent(eventId);
    check("seats: post now says 18 of 20", r.announcement === "edited" && embedOf(state.messages.get(row!.messageId!))!.fields.some((f) => f.value === "18 of 20 left"), embedOf(state.messages.get(row!.messageId!)));

    // --- a moderator deleted the post: it comes back
    state.messages.delete(row!.messageId!);
    r = await syncDiscordEvent(eventId, { force: true });
    const row2 = await db.query.discordEventSync.findFirst({ where: eq(discordEventSync.eventId, eventId) });
    check("deleted post is posted again", r.announcement === "posted" && row2!.messageId !== row!.messageId && state.messages.has(row2!.messageId!), r);

    // --- reminders through the cron
    await db.update(events).set({ startsAt: new Date(Date.now() + 20 * 3600e3) }).where(eq(events.id, eventId));
    await runDiscordCron();
    const reminders = () => eventMessages().filter((x) => String(x.body.content ?? "").startsWith("⏰") && String(x.body.content).includes("Discord Smoke Sunrise Hike"));
    check("cron: day-before reminder posted", reminders().length === 1, eventMessages().map((x) => x.body.content));
    await runDiscordCron();
    check("cron: reminder only once", reminders().length === 1);
    check("cron: rescheduled time reached the scheduled event", state.scheduled.get(row2!.scheduledEventId!)?.scheduled_start_time === (await db.query.events.findFirst({ where: eq(events.id, eventId) }))!.startsAt.toISOString());

    // --- cancel
    await db.update(events).set({ status: "cancelled" }).where(eq(events.id, eventId));
    r = await syncDiscordEvent(eventId);
    const row3 = await db.query.discordEventSync.findFirst({ where: eq(discordEventSync.eventId, eventId) });
    const cancelledPost = embedOf(state.messages.get(row3!.messageId!));
    check("cancel: post says cancelled, no ticket button", cancelledPost?.title.startsWith("Cancelled:") === true && !JSON.stringify(state.messages.get(row3!.messageId!)?.body.components).includes("Get tickets"), cancelledPost);
    check("cancel: Discord event cancelled", !row3!.scheduledEventId && state.scheduled.get(row2!.scheduledEventId!)?.status === 4);
    check("cancel: event role deleted and chat archived", !row3!.roleId && !!row3!.archivedAt && !state.roles.has(row!.roleId!) && state.channels.get(row!.channelId!)?.parent_id === CAT_ARCHIVE);
    check("cancel: holder lost the event role, kept Camper", !state.members.get("7770000001")!.roles.includes(row!.roleId!) && state.members.get("7770000001")!.roles.includes(R_CAMPER));

    // --- unlink
    await removeManagedRoles("7770000001");
    check("unlink: managed roles removed, moderator's kept", JSON.stringify(state.members.get("7770000001")!.roles) === JSON.stringify([R_HAND]), state.members.get("7770000001")!.roles);

    // --- unpublish removes the post
    await db.update(events).set({ status: "draft" }).where(eq(events.id, eventId));
    r = await syncDiscordEvent(eventId);
    check("unpublish: post deleted", r.announcement === "deleted" && !state.messages.has(row3!.messageId!), r);

    // --- an event that happens, ends, and is archived a few days later
    const ev2 = `${eventId}-2`;
    await db.insert(events).values({ id: ev2, slug: ev2, title: "Discord Smoke Gig", venueName: "The Hall", startsAt: new Date(Date.now() + 3 * 86400e3), status: "published" });
    await db.insert(ticketTiers).values({ id: nanoid(12), eventId: ev2, name: "GA", priceCents: 30000, quantity: 50, perOrderLimit: 4 });
    await syncDiscordEvent(ev2);
    const g1 = await db.query.discordEventSync.findFirst({ where: eq(discordEventSync.eventId, ev2) });
    check("gig: price shows in the post", embedOf(state.messages.get(g1!.messageId!))!.fields.some((f) => f.name === "Tickets" && f.value.includes("300")), embedOf(state.messages.get(g1!.messageId!)));
    await db.update(events).set({ startsAt: new Date(Date.now() - 3600e3), endsAt: new Date(Date.now() + 2 * 3600e3) }).where(eq(events.id, ev2));
    await syncDiscordEvent(ev2);
    check("gig: started, so the Discord event is active", state.scheduled.get(g1!.scheduledEventId!)?.status === 2);
    check("gig: post says happening now", embedOf(state.messages.get(g1!.messageId!))!.footer.text.startsWith("Happening now"));
    await db.update(events).set({ startsAt: new Date(Date.now() - 5 * 3600e3), endsAt: new Date(Date.now() - 3600e3) }).where(eq(events.id, ev2));
    await syncDiscordEvent(ev2);
    const g2 = await db.query.discordEventSync.findFirst({ where: eq(discordEventSync.eventId, ev2) });
    check("gig: over, so the Discord event is completed", !g2!.scheduledEventId && state.scheduled.get(g1!.scheduledEventId!)?.status === 3);
    check("gig: post says ended, role kept for now", embedOf(state.messages.get(g1!.messageId!))!.footer.text.startsWith("Ended") && !!g2!.roleId && !g2!.archivedAt);
    await db.update(events).set({ startsAt: new Date(Date.now() - 5 * 86400e3), endsAt: new Date(Date.now() - 4 * 86400e3) }).where(eq(events.id, ev2));
    await runDiscordCron();
    const g3 = await db.query.discordEventSync.findFirst({ where: eq(discordEventSync.eventId, ev2) });
    check("gig: cron archives it three days after", !!g3!.archivedAt && !g3!.roleId && !state.roles.has(g1!.roleId!));
    await db.delete(events).where(eq(events.id, ev2));

    // --- errors come back as values
    const bad = await discordApi("GET", "/nothing/here");
    check("client: errors are returned, not thrown", !bad.ok && bad.status === 404);
  } finally {
    // tickets reference tiers with ON DELETE RESTRICT, so clear bookings before the event
    const bIds = (await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.eventId, eventId))).map((b) => b.id);
    if (bIds.length) {
      await db.delete(tickets).where(inArray(tickets.bookingId, bIds));
      await db.delete(bookingItems).where(inArray(bookingItems.bookingId, bIds));
      await db.delete(bookings).where(inArray(bookings.id, bIds));
    }
    await db.delete(events).where(inArray(events.id, [eventId, `${eventId}-2`]));
    await db.delete(users).where(inArray(users.id, [userA, userB]));
    // The cron touched the real local events too: drop the fake Discord ids it stored for them
    await db.delete(discordEventSync).where(syncedBefore.length ? notInArray(discordEventSync.eventId, syncedBefore) : sql`true`);
    if (before) await db.update(appSettings).set({ value: before.value }).where(eq(appSettings.key, "discord"));
    else await db.delete(appSettings).where(eq(appSettings.key, "discord"));
    server.close();
  }
  process.exit(process.exitCode ?? 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
