ALTER TABLE "installations" ADD COLUMN "location_raw_input" text;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "location_display_name" text;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "location_latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "location_longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "location_precision_mode" text;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "location_country_code" text;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "location_locality" text;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "location_geocoded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "location_geocoder_provider" text;