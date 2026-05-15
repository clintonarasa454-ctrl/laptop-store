/**
 * Backend Implementation Guide: Serialized Product Tracking
 * 
 * This document outlines the tRPC procedures and business logic needed
 * to support inventory tracking for high-value serialized products.
 * 
 * Flow:
 * 1. Admin adds product (marks as serialized)
 * 2. Admin scans/enters individual unit serial numbers
 * 3. Customer orders product
 * 4. System reserves a specific unit
 * 5. Driver receives shipment and tracks unit
 * 6. Unit marked as delivered/sold
 */

// ═════════════════════════════════════════════════════════════════════════
// PART 1: NEW TRPC PROCEDURES
// ═════════════════════════════════════════════════════════════════════════

/*
File: server/routers.ts - Add these procedures to the admin router
*/

// Procedure 1: Create Product Units (Bulk Import)
// Called when admin scans multiple units or imports batch
admin.createProductUnits: publicProcedure
  .input(z.object({
    productId: z.number(),
    units: z.array(z.object({
      serialNumber: z.string().min(1),
      imei: z.string().optional(),
      barcode: z.string().optional(),
      notes: z.string().optional(),
    })).min(1).max(100), // Prevent DOS
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. Verify product exists
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);
    
    if (!product.length) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    }

    // 2. Check for duplicates (serial numbers must be unique)
    const serialNumbers = input.units.map(u => u.serialNumber);
    const existing = await db
      .select({ serialNumber: productUnits.serialNumber })
      .from(productUnits)
      .where(inArray(productUnits.serialNumber, serialNumbers));

    if (existing.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Duplicate serial numbers: ${existing.map(e => e.serialNumber).join(", ")}`
      });
    }

    // 3. Insert units
    const newUnits = await db
      .insert(productUnits)
      .values(input.units.map(u => ({
        productId: input.productId,
        serialNumber: u.serialNumber,
        imei: u.imei,
        barcode: u.barcode,
        notes: u.notes,
        status: "IN_STOCK",
      })))
      .returning();

    // 4. Update product has_serial flag if not already set
    if (!product[0].hasSerial) {
      await db
        .update(products)
        .set({ hasSerial: true })
        .where(eq(products.id, input.productId));
    }

    // 5. Log transaction
    await logInventoryTransaction({
      productId: input.productId,
      transactionType: "RECEIVED",
      quantityChange: input.units.length,
      reason: `Bulk import: ${input.units.length} units`,
    });

    return { success: true, count: newUnits.length };
  }),


// Procedure 2: Scan and Lookup Product Unit
// Called when admin/driver scans a barcode/QR code
admin.scanProductUnit: publicProcedure
  .input(z.object({
    code: z.string().min(1).max(255),
  }))
  .query(async ({ input }) => {
    // Search by serial number or barcode
    const unit = await db
      .select({
        id: productUnits.id,
        serialNumber: productUnits.serialNumber,
        imei: productUnits.imei,
        barcode: productUnits.barcode,
        status: productUnits.status,
        productId: productUnits.productId,
        productName: products.name,
        productPrice: products.price,
        productBrand: products.brand,
        notes: productUnits.notes,
      })
      .from(productUnits)
      .innerJoin(products, eq(productUnits.productId, products.id))
      .where(
        or(
          eq(productUnits.serialNumber, input.code),
          eq(productUnits.barcode, input.code),
          eq(productUnits.imei, input.code)
        )
      )
      .limit(1);

    if (!unit.length) {
      return { found: false, message: "No matching product unit found" };
    }

    return {
      found: true,
      unit: unit[0],
      available: unit[0].status === "IN_STOCK",
    };
  }),


// Procedure 3: Get Product Stock (Works for both serialized and bulk)
products.getStock: publicProcedure
  .input(z.object({ productId: z.number() }))
  .query(async ({ input }) => {
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);

    if (!product.length) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    }

    if (product[0].hasSerial) {
      // Count IN_STOCK units
      const result = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(productUnits)
        .where(
          and(
            eq(productUnits.productId, input.productId),
            eq(productUnits.status, "IN_STOCK")
          )
        );
      
      return {
        stock: result[0]?.count || 0,
        isSerialized: true,
        availableUnits: result[0]?.count || 0,
      };
    } else {
      // Return stored stock
      return {
        stock: product[0].stock,
        isSerialized: false,
      };
    }
  }),


// Procedure 4: Reserve Unit for Order (Called during checkout)
orders.reserveProductUnit: publicProcedure
  .input(z.object({
    productId: z.number(),
    quantity: z.number().min(1),
  }))
  .mutation(async ({ input }) => {
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);

    if (!product.length) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    }

    if (!product[0].hasSerial) {
      // For non-serialized, just check stock
      if (product[0].stock < input.quantity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient stock. Available: ${product[0].stock}`,
        });
      }
      return { success: true, reserved: true, isSerialized: false };
    }

    // For serialized: find available units
    const availableUnits = await db
      .select()
      .from(productUnits)
      .where(
        and(
          eq(productUnits.productId, input.productId),
          eq(productUnits.status, "IN_STOCK")
        )
      )
      .limit(input.quantity);

    if (availableUnits.length < input.quantity) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Insufficient stock. Available: ${availableUnits.length}, Requested: ${input.quantity}`,
      });
    }

    // Reserve units
    const unitIds = availableUnits.map(u => u.id);
    const reserved = await db
      .update(productUnits)
      .set({ status: "RESERVED", updatedAt: new Date() })
      .where(inArray(productUnits.id, unitIds))
      .returning();

    return {
      success: true,
      reserved: true,
      isSerialized: true,
      unitIds: reserved.map(u => u.id),
      serialNumbers: reserved.map(u => u.serialNumber),
    };
  }),


// Procedure 5: Update Unit Status (for driver shipment tracking)
admin.updateUnitStatus: publicProcedure
  .input(z.object({
    unitId: z.number(),
    newStatus: z.enum(["IN_STOCK", "RESERVED", "OUT_FOR_DELIVERY", "SOLD", "RETURNED", "DAMAGED"]),
    orderId: z.number().optional(),
    notes: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    // Verify unit exists
    const unit = await db
      .select()
      .from(productUnits)
      .where(eq(productUnits.id, input.unitId))
      .limit(1);

    if (!unit.length) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Unit not found" });
    }

    const oldStatus = unit[0].status;

    // Update unit
    const updated = await db
      .update(productUnits)
      .set({
        status: input.newStatus,
        soldToOrderId: input.orderId || null,
        soldAt: input.newStatus === "SOLD" ? new Date() : null,
        notes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(productUnits.id, input.unitId))
      .returning();

    // Log transaction
    await logInventoryTransaction({
      productId: unit[0].productId,
      unitId: input.unitId,
      transactionType: 
        input.newStatus === "SOLD" ? "SOLD" :
        input.newStatus === "RETURNED" ? "RETURNED" :
        input.newStatus === "DAMAGED" ? "DAMAGED" : "ADJUSTED",
      fromStatus: oldStatus,
      toStatus: input.newStatus,
      orderId: input.orderId,
      reason: input.notes,
    });

    return { success: true, updated: updated[0] };
  }),


// Procedure 6: Get Inventory Report
admin.getInventoryReport: publicProcedure
  .query(async () => {
    // Get all serialized products with unit counts by status
    const report = await db
      .select({
        productId: products.id,
        productName: products.name,
        brand: products.brand,
        price: products.price,
        inStock: sql<number>`COUNT(CASE WHEN ${productUnits.status} = 'IN_STOCK' THEN 1 END)`,
        reserved: sql<number>`COUNT(CASE WHEN ${productUnits.status} = 'RESERVED' THEN 1 END)`,
        inTransit: sql<number>`COUNT(CASE WHEN ${productUnits.status} = 'OUT_FOR_DELIVERY' THEN 1 END)`,
        sold: sql<number>`COUNT(CASE WHEN ${productUnits.status} = 'SOLD' THEN 1 END)`,
        damaged: sql<number>`COUNT(CASE WHEN ${productUnits.status} = 'DAMAGED' THEN 1 END)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(products)
      .leftJoin(productUnits, eq(products.id, productUnits.productId))
      .where(eq(products.hasSerial, true))
      .groupBy(products.id, products.name, products.brand, products.price)
      .orderBy(desc(sql`COUNT(*)`));

    return report;
  }),

