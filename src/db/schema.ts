import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------- enums ----------
export const userRole = pgEnum("user_role", ["member", "staff", "admin"]);
export const eventStatus = pgEnum("event_status", ["draft", "published", "cancelled", "ended"]);
export const bookingStatus = pgEnum("booking_status", [
  "pending_payment",
  "under_review",
  "approved",
  "rejected",
  "expired",
  "cancelled",
]);
export const eventCategory = pgEnum("event_category", ["gig", "outdoors", "other"]);
export const ticketStatus = pgEnum("ticket_status", ["valid", "used", "void"]);
export const checkinResult = pgEnum("checkin_result", ["ok", "duplicate", "invalid", "void"]);
export const ticketStyle = pgEnum("ticket_style", [
  "summit",
  "night-sky",
  "trail-pass",
  "ridge-line",
  "campfire-stamp",
]);

// ---------- better-auth tables ----------
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- domain ----------
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    tagline: text("tagline"),
    descriptionMd: text("description_md").notNull().default(""),
    venueName: text("venue_name").notNull(),
    venueAddress: text("venue_address"),
    mapUrl: text("map_url"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    coverImageUrl: text("cover_image_url"),
    status: eventStatus("status").notNull().default("draft"),
    ticketStyle: ticketStyle("ticket_style").notNull().default("summit"),
    /** Drives the home page filters (All / Gigs / Outdoors / Free); "Free" comes from the tiers. */
    category: eventCategory("category").notNull().default("other"),
    paymentInstructions: text("payment_instructions"),
    gcashName: text("gcash_name"),
    gcashNumber: text("gcash_number"),
    gcashQrUrl: text("gcash_qr_url"),
    bookingHoldHours: integer("booking_hold_hours").notNull().default(24),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_status_starts_idx").on(t.status, t.startsAt)],
);

export const ticketTiers = pgTable(
  "ticket_tiers",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull().default(0),
    quantity: integer("quantity").notNull(),
    perOrderLimit: integer("per_order_limit").notNull().default(4),
    salesStart: timestamp("sales_start", { withTimezone: true }),
    salesEnd: timestamp("sales_end", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("tiers_event_idx").on(t.eventId)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: bookingStatus("status").notNull().default("pending_payment"),
    totalCents: integer("total_cents").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    paymentRef: text("payment_ref"),
    paymentProofUrl: text("payment_proof_url"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bookings_event_status_idx").on(t.eventId, t.status),
    index("bookings_user_idx").on(t.userId),
  ],
);

export const bookingItems = pgTable(
  "booking_items",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    tierId: text("tier_id")
      .notNull()
      .references(() => ticketTiers.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
  },
  (t) => [index("booking_items_booking_idx").on(t.bookingId)],
);

export const tickets = pgTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    shortCode: text("short_code").notNull(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    tierId: text("tier_id")
      .notNull()
      .references(() => ticketTiers.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    holderName: text("holder_name").notNull().default(""),
    signature: text("signature").notNull(),
    status: ticketStatus("status").notNull().default("valid"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedInBy: text("checked_in_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tickets_short_code_idx").on(t.shortCode),
    index("tickets_event_idx").on(t.eventId),
    index("tickets_user_idx").on(t.userId),
  ],
);

export const checkins = pgTable(
  "checkins",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    scannerUserId: text("scanner_user_id").references(() => users.id, { onDelete: "set null" }),
    deviceId: text("device_id"),
    clientCheckinId: text("client_checkin_id"),
    rawPayload: text("raw_payload"),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    result: checkinResult("result").notNull(),
  },
  (t) => [
    index("checkins_event_idx").on(t.eventId),
    uniqueIndex("checkins_client_id_idx")
      .on(t.clientCheckinId)
      .where(sql`${t.clientCheckinId} is not null`),
  ],
);

/**
 * Access granted by email before (or after) someone signs up. Applied when the
 * account is created, so organisers can invite door volunteers ahead of time.
 */
export const roleGrants = pgTable("role_grants", {
  email: text("email").primaryKey(),
  role: userRole("role").notNull(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Expo push tokens, one per installed app. Deleted when Expo reports the device gone. */
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    platform: text("platform").notNull(),
    deviceId: text("device_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_tokens_user_idx").on(t.userId)],
);

/**
 * "Notify me" on sold-out events. The cron tells everyone waiting when seats free up
 * (first come, first served) and stamps notified_at; joining again clears it.
 */
export const waitlist = pgTable(
  "waitlist",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("waitlist_event_user_idx").on(t.eventId, t.userId)],
);

/** Reminders already sent, so the 15-minute cron sends each one once. */
export const notificationLog = pgTable(
  "notification_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    refId: text("ref_id").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("notification_log_once_idx").on(t.kind, t.refId, t.userId)],
);

// ---------- relations ----------
export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  tickets: many(tickets),
}));

export const eventsRelations = relations(events, ({ many, one }) => ({
  tiers: many(ticketTiers),
  bookings: many(bookings),
  tickets: many(tickets),
  creator: one(users, { fields: [events.createdBy], references: [users.id] }),
}));

export const ticketTiersRelations = relations(ticketTiers, ({ one, many }) => ({
  event: one(events, { fields: [ticketTiers.eventId], references: [events.id] }),
  items: many(bookingItems),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  event: one(events, { fields: [bookings.eventId], references: [events.id] }),
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  items: many(bookingItems),
  tickets: many(tickets),
}));

export const bookingItemsRelations = relations(bookingItems, ({ one }) => ({
  booking: one(bookings, { fields: [bookingItems.bookingId], references: [bookings.id] }),
  tier: one(ticketTiers, { fields: [bookingItems.tierId], references: [ticketTiers.id] }),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  booking: one(bookings, { fields: [tickets.bookingId], references: [bookings.id] }),
  event: one(events, { fields: [tickets.eventId], references: [events.id] }),
  tier: one(ticketTiers, { fields: [tickets.tierId], references: [ticketTiers.id] }),
  user: one(users, { fields: [tickets.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type TicketTier = typeof ticketTiers.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingItem = typeof bookingItems.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Checkin = typeof checkins.$inferSelect;
export type RoleGrant = typeof roleGrants.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];
export type TicketStyle = (typeof ticketStyle.enumValues)[number];
export const TICKET_STYLES = ticketStyle.enumValues;
export const EVENT_CATEGORIES = eventCategory.enumValues;
