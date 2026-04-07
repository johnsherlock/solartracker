ALTER TABLE "daily_summaries" ADD COLUMN "day_import_kwh" numeric(14, 6);--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD COLUMN "night_import_kwh" numeric(14, 6);--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD COLUMN "peak_import_kwh" numeric(14, 6);--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD COLUMN "free_import_kwh" numeric(14, 6);