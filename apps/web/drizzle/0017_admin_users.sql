CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_username_idx" ON "admin_users" USING btree ("username");
--> statement-breakpoint
-- Clean break: existing approved_by values pointed to users.id under the old model.
-- For beta, we reset them to null and re-record provenance going forward via admin_users.
UPDATE "users" SET "approved_by" = NULL WHERE "approved_by" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_approved_by_admin_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
