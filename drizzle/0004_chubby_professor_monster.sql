CREATE TYPE "public"."assignment_status" AS ENUM('active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."driver_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('available', 'assigned', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('car', 'motorcycle', 'truck');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"driver_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"returned_at" timestamp,
	"status" "assignment_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(320),
	"license_number" varchar(50),
	"status" "driver_status" DEFAULT 'active' NOT NULL,
	"pin" varchar(256) NOT NULL,
	CONSTRAINT "drivers_phone_unique" UNIQUE("phone"),
	CONSTRAINT "drivers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"number_plate" varchar(20) NOT NULL,
	"type" "vehicle_type" NOT NULL,
	"status" "vehicle_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_number_plate_unique" UNIQUE("number_plate")
);
--> statement-breakpoint
ALTER TABLE "delivery_agents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "delivery_agents" CASCADE;--> statement-breakpoint
DROP INDEX IF EXISTS "delivery_payouts_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "delivery_payouts_agent_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "settings_key_idx";--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "preferredBrands" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "preferredCategories" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "viewCount" integer DEFAULT 0;--> statement-breakpoint
UPDATE "orders" SET "delivery_agent_id" = NULL;--> statement-breakpoint
DELETE FROM "delivery_payouts";--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_payouts" ADD CONSTRAINT "delivery_payouts_agentId_drivers_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_agent_id_drivers_id_fk" FOREIGN KEY ("delivery_agent_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_conversations_created_at_idx" ON "ai_conversations" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "ai_conversations_message_type_idx" ON "ai_conversations" USING btree ("messageType");--> statement-breakpoint
CREATE INDEX "product_views_user_id_idx" ON "product_views" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "product_views_viewed_at_idx" ON "product_views" USING btree ("viewedAt");--> statement-breakpoint
CREATE INDEX "products_tags_gin_idx" ON "products" USING gin (("tags"::jsonb));--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("createdAt");--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_user_unique_idx" UNIQUE("productId","userId");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique_idx" UNIQUE("email");