// ═════════════════════════════════════════════════════════════════════════
// PART 2: HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════

/*
File: server/_core/inventory.ts (new file)
*/

import { db } from "@/server/db";
import { inventoryTransactions } from "@/drizzle/schema";

interface LogTransactionInput {
  productId: number;
  unitId?: number;
  transactionType: "RECEIVED" | "SOLD" | "DAMAGED" | "RETURNED" | "ADJUSTED" | "RESERVED";
  quantityChange?: number;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
  orderId?: number;
  createdBy?: number;
}

export async function logInventoryTransaction(input: LogTransactionInput) {
  return db
    .insert(inventoryTransactions)
    .values({
      productId: input.productId,
      unitId: input.unitId,
      transactionType: input.transactionType,
      quantityChange: input.quantityChange,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reason: input.reason,
      orderId: input.orderId,
      createdBy: input.createdBy,
    });
}

export async function getProductStock(productId: number): Promise<number> {
  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product.length) throw new Error("Product not found");

  if (product[0].hasSerial) {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(productUnits)
      .where(
        and(
          eq(productUnits.productId, productId),
          eq(productUnits.status, "IN_STOCK")
        )
      );
    return result[0]?.count || 0;
  } else {
    return product[0].stock;
  }
}

// ═════════════════════════════════════════════════════════════════════════
// PART 3: SCHEMA UPDATES (Drizzle ORM)
// ═════════════════════════════════════════════════════════════════════════

