-- Performance indexes for dashboard and analytics optimization
-- Time-series indexes for fast date range filtering
CREATE INDEX IF NOT EXISTS "idx_orders_created_at" ON "orders" USING btree ("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_orders_order_number" ON "orders" USING btree ("orderNumber");

-- Combined index for dashboard stats queries (status + payment_status filtering)
CREATE INDEX IF NOT EXISTS "idx_orders_status_payment" ON "orders" USING btree ("status","paymentStatus");

-- Page views analytics index
CREATE INDEX IF NOT EXISTS "idx_page_views_created_at" ON "page_views" USING btree ("createdAt");

-- Product performance indexes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_products_slug" ON "products" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "idx_products_active_featured" ON "products" USING btree ("active","featured");

-- User authentication indexes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email" ON "users" USING btree ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_open_id" ON "users" USING btree ("openId");
