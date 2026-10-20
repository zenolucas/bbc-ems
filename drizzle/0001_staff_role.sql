ALTER TYPE "public"."user_role" ADD VALUE 'staff' BEFORE 'admin';--> statement-breakpoint
CREATE TABLE "role_grants" (
	"email" text PRIMARY KEY NOT NULL,
	"role" "user_role" NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;