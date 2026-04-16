CREATE TABLE "tariff_price_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tariff_plan_version_id" uuid NOT NULL,
	"period_label" text NOT NULL,
	"rate_per_kwh" numeric(12, 6) NOT NULL,
	"is_free_import" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD COLUMN "band_breakdown_json" jsonb;--> statement-breakpoint
ALTER TABLE "tariff_plan_versions" ADD COLUMN "weekly_schedule_json" jsonb;--> statement-breakpoint
ALTER TABLE "tariff_price_periods" ADD CONSTRAINT "tariff_price_periods_tariff_plan_version_id_tariff_plan_versions_id_fk" FOREIGN KEY ("tariff_plan_version_id") REFERENCES "public"."tariff_plan_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tariff_price_periods_version_sort_idx" ON "tariff_price_periods" USING btree ("tariff_plan_version_id","sort_order");