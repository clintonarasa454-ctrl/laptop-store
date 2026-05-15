-- Add compound indexes for admin dashboard queries
CREATE INDEX IF NOT EXISTS "orders_payment_status_created_at_idx" ON "orders" ("paymentStatus", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "delivery_payouts_status_requested_idx" ON "delivery_payouts" ("status", "requestedAt" DESC);
--> statement-breakpoint
