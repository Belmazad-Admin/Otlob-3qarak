CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" bigint NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"ref" text DEFAULT '' NOT NULL,
	"hubspot_contact_id" text,
	"hubspot_deal_id" text,
	"summary_json" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"is_broker" boolean DEFAULT false NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"hubspot_contact_id" text,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"last_login_at" bigint,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "submissions_user" ON "submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "submissions_contact" ON "submissions" USING btree ("hubspot_contact_id");--> statement-breakpoint
CREATE INDEX "users_hubspot_contact" ON "users" USING btree ("hubspot_contact_id");