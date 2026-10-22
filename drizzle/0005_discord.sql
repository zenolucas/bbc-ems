CREATE TABLE "discord_event_sync" (
	"event_id" text PRIMARY KEY NOT NULL,
	"message_id" text,
	"message_channel_id" text,
	"scheduled_event_id" text,
	"role_id" text,
	"channel_id" text,
	"wants_channel" boolean DEFAULT false NOT NULL,
	"last_state_hash" text,
	"scheduled_state_hash" text,
	"reminded_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_event_sync" ADD CONSTRAINT "discord_event_sync_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;