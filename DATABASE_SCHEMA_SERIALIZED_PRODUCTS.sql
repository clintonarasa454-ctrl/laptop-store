/**
 * Database Schema Migration Guide
 * Serialized Inventory System for High-Value Products (e.g., Laptops)
 * 
 * This migration adds support for tracking individual units with serial numbers
 * while maintaining bulk inventory for non-serialized items.
 */

-- ═════════════════════════════════════════════════════════════════════════
-- STEP 1: Extend the existing 'products' table
-- ═════════════════════════════════════════════════════════════════════════

-- Add this column to track if a product has serialized units
ALTER TABLE products
ADD COLUMN has_serial BOOLEAN DEFAULT FALSE;

-- Add index for faster lookups
CREATE INDEX idx_products_has_serial ON products(has_serial);

-- ═════════════════════════════════════════════════════════════════════════
-- STEP 2: Create 'product_units' table for serialized items
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE product_units (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  serial_number VARCHAR(255) NOT NULL UNIQUE,
  imei VARCHAR(255),  -- For mobile devices, optional
  barcode VARCHAR(255),  -- UPC/EAN barcode, optional
  status VARCHAR(50) NOT NULL DEFAULT 'IN_STOCK', 
    -- Possible values: IN_STOCK, RESERVED, OUT_FOR_DELIVERY, SOLD, RETURNED, DAMAGED
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Tracking
  sold_at TIMESTAMP,
  sold_to_order_id INTEGER REFERENCES orders(id),  -- Link to order when sold
  notes TEXT  -- Any notes about the unit (e.g., "refurbished", "open box")
);

-- Indexes for fast lookups
CREATE INDEX idx_product_units_product_id ON product_units(product_id);
CREATE INDEX idx_product_units_serial ON product_units(serial_number);
CREATE INDEX idx_product_units_status ON product_units(status);
CREATE INDEX idx_product_units_barcode ON product_units(barcode);

-- ═════════════════════════════════════════════════════════════════════════
-- STEP 3: Update 'products' table stock column behavior
-- ═════════════════════════════════════════════════════════════════════════

-- The 'stock' column in products should work as follows:
-- 
-- For serialized products (has_serial = TRUE):
--   stock = COUNT(product_units WHERE status = 'IN_STOCK')
--   This is CALCULATED, not stored manually
--
-- For non-serialized products (has_serial = FALSE):
--   stock = manually set quantity
--   Works like before

-- Alternative: Store calculated stock in a separate column
-- ALTER TABLE products ADD COLUMN calculated_stock INTEGER;
-- CREATE TRIGGER update_product_stock AFTER INSERT/UPDATE/DELETE ON product_units
-- BEGIN UPDATE products SET calculated_stock = (SELECT COUNT(*) FROM product_units 
--   WHERE product_id = products.id AND status = 'IN_STOCK') WHERE id = ...
-- END;

