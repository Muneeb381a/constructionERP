ALTER TABLE "invoices" ADD COLUMN "public_token" uuid;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "public_token" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_public_token_unique" UNIQUE("public_token");--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_public_token_unique" UNIQUE("public_token");