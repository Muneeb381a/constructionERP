CREATE TABLE "daily_closings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"closing_date" date NOT NULL,
	"sales_total" numeric(14, 2) NOT NULL,
	"purchases_total" numeric(14, 2) NOT NULL,
	"cash_collected" numeric(14, 2) NOT NULL,
	"bank_collected" numeric(14, 2) NOT NULL,
	"cheque_collected" numeric(14, 2) NOT NULL,
	"expenses_total" numeric(14, 2) NOT NULL,
	"expected_cash" numeric(14, 2) NOT NULL,
	"counted_cash" numeric(14, 2) NOT NULL,
	"discrepancy" numeric(14, 2) NOT NULL,
	"notes" text,
	"closed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "daily_closings" ADD CONSTRAINT "daily_closings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_closings" ADD CONSTRAINT "daily_closings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_closings" ADD CONSTRAINT "daily_closings_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_closings_branch_date_idx" ON "daily_closings" USING btree ("branch_id","closing_date");