import { getDb } from "./db-init";
import { eq, and, gte, lte, desc, sum } from "drizzle-orm";
import { products, productUnits, productInventory, warehouses, inventoryTransactions, orderItems, orders } from "../drizzle/schema";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────
// TIER 1: DELIVERY TIME ESTIMATION
// ─────────────────────────────────────────────────────────────────────────

export async function estimateDeliveryDays(
  productId: number,
  warehouseId: number
): Promise<number> {
  /**
   * Estimates delivery days based on:
   * - 1-2 days: Processing + warehouse packing
   * - 1-5 days: Shipping based on distance (approximated from warehouse coordinates)
   * Returns conservative estimate: 2-7 days
   */
  const db = await getDb();
  if (!db) return 5; // Default fallback

  try {
    const warehouse = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId)).limit(1);
    if (!warehouse || warehouse.length === 0) return 5;

    // For now, return fixed ranges. In production, integrate with shipping providers:
    // - Local/metro areas: 2-3 days
    // - Regional: 3-5 days
    // - Remote: 5-7 days
    
    return 3; // Conservative default
  } catch (e) {
    console.error("Error estimating delivery:", e);
    return 5;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TIER 1: INVENTORY DASHBOARD - STOCK HEATMAP BY WAREHOUSE
// ─────────────────────────────────────────────────────────────────────────

export interface StockHeatmapData {
  warehouseId: number;
  warehouseName: string;
  city: string;
  lat: number;
  lng: number;
  totalProductsActive: number;
  lowStockCount: number; // Products below threshold
  outOfStockCount: number;
  totalUnits: number;
  averageStockHealth: number; // 0-100 percentage
}

export async function getStockHeatmapByWarehouse(threshold: number = 20): Promise<StockHeatmapData[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const allWarehouses = await db.select().from(warehouses).where(eq(warehouses.active, true));
    const activeProducts = await db.select().from(products).where(eq(products.active, true));

    const heatmapData: StockHeatmapData[] = await Promise.all(
      allWarehouses.map(async (w) => {
        // 1. Get bulk (non-serialized) inventory
        const bulkInventory = await db
          .select({
            productId: productInventory.productId,
            count: productInventory.stock,
          })
          .from(productInventory)
          .where(eq(productInventory.warehouseId, w.id));

        // 2. Get serialized inventory
        const serialInventory = await db
          .select({
            productId: productUnits.productId,
            count: sql<number>`count(*)`.mapWith(Number),
          })
          .from(productUnits)
          .where(and(eq(productUnits.warehouseId, w.id), eq(productUnits.status, "IN_STOCK")))
          .groupBy(productUnits.productId);

        const inventoryMap = new Map<number, number>();
        for (const item of bulkInventory) inventoryMap.set(item.productId, item.count);
        for (const item of serialInventory) inventoryMap.set(item.productId, (inventoryMap.get(item.productId) || 0) + item.count);

        const warehouseInventory = Array.from(inventoryMap.entries()).map(([productId, count]) => ({ productId, count }));

        const lowStockProducts = activeProducts.filter((p) => {
          const count = inventoryMap.get(p.id) || 0;
          return count > 0 && count < threshold;
        });

        const outOfStockProducts = activeProducts.filter((p) => {
          const count = inventoryMap.get(p.id) || 0;
          return count === 0;
        });

        const totalUnits = warehouseInventory.reduce((sum, inv) => sum + inv.count, 0);
        const totalCapacity = activeProducts.length * 100; // Assume 100 units capacity per product
        const averageHealth = Math.round((totalUnits / totalCapacity) * 100);

        return {
          warehouseId: w.id,
          warehouseName: w.name,
          city: w.city,
          lat: parseFloat(w.lat as any),
          lng: parseFloat(w.lng as any),
          totalProductsActive: activeProducts.length,
          lowStockCount: lowStockProducts.length,
          outOfStockCount: outOfStockProducts.length,
          totalUnits,
          averageStockHealth: Math.min(averageHealth, 100),
        };
      })
    );

    return heatmapData;
  } catch (e) {
    console.error("Error fetching stock heatmap:", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TIER 1: STOCK VELOCITY TRENDS (FAST/SLOW MOVERS)
// ─────────────────────────────────────────────────────────────────────────

export interface StockVelocityTrend {
  productId: number;
  productName: string;
  sku: string;
  category: string;
  velocity7d: number; // Units sold in last 7 days
  velocity30d: number; // Units sold in last 30 days
  turnoverRate: number; // Times per year
  trend: "fast" | "moderate" | "slow";
  daysOfStock: number; // At current velocity
}

export async function getStockVelocityTrends(limit: number = 50): Promise<StockVelocityTrend[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get sales in last 7 and 30 days
    const sales7d = await db
      .select({
        productId: orderItems.productId,
        quantity: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(gte(orders.createdAt, sevenDaysAgo))
      .groupBy(orderItems.productId);

    const sales30d = await db
      .select({
        productId: orderItems.productId,
        quantity: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(gte(orders.createdAt, thirtyDaysAgo))
      .groupBy(orderItems.productId);

    const activeProducts = await db.select().from(products).where(eq(products.active, true)).limit(limit);

    return activeProducts.map((p) => {
      const v7 = sales7d.find((s) => s.productId === p.id)?.quantity || 0;
      const v30 = sales30d.find((s) => s.productId === p.id)?.quantity || 0;
      const currentStock = p.stock;
      const velocity = v7 / 7; // Units per day
      const daysOfStock = velocity > 0 ? Math.round(currentStock / velocity) : 9999;
      const turnoverRate = (v30 / 30) * 365; // Annualized

      let trend: "fast" | "moderate" | "slow" = "moderate";
      if (v7 > 20) trend = "fast";
      if (v7 < 5) trend = "slow";

      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku || "",
        category: "", // Would need category join
        velocity7d: v7,
        velocity30d: v30,
        turnoverRate: Math.round(turnoverRate),
        trend,
        daysOfStock,
      };
    });
  } catch (e) {
    console.error("Error calculating stock velocity:", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TIER 1: MULTI-WAREHOUSE TRANSFER OPTIMIZATION
// ─────────────────────────────────────────────────────────────────────────

export interface WarehouseImbalance {
  productId: number;
  productName: string;
  overstockedWarehouse: {
    id: number;
    name: string;
    city: string;
    stock: number;
  };
  understockedWarehouse: {
    id: number;
    name: string;
    city: string;
    stock: number;
  };
  suggestedTransferQty: number;
  reason: string;
  urgency: "critical" | "high" | "medium";
}

export async function getWarehouseImbalances(): Promise<WarehouseImbalance[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const allWarehouses = await db.select().from(warehouses).where(eq(warehouses.active, true));
    const activeProducts = await db.select().from(products).where(eq(products.active, true));
    const imbalances: WarehouseImbalance[] = [];

    for (const product of activeProducts) {
      const warehouseStocks = await Promise.all(
        allWarehouses.map(async (w) => {
          const serialCount = await db
            .select({ total: sql<number>`count(*)`.mapWith(Number) })
            .from(productUnits)
            .where(
              and(
                eq(productUnits.productId, product.id),
                eq(productUnits.warehouseId, w.id),
                eq(productUnits.status, "IN_STOCK")
              )
            );

          const bulkCount = await db
            .select({ stock: productInventory.stock })
            .from(productInventory)
            .where(
              and(eq(productInventory.productId, product.id), eq(productInventory.warehouseId, w.id))
            ).limit(1);
            
          const totalStock = (serialCount[0]?.total || 0) + (bulkCount[0]?.stock || 0);

          return {
            warehouseId: w.id,
            warehouseName: w.name,
            city: w.city,
            stock: totalStock,
          };
        })
      );

      // Find overstock and understock
      const avgStock = warehouseStocks.reduce((sum, ws) => sum + ws.stock, 0) / warehouseStocks.length;
      const overstock = warehouseStocks.filter((ws) => ws.stock > avgStock * 1.5);
      const understock = warehouseStocks.filter((ws) => ws.stock < avgStock * 0.5);

      if (overstock.length > 0 && understock.length > 0) {
        overstock.forEach((over) => {
          understock.forEach((under) => {
            const suggestedQty = Math.min(
              Math.floor((over.stock - avgStock) / 2),
              Math.floor(avgStock - under.stock)
            );

            if (suggestedQty > 2) {
              imbalances.push({
                productId: product.id,
                productName: product.name,
                overstockedWarehouse: { id: over.warehouseId, name: over.warehouseName, city: over.city, stock: over.stock },
                understockedWarehouse: { id: under.warehouseId, name: under.warehouseName, city: under.city, stock: under.stock },
                suggestedTransferQty: suggestedQty,
                reason: `Transfer ${suggestedQty} units from ${over.city} to ${under.city}`,
                urgency: under.stock === 0 ? "critical" : under.stock < 5 ? "high" : "medium",
              });
            }
          });
        });
      }
    }

    return imbalances.sort((a, b) => {
      const urgencyMap = { critical: 3, high: 2, medium: 1 };
      return urgencyMap[b.urgency] - urgencyMap[a.urgency];
    });
  } catch (e) {
    console.error("Error calculating warehouse imbalances:", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TIER 2: DEMAND FORECASTING
// ─────────────────────────────────────────────────────────────────────────

export interface DemandForecast {
  productId: number;
  productName: string;
  currentStock: number;
  predictedDaysToStockout: number;
  estimatedReorderDate: Date;
  confidence: number; // 0-100
  seasonality: string;
}

export async function getDemandForecasts(): Promise<DemandForecast[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const activeProducts = await db.select().from(products).where(eq(products.active, true));

    return await Promise.all(
      activeProducts.map(async (p) => {
        // Calculate velocity
        const sales7d = await db
          .select({ qty: sql<number>`sum(${orderItems.quantity})`.mapWith(Number) })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(and(eq(orderItems.productId, p.id), gte(orders.createdAt, sevenDaysAgo)));

        const sales30d = await db
          .select({ qty: sql<number>`sum(${orderItems.quantity})`.mapWith(Number) })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(and(eq(orderItems.productId, p.id), gte(orders.createdAt, thirtyDaysAgo)));

        const v7 = sales7d[0]?.qty || 0;
        const v30 = sales30d[0]?.qty || 0;
        const dailyVelocity = v7 / 7;

        // Forecast
        const daysToStockout = dailyVelocity > 0 ? Math.ceil(p.stock / dailyVelocity) : 9999;
        const reorderDate = new Date(Date.now() + daysToStockout * 24 * 60 * 60 * 1000);

        // Confidence increases with consistent sales
        const velocityVariance = Math.abs(v7 - v30 / 4); // Compare 7d to 30d normalized
        const confidence = Math.max(30, Math.min(95, 100 - velocityVariance));

        // Simple seasonality detection
        const seasonality = v7 > v30 / 4 * 1.5 ? "increasing" : v7 < v30 / 4 * 0.5 ? "decreasing" : "stable";

        return {
          productId: p.id,
          productName: p.name,
          currentStock: p.stock,
          predictedDaysToStockout: daysToStockout,
          estimatedReorderDate: reorderDate,
          confidence: Math.round(confidence),
          seasonality,
        };
      })
    );
  } catch (e) {
    console.error("Error forecasting demand:", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TIER 2: INVENTORY AGING REPORT
// ─────────────────────────────────────────────────────────────────────────

export interface InventoryAging {
  productId: number;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  ageInDays: number;
  stock: number;
  lastSaleDate: Date | null;
  daysSinceLastSale: number;
  recommendation: "promote" | "discount" | "clearance" | "hold";
}

export async function getInventoryAging(): Promise<InventoryAging[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const aging: InventoryAging[] = [];
    const warehouseList = await db.select().from(warehouses).where(eq(warehouses.active, true));

    for (const warehouse of warehouseList) {
      const warehouseProducts = await db
        .select({
          productId: productUnits.productId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(productUnits)
        .where(
          and(
            eq(productUnits.warehouseId, warehouse.id),
            eq(productUnits.status, "IN_STOCK")
          )
        )
        .groupBy(productUnits.productId);

      for (const wp of warehouseProducts) {
        const product = await db.select().from(products).where(eq(products.id, wp.productId)).limit(1);
        if (!product || !product[0]) continue;

        const lastSale = await db
          .select({ soldAt: productUnits.soldAt })
          .from(productUnits)
          .where(
            and(
              eq(productUnits.productId, wp.productId),
              eq(productUnits.warehouseId, warehouse.id)
            )
          )
          .orderBy(desc(productUnits.soldAt))
          .limit(1);

        const lastSaleDate = lastSale[0]?.soldAt || null;
        const daysSinceLastSale = lastSaleDate ? Math.floor((Date.now() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24)) : 9999;

        let recommendation: "promote" | "discount" | "clearance" | "hold" = "hold";
        if (daysSinceLastSale > 180) recommendation = "clearance";
        else if (daysSinceLastSale > 90) recommendation = "discount";
        else if (daysSinceLastSale > 30) recommendation = "promote";

        aging.push({
          productId: wp.productId,
          productName: product[0].name,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          ageInDays: daysSinceLastSale,
          stock: wp.count,
          lastSaleDate,
          daysSinceLastSale,
          recommendation,
        });
      }
    }

    return aging.sort((a, b) => b.daysSinceLastSale - a.daysSinceLastSale);
  } catch (e) {
    console.error("Error calculating inventory aging:", e);
    return [];
  }
}
