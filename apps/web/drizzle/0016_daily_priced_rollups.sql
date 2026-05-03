CREATE TABLE "daily_priced_rollups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"tariff_version_id" uuid,
	"generated_kwh" numeric(10, 6) NOT NULL,
	"import_kwh" numeric(10, 6) NOT NULL,
	"export_kwh" numeric(10, 6) NOT NULL,
	"consumed_kwh" numeric(10, 6) NOT NULL,
	"immersion_diverted_kwh" numeric(10, 6) NOT NULL,
	"total_reading_count" integer NOT NULL,
	"slot_count" smallint NOT NULL,
	"is_partial" boolean NOT NULL,
	"import_cost" numeric(12, 6),
	"export_credit" numeric(12, 6),
	"self_consumed_solar_value" numeric(12, 6),
	"without_solar_import_cost" numeric(12, 6),
	"fixed_charges" numeric(12, 6),
	"free_import_kwh" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_priced_rollups" ADD CONSTRAINT "daily_priced_rollups_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_priced_rollups" ADD CONSTRAINT "daily_priced_rollups_tariff_version_id_tariff_plan_versions_id_fk" FOREIGN KEY ("tariff_version_id") REFERENCES "public"."tariff_plan_versions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_priced_rollups_installation_date_idx" ON "daily_priced_rollups" USING btree ("installation_id","local_date");
