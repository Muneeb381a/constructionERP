ALTER TABLE "cash_book" ADD COLUMN "idempotency_key" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "idempotency_key" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_book_idempotency_idx" ON "cash_book" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_idempotency_idx" ON "expenses" USING btree ("idempotency_key");