/*
File: drizzle/schema.ts - Add these table definitions
*/

import { pgTable, serial, varchar, integer, boolean, timestamp, text, uniqueIndex, index } from "drizzle-orm/pg-core";
import { products, orders, users } from "./schema"; // existing tables

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
    productIdIdx: index("idx_product_units_product_id").on(table.productId),
    serialIdx: index("idx_product_units_serial").on(table.serialNumber),
    statusIdx: index("idx_product_units_status").on(table.status),
    barcodeIdx: index("idx_product_units_barcode").on(table.barcode),
    imeiIdx: index("idx_product_units_imei").on(table.imei),
  })
);

export const inventoryTransactions = pgTable(
  "inventory_transactions",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    unitId: integer("unit_id").references(() => productUnits.id, { onDelete: "set null" }),
    transactionType: varchar("transaction_type", { length: 50 }).notNull(),
    quantityChange: integer("quantity_change"),
    fromStatus: varchar("from_status", { length: 50 }),
    toStatus: varchar("to_status", { length: 50 }),
    reason: text("reason"),
    orderId: integer("order_id").references(() => orders.id),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    productIdIdx: index("idx_inventory_transactions_product").on(table.productId),
    unitIdIdx: index("idx_inventory_transactions_unit").on(table.unitId),
    orderIdIdx: index("idx_inventory_transactions_order").on(table.orderId),
    typeIdx: index("idx_inventory_transactions_type").on(table.transactionType),
  })
);

export type ProductUnit = typeof productUnits.$inferSelect;
export type NewProductUnit = typeof productUnits.$inferInsert;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type NewInventoryTransaction = typeof inventoryTransactions.$inferInsert;

// ═════════════════════════════════════════════════════════════════════════
// PART 4: INTEGRATION WITH EXISTING FLOWS
// ═════════════════════════════════════════════════════════════════════════

/*
File: server/routers.ts

When processing checkout/order creation, replace this:
*/

// OLD: Simple stock check
const product = await getProduct(input.productId);
if (product.stock < quantity) {
  throw new Error("Out of stock");
}

// NEW: Handle both serialized and bulk
if (product.hasSerial) {
  const result = await reserveProductUnits(input.productId, quantity);
  if (!result.success) throw new Error(result.error);
  // Store unitIds in order record for tracking
  order.reservedUnitIds = result.unitIds;
} else {
  if (product.stock < quantity) {
    throw new Error("Out of stock");
  }
  await db
    .update(products)
    .set({ stock: sql`${products.stock} - ${quantity}` })
    .where(eq(products.id, input.productId));
}

// ═════════════════════════════════════════════════════════════════════════
// PART 5: TESTING
// ═════════════════════════════════════════════════════════════════════════

/*
Test Cases:

1. Bulk Import Units
   - Admin adds 10 units of Dell XPS 13
   - System creates 10 product_units rows
   - Product.hasSerial = true
   - Expected: All units IN_STOCK

2. Scan Unit
   - Admin scans barcode "UPC123456789"
   - System finds matching unit
   - Returns: unit details, status, product info
   - Expected: found = true, available = true

3. Checkout with Serialized Product
   - Customer adds Dell XPS 13 to cart
   - Checkout calls reserveProductUnits
   - System reserves 1 IN_STOCK unit → RESERVED
   - Expected: Order has unitId = 101

4. Driver Updates Shipment
   - Driver scans unit serial number
   - Updates status: RESERVED → OUT_FOR_DELIVERY
   - Transaction logged
   - Expected: Unit.status = OUT_FOR_DELIVERY, updated_at = NOW

5. Mark as Sold
   - Driver delivers unit
   - Updates status: OUT_FOR_DELIVERY → SOLD
   - Sets soldAt, soldToOrderId
   - Expected: Unit.status = SOLD, Unit.soldAt = NOW

6. Stock Report
   - Query inventory report
   - Returns count by status for all serialized products
   - Expected: JSON with in_stock, reserved, in_transit, sold counts
*/

// ═════════════════════════════════════════════════════════════════════════
// PART 6: DEPLOYMENT CHECKLIST
// ═════════════════════════════════════════════════════════════════════════

// [ ] Run database migration to add has_serial column to products
// [ ] Create product_units table migration
// [ ] Create inventory_transactions table migration
// [ ] Add schema definitions to drizzle/schema.ts
// [ ] Add helper functions to server/_core/inventory.ts
// [ ] Add tRPC procedures to server/routers.ts
// [ ] Update checkout flow to reserve serialized units
// [ ] Test barcode scanning integration
// [ ] Add admin UI for bulk importing units
// [ ] Add admin UI for inventory reports
// [ ] Train admin on serial number tracking workflow
// [ ] Monitor inventory_transactions for audit trail
// [ ] Set up alerts for low stock (IN_STOCK < threshold)

console.log("✅ Database schema and API ready for serialized inventory tracking");
