CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"resource_id" varchar(255) NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_messages" ADD COLUMN "is_read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "driver_rating" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "driver_feedback" text;