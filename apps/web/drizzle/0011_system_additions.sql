CREATE TABLE "system_additions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"label" text NOT NULL,
	"addition_date" date NOT NULL,
	"capacity_added_kw" numeric(8, 2),
	"upfront_payment" numeric(12, 2),
	"monthly_repayment" numeric(12, 2),
	"repayment_duration_months" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_additions" ADD CONSTRAINT "system_additions_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "system_additions_installation_id_idx" ON "system_additions" USING btree ("installation_id");