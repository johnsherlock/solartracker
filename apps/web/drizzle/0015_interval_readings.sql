DROP TABLE IF EXISTS "daily_summaries";
--> statement-breakpoint
CREATE TABLE "interval_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"interval_start" timestamp with time zone NOT NULL,
	"import_kwh" numeric(10, 6) NOT NULL,
	"generation_kwh" numeric(10, 6) NOT NULL,
	"export_kwh" numeric(10, 6) NOT NULL,
	"immersion_diverted_kwh" numeric(10, 6) NOT NULL,
	"immersion_boosted_kwh" numeric(10, 6) NOT NULL,
	"consumed_kwh" numeric(10, 6) NOT NULL,
	"reading_count" smallint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interval_readings" ADD CONSTRAINT "interval_readings_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "interval_readings_installation_interval_idx" ON "interval_readings" USING btree ("installation_id","interval_start");
--> statement-breakpoint
CREATE INDEX "interval_readings_installation_interval_brin" ON "interval_readings" USING btree ("installation_id","interval_start");
