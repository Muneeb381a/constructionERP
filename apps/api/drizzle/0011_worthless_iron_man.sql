ALTER TABLE "parties" ADD COLUMN "last_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "reminder_interval_days" integer DEFAULT 7;