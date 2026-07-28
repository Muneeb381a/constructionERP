ALTER TABLE "parties" ADD COLUMN "public_token" uuid;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_public_token_unique" UNIQUE("public_token");