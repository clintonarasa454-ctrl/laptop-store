CREATE TYPE "public"."sender_type" AS ENUM('customer', 'driver', 'system');--> statement-breakpoint
CREATE TABLE "delivery_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"senderType" "sender_type" NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_messages" ADD CONSTRAINT "delivery_messages_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_messages_order_id_idx" ON "delivery_messages" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "delivery_messages_created_at_idx" ON "delivery_messages" USING btree ("createdAt");