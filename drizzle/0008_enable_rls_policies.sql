-- Enable RLS on sensitive tables
-- Note: Access control is enforced at the application layer via TRPC context

-- Users table - RLS to protect personal information
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "users_deny_all" ON "users" FOR ALL USING (false);--> statement-breakpoint

-- Addresses table - RLS for personal address data
ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "addresses_deny_all" ON "addresses" FOR ALL USING (false);--> statement-breakpoint

-- Orders table - RLS for personal order data
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "orders_deny_all" ON "orders" FOR ALL USING (false);--> statement-breakpoint

-- Cart Items table - RLS for personal shopping data
ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "cart_items_deny_all" ON "cart_items" FOR ALL USING (false);--> statement-breakpoint

-- Payments table - RLS for sensitive payment data
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "payments_deny_all" ON "payments" FOR ALL USING (false);--> statement-breakpoint

-- Wishlists table - RLS for personal preferences
ALTER TABLE "wishlists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "wishlists_deny_all" ON "wishlists" FOR ALL USING (false);--> statement-breakpoint

-- Order Items table - RLS for order line items
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "order_items_deny_all" ON "order_items" FOR ALL USING (false);--> statement-breakpoint

-- Drivers table - RLS for driver protection
ALTER TABLE "drivers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "drivers_deny_all" ON "drivers" FOR ALL USING (false);--> statement-breakpoint

-- Reviews table - RLS to protect user reviews
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "reviews_public_read" ON "reviews" FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY "reviews_deny_insert" ON "reviews" FOR INSERT WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "reviews_deny_update" ON "reviews" FOR UPDATE USING (false);--> statement-breakpoint
CREATE POLICY "reviews_deny_delete" ON "reviews" FOR DELETE USING (false);--> statement-breakpoint

-- User Preferences table - RLS for personal preferences
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_preferences_deny_all" ON "user_preferences" FOR ALL USING (false);--> statement-breakpoint

-- Order Status History table - RLS for order history
ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "order_status_history_deny_all" ON "order_status_history" FOR ALL USING (false);--> statement-breakpoint