-- ═════════════════════════════════════════════════════════════════════════
-- STEP 4: Create 'inventory_transactions' table for audit trail
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE inventory_transactions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_id INTEGER REFERENCES product_units(id) ON DELETE SET NULL,
  transaction_type VARCHAR(50) NOT NULL,
    -- Possible: RECEIVED, SOLD, DAMAGED, RETURNED, ADJUSTED, TRANSFERRED
  quantity_change INTEGER,  -- -1 for sold, +1 for received, etc.
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  reason TEXT,
  order_id INTEGER REFERENCES orders(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_transactions_product ON inventory_transactions(product_id);
CREATE INDEX idx_inventory_transactions_unit ON inventory_transactions(unit_id);
CREATE INDEX idx_inventory_transactions_order ON inventory_transactions(order_id);

-- ═════════════════════════════════════════════════════════════════════════
-- STEP 5: Optional - Create 'inventory_batches' for bulk imports
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE inventory_batches (
  id SERIAL PRIMARY KEY,
  batch_name VARCHAR(255) NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_count INTEGER NOT NULL,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  imported_by INTEGER REFERENCES users(id),
  notes TEXT
);

-- ═════════════════════════════════════════════════════════════════════════
-- EXAMPLE DATA: Setting up a serialized product
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Mark product as having serials
UPDATE products
SET has_serial = TRUE
WHERE name = 'Dell XPS 13 Laptop';

-- 2. Add individual units
INSERT INTO product_units (product_id, serial_number, barcode, status)
SELECT id, 'DEL-XPS-SN-001', 'UPC123456789', 'IN_STOCK'
FROM products WHERE name = 'Dell XPS 13 Laptop'
UNION ALL SELECT id, 'DEL-XPS-SN-002', 'UPC123456790', 'IN_STOCK'
FROM products WHERE name = 'Dell XPS 13 Laptop'
UNION ALL SELECT id, 'DEL-XPS-SN-003', 'UPC123456791', 'IN_STOCK'
FROM products WHERE name = 'Dell XPS 13 Laptop';

-- 3. Query current stock
SELECT 
  p.id,
  p.name,
  p.has_serial,
  CASE 
    WHEN p.has_serial THEN (SELECT COUNT(*) FROM product_units WHERE product_id = p.id AND status = 'IN_STOCK')
    ELSE p.stock
  END as available_stock
FROM products p
WHERE p.name = 'Dell XPS 13 Laptop';

-- ═════════════════════════════════════════════════════════════════════════
-- EXAMPLE: Handling a Sale
-- ═════════════════════════════════════════════════════════════════════════

-- When customer orders a serialized product:
BEGIN TRANSACTION;

-- 1. Find an available unit
SELECT id FROM product_units
WHERE product_id = 1 AND status = 'IN_STOCK'
LIMIT 1;  -- Returns: 101

-- 2. Reserve it
UPDATE product_units
SET status = 'RESERVED', updated_at = NOW()
WHERE id = 101;

-- 3. Create transaction record
INSERT INTO inventory_transactions 
(product_id, unit_id, transaction_type, from_status, to_status, order_id, created_by)
VALUES
(1, 101, 'RESERVED', 'IN_STOCK', 'RESERVED', 5000, 1);

-- 4. When order is shipped:
UPDATE product_units
SET status = 'OUT_FOR_DELIVERY', updated_at = NOW()
WHERE id = 101;

-- 5. When delivered (update to SOLD):
UPDATE product_units
SET status = 'SOLD', sold_at = NOW(), sold_to_order_id = 5000, updated_at = NOW()
WHERE id = 101;

-- 6. Record final transaction
INSERT INTO inventory_transactions
(product_id, unit_id, transaction_type, from_status, to_status, order_id)
VALUES
(1, 101, 'SOLD', 'OUT_FOR_DELIVERY', 'SOLD', 5000);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════
-- EXAMPLE: Bulk Inventory (Non-Serialized Products)
-- ═════════════════════════════════════════════════════════════════════════

-- For items like cables, mouse pads, etc., keep it simple:

-- 1. Product with no serial tracking
INSERT INTO products (name, has_serial, stock, ...)
VALUES ('USB-C Cable 2m', FALSE, 150, ...);

-- 2. When customer orders (reduce stock):
UPDATE products SET stock = stock - 1
WHERE id = 2 AND stock > 0;

-- 3. When restocking:
UPDATE products SET stock = stock + 50
WHERE id = 2;

-- ═════════════════════════════════════════════════════════════════════════
-- API LOGIC: getProductStock
-- ═════════════════════════════════════════════════════════════════════════

-- TypeScript function to get accurate stock:
/*
async function getProductStock(productId: number): Promise<number> {
  const product = await db.select().from(products).where(eq(products.id, productId));
  
  if (!product[0]) throw new Error("Product not found");
  
  if (product[0].has_serial) {
    // Count IN_STOCK units
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(product_units)
      .where(
        and(
          eq(product_units.product_id, productId),
          eq(product_units.status, "IN_STOCK")
        )
      );
    return result[0]?.count || 0;
  } else {
    // Return stored stock
    return product[0].stock;
  }
}
*/

-- ═════════════════════════════════════════════════════════════════════════
-- SCANNER INTEGRATION: When admin scans a barcode
-- ═════════════════════════════════════════════════════════════════════════

-- Query when a barcode is scanned:
SELECT 
  pu.id,
  pu.serial_number,
  pu.barcode,
  pu.status,
  p.name,
  p.sku,
  p.price
FROM product_units pu
JOIN products p ON pu.product_id = p.id
WHERE pu.barcode = 'UPC123456789' OR pu.serial_number = 'DEL-XPS-SN-001';

-- Result helps determine:
-- 1. Is this unit already sold? (status = 'SOLD')
-- 2. Is it reserved? (status = 'RESERVED')
-- 3. Can it be dispatched? (status = 'IN_STOCK')

-- ═════════════════════════════════════════════════════════════════════════
-- REPORTING: Stock Levels by Status
-- ═════════════════════════════════════════════════════════════════════════

SELECT
  p.name,
  p.brand,
  p.price,
  COUNT(CASE WHEN pu.status = 'IN_STOCK' THEN 1 END) as in_stock,
  COUNT(CASE WHEN pu.status = 'RESERVED' THEN 1 END) as reserved,
  COUNT(CASE WHEN pu.status = 'OUT_FOR_DELIVERY' THEN 1 END) as in_transit,
  COUNT(CASE WHEN pu.status = 'SOLD' THEN 1 END) as sold,
  COUNT(CASE WHEN pu.status = 'DAMAGED' THEN 1 END) as damaged,
  COUNT(*) as total_units
FROM products p
LEFT JOIN product_units pu ON p.id = pu.product_id
WHERE p.has_serial = TRUE
GROUP BY p.id, p.name, p.brand, p.price
ORDER BY in_stock DESC;

-- ═════════════════════════════════════════════════════════════════════════
-- DRIZZLE ORM: TypeScript Schema Definition
-- ═════════════════════════════════════════════════════════════════════════

/*
import { pgTable, serial, varchar, integer, boolean, timestamp, text, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const productUnits = pgTable(
  "product_units",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    serialNumber: varchar("serial_number", { length: 255 }).notNull().unique(),
    imei: varchar("imei", { length: 255 }),
    barcode: varchar("barcode", { length: 255 }),
    status: varchar("status", { length: 50 }).default("IN_STOCK").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    soldAt: timestamp("sold_at"),
    soldToOrderId: integer("sold_to_order_id").references(() => orders.id),
    notes: text("notes"),
  },
  (table) => ({
    productIdIdx: uniqueIndex("idx_product_units_product_id").on(table.productId),
    serialIdx: uniqueIndex("idx_product_units_serial").on(table.serialNumber),
    statusIdx: uniqueIndex("idx_product_units_status").on(table.status),
    barcodeIdx: uniqueIndex("idx_product_units_barcode").on(table.barcode),
  })
);

export type ProductUnit = typeof productUnits.$inferSelect;
export type NewProductUnit = typeof productUnits.$inferInsert;
*/

-- ═════════════════════════════════════════════════════════════════════════
-- MIGRATION CHECKLIST
-- ═════════════════════════════════════════════════════════════════════════

-- [ ] Run ALTER TABLE products ADD COLUMN has_serial
-- [ ] Create product_units table
-- [ ] Create inventory_transactions table  
-- [ ] Create inventory_batches table (optional)
-- [ ] Update tRPC procedure: products.get to return stock calculation
-- [ ] Add new tRPC procedure: admin.createProductUnits (bulk import)
-- [ ] Add new tRPC procedure: admin.scanProductUnit (handle scan events)
-- [ ] Update checkout logic to reserve/sell product_units
-- [ ] Update driver delivery logic to update unit status
-- [ ] Add admin UI to view/manage product units
-- [ ] Create reports page showing stock by status
-- [ ] Test end-to-end: scan → reserve → deliver → mark sold
-- [ ] Train admins on new serial tracking workflow

-- ═════════════════════════════════════════════════════════════════════════
