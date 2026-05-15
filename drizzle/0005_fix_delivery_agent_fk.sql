-- Drop the old foreign key constraint
ALTER TABLE "orders" DROP CONSTRAINT "orders_delivery_agent_id_delivery_agents_id_fk";
--> statement-breakpoint

-- Add the new foreign key constraint pointing to drivers table
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_agent_id_drivers_id_fk" FOREIGN KEY ("delivery_agent_id") REFERENCES "public"."drivers"("id") ON DELETE set null;
--> statement-breakpoint

-- Drop the old delivery_payouts foreign key if it exists
ALTER TABLE "delivery_payouts" DROP CONSTRAINT "delivery_payouts_agentId_delivery_agents_id_fk";
--> statement-breakpoint

-- Add the new delivery_payouts foreign key pointing to drivers table
ALTER TABLE "delivery_payouts" ADD CONSTRAINT "delivery_payouts_agentId_drivers_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."drivers"("id") ON DELETE cascade;
