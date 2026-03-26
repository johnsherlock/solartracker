CREATE TABLE "daily_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"import_kwh" numeric(14, 6) DEFAULT '0' NOT NULL,
	"export_kwh" numeric(14, 6) DEFAULT '0' NOT NULL,
	"generated_kwh" numeric(14, 6) DEFAULT '0' NOT NULL,
	"consumed_kwh" numeric(14, 6),
	"immersion_diverted_kwh" numeric(14, 6),
	"immersion_boosted_kwh" numeric(14, 6),
	"self_consumption_ratio" numeric(8, 4),
	"grid_dependence_ratio" numeric(8, 4),
	"is_partial" boolean DEFAULT false NOT NULL,
	"rebuilt_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_health_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"provider_connection_id" uuid,
	"event_type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"summary" text NOT NULL,
	"details_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "installation_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"tariff_plan_id" uuid,
	"contract_start_date" date,
	"contract_end_date" date,
	"expected_review_date" date,
	"post_contract_default_behavior" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"locale" text DEFAULT 'en-IE' NOT NULL,
	"currency_code" text DEFAULT 'EUR' NOT NULL,
	"finance_mode" text,
	"install_cost_amount" numeric(12, 2),
	"monthly_finance_payment_amount" numeric(12, 2),
	"provider_type" text DEFAULT 'myenergi' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text NOT NULL,
	"installation_id" uuid,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"records_written" integer,
	"records_updated" integer,
	"error_summary" text,
	"metadata_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"provider_type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"credential_ref" text,
	"last_successful_sync_at" timestamp with time zone,
	"last_failed_sync_at" timestamp with time zone,
	"last_error_code" text,
	"last_error_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tariff_fixed_charge_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tariff_plan_version_id" uuid NOT NULL,
	"charge_type" text NOT NULL,
	"amount" numeric(12, 6) NOT NULL,
	"unit" text NOT NULL,
	"vat_inclusive" boolean DEFAULT false NOT NULL,
	"valid_from_local_date" date NOT NULL,
	"valid_to_local_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tariff_plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tariff_plan_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"valid_from_local_date" date NOT NULL,
	"valid_to_local_date" date,
	"day_rate" numeric(12, 6) NOT NULL,
	"night_rate" numeric(12, 6),
	"peak_rate" numeric(12, 6),
	"export_rate" numeric(12, 6),
	"vat_rate" numeric(8, 6),
	"discount_rule_type" text,
	"discount_value" numeric(12, 6),
	"night_start_local_time" time,
	"night_end_local_time" time,
	"peak_start_local_time" time,
	"peak_end_local_time" time,
	"free_import_rule_json" jsonb,
	"is_active_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tariff_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"plan_name" text NOT NULL,
	"product_code" text,
	"is_export_enabled" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_health_events" ADD CONSTRAINT "data_health_events_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_health_events" ADD CONSTRAINT "data_health_events_provider_connection_id_provider_connections_id_fk" FOREIGN KEY ("provider_connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installation_contracts" ADD CONSTRAINT "installation_contracts_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installation_contracts" ADD CONSTRAINT "installation_contracts_tariff_plan_id_tariff_plans_id_fk" FOREIGN KEY ("tariff_plan_id") REFERENCES "public"."tariff_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_fixed_charge_versions" ADD CONSTRAINT "tariff_fixed_charge_versions_tariff_plan_version_id_tariff_plan_versions_id_fk" FOREIGN KEY ("tariff_plan_version_id") REFERENCES "public"."tariff_plan_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_plan_versions" ADD CONSTRAINT "tariff_plan_versions_tariff_plan_id_tariff_plans_id_fk" FOREIGN KEY ("tariff_plan_id") REFERENCES "public"."tariff_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_plans" ADD CONSTRAINT "tariff_plans_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_summaries_installation_date_idx" ON "daily_summaries" USING btree ("installation_id","local_date");--> statement-breakpoint
CREATE INDEX "installations_user_id_idx" ON "installations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "provider_connections_installation_id_idx" ON "provider_connections" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "tariff_fixed_charge_versions_lookup_idx" ON "tariff_fixed_charge_versions" USING btree ("tariff_plan_version_id","charge_type","valid_from_local_date");--> statement-breakpoint
CREATE INDEX "tariff_plan_versions_plan_date_idx" ON "tariff_plan_versions" USING btree ("tariff_plan_id","valid_from_local_date");--> statement-breakpoint
CREATE INDEX "tariff_plans_installation_id_idx" ON "tariff_plans" USING btree ("installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_user_id_idx" ON "users" USING btree ("auth_user_id");