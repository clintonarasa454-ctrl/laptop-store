import { and, desc, eq, ilike, inArray, or, sql, gte, lt, gt } from "drizzle-orm";
import {
  addresses,
  cartItems,
  categories,
  InsertUser,
  orderItems,
  orderStatusHistory,
  orders,
  payments,
  products,
  reviews,
  users,
  settings,
  banners,
  promotions,
  announcements,
  wishlists,
  pageViews,
  deliveryPayouts,
  productViews,
  aiConversations,
  userPreferences,
  productPriceHistory,
  productUnits,
  inventoryTransactions,
  warehouses,
  deletionRequests,
  productInventory,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db-init";

// Re-export getDb so it's available to all modules that import from db
export { getDb };

// ─── Global Search ────────────────────────────────────────────────────────────
export async function adminGlobalSearch(query: string, limit: number = 10, offset: number = 0) {
  const db = await getDb();
  if (!db) return { products: [], orders: [], customers: [], categories: [] };

  const safeQuery = query.trim();
  if (!safeQuery) return { products: [], orders: [], customers: [], categories: [] };

  const searchQuery = `%${safeQuery}%`;
  const likeOp = ilike;

  const [productsRes, ordersRes, customersRes, categoriesRes] = await Promise.all([
    db.select({ id: products.id, name: products.name, slug: products.slug, brand: products.brand })
      .from(products)
      .where(
        or(
          likeOp(products.name, searchQuery),
          likeOp(products.sku, searchQuery),
          likeOp(products.brand, searchQuery),
          likeOp(products.shortDescription, searchQuery)
        )
      )
      .limit(limit)
      .offset(offset),
    db.select({ id: orders.id, orderNumber: orders.orderNumber, customerName: users.name })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(
        or(
          likeOp(orders.orderNumber, searchQuery),
          likeOp(users.name, searchQuery),
          likeOp(users.email, searchQuery)
        )
      )
      .limit(limit)
      .offset(offset),
    db.select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(
        or(
          likeOp(users.name, searchQuery),
          likeOp(users.email, searchQuery),
          likeOp(users.phone, searchQuery)
        )
      )
      .limit(limit)
      .offset(offset),
    db.select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(categories)
      .where(
        or(
          likeOp(categories.name, searchQuery),
          likeOp(categories.description, searchQuery)
        )
      )
      .limit(limit)
      .offset(offset),
  ]);

  return { products: productsRes, orders: ordersRes, customers: customersRes, categories: categoriesRes };
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod", "phone"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  const q = db.insert(users).values(values);
  if (typeof (q as any).onConflictDoUpdate === 'function') {
    await (q as any).onConflictDoUpdate({ target: users.openId, set: updateSet });
  } else {
    await (q as any).onDuplicateKeyUpdate({ set: updateSet });
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

// ─── Categories ───────────────────────────────────────────────────────────────
export async function getCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).orderBy(categories.name);
}

export async function getCategoryBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return result[0];
}

export async function upsertCategory(data: { name: string; slug: string; description?: string | null; imageUrl?: string | null; icon?: string | null; featured?: boolean; active?: boolean; parentId?: number | null }) {
  const db = await getDb();
  if (!db) return;
  const values = { ...data, icon: data.icon, featured: data.featured ?? false, active: data.active ?? true, parentId: data.parentId ?? null };
  const updateSet = { name: data.name, slug: data.slug, description: data.description, imageUrl: data.imageUrl, icon: data.icon, featured: data.featured ?? false, active: data.active ?? true, parentId: data.parentId ?? null };

  const q = db.insert(categories).values(values);
  if (typeof (q as any).onConflictDoUpdate === 'function') {
    await (q as any).onConflictDoUpdate({ target: categories.slug, set: updateSet as any });
  } else {
    await (q as any).onDuplicateKeyUpdate({ set: updateSet as any });
  }
}

// ─── Products ─────────────────────────────────────────────────────────────────
export async function getProducts(opts?: {
  categoryId?: number | number[];
  search?: string;
  featured?: boolean;
  limit?: number;
  tag?: string;
  offset?: number;
  nearestWarehouseId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(products.active, true)];
  if (opts?.categoryId !== undefined) {
    if (Array.isArray(opts.categoryId)) {
      if (opts.categoryId.length > 0) conditions.push(inArray(products.categoryId, opts.categoryId));
    } else {
      conditions.push(eq(products.categoryId, opts.categoryId));
    }
  }
  if (opts?.featured) conditions.push(eq(products.featured, true));
  if (opts?.search?.trim()) {
    const safeSearch = opts.search.trim();
    const searchCondition = or(ilike(products.name, `%${safeSearch}%`), ilike(products.brand, `%${safeSearch}%`));

    conditions.push(searchCondition as ReturnType<typeof eq>);
  }
  if (opts?.tag) {
    const tagJson = JSON.stringify([opts.tag]);
    const tagCondition = sql`${products.tags}::jsonb @> ${tagJson}::jsonb`;
    conditions.push(tagCondition as ReturnType<typeof eq>);
  }
  if (opts?.nearestWarehouseId !== undefined) {
    const warehouseCondition = or(
      eq(products.hasSerial, false),
      sql`EXISTS (SELECT 1 FROM product_units WHERE product_units.product_id = ${products.id} AND product_units.warehouse_id = ${opts.nearestWarehouseId} AND product_units.status = 'IN_STOCK')`
    );
    conditions.push(warehouseCondition as ReturnType<typeof eq>);
  }
  return db
    .select({
      id: products.id,
      categoryId: products.categoryId,
      name: products.name,
      slug: products.slug,
      shortDescription: products.shortDescription,
      price: products.price,
      comparePrice: products.comparePrice,
      stock: products.stock,
      brand: products.brand,
      sku: products.sku,
      images: products.images,
      tags: products.tags,
      rating: products.rating,
      reviewCount: products.reviewCount,
      featured: products.featured,
      active: products.active,
      warehouseId: products.warehouseId,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(and(...conditions))
    .orderBy(desc(products.createdAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
}

export async function getProductBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(and(eq(products.slug, slug), eq(products.active, true))).limit(1);
  return result[0];
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function getProductsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(inArray(products.id, ids));
}

export async function upsertProduct(data: {
  id?: number;
  categoryId: number;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price: string;
  comparePrice?: string;
  stock: number;
  brand?: string;
  sku?: string;
  images?: string[];
  specifications?: Record<string, string>;
  tags?: string[];
  featured?: boolean;
  active?: boolean;
  hasSerial?: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  const payload = {
    ...data,
    images: data.images ?? [],
    specifications: data.specifications ?? {},
    tags: data.tags ?? [],
  };
  if (data.id) {
    await db.update(products).set(payload as any).where(eq(products.id, data.id));
  } else {
    const q = db.insert(products).values(payload as any);
    if (typeof (q as any).onConflictDoUpdate === 'function') {
      await (q as any).onConflictDoUpdate({ target: products.slug, set: payload as any });
    } else {
      await (q as any).onDuplicateKeyUpdate({ set: payload as any });
    }
  }
}

export async function updateProductStock(productId: number, delta: number, orderId?: number) {
  const db = await getDb();
  if (!db) return;
  
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);

  let originWarehouseId: number | null = null;
  if (orderId) {
    const [order] = await db.select({ originWarehouseId: orders.originWarehouseId }).from(orders).where(eq(orders.id, orderId)).limit(1);
    if (order?.originWarehouseId) {
      originWarehouseId = order.originWarehouseId;
    }
  }

  if (product?.hasSerial) {
    if (delta < 0) {
      // Selling units: Mark IN_STOCK units as SOLD
      let conditions: any[] = [eq(productUnits.productId, productId), eq(productUnits.status, "IN_STOCK")];
      if (originWarehouseId) conditions.push(eq(productUnits.warehouseId, originWarehouseId));
      
      const availableUnits = await db.select().from(productUnits)
        .where(and(...conditions))
        .limit(Math.abs(delta));
        
      if (availableUnits.length > 0) {
        const unitIds = availableUnits.map(u => u.id);
        await db.update(productUnits)
          .set({ status: "SOLD", soldAt: new Date(), soldToOrderId: orderId || null })
          .where(inArray(productUnits.id, unitIds));
          
        await db.insert(inventoryTransactions).values(
          availableUnits.map(u => ({ productId, unitId: u.id, transactionType: "SOLD", quantityChange: -1, fromStatus: "IN_STOCK", toStatus: "SOLD", orderId: orderId || null }))
        );
      }
    } else if (delta > 0 && orderId) {
      // Returning units: Order was cancelled, mark specific units back to IN_STOCK
      const soldUnits = await db.select().from(productUnits)
        .where(and(eq(productUnits.productId, productId), eq(productUnits.soldToOrderId, orderId)))
        .limit(delta);

      if (soldUnits.length > 0) {
        const unitIds = soldUnits.map(u => u.id);
        await db.update(productUnits)
          .set({ status: "IN_STOCK", soldAt: null, soldToOrderId: null })
          .where(inArray(productUnits.id, unitIds));

        await db.insert(inventoryTransactions).values(
          soldUnits.map(u => ({ productId, unitId: u.id, transactionType: "RETURNED", quantityChange: 1, fromStatus: "SOLD", toStatus: "IN_STOCK", orderId: orderId }))
        );
      }
    }
  } else if (!product?.hasSerial) {
    // For non-serialized bulk items, simply update the stock number
    const stockUpdate = sql`GREATEST(0, "stock" + ${delta})`;
    await db.update(products).set({ stock: stockUpdate }).where(eq(products.id, productId));
    
    if (originWarehouseId) {
       const [inv] = await db.select().from(productInventory).where(and(eq(productInventory.productId, productId), eq(productInventory.warehouseId, originWarehouseId))).limit(1);
       if (inv) {
         const invUpdate = sql`GREATEST(0, "stock" + ${delta})`;
         await db.update(productInventory).set({ stock: invUpdate }).where(eq(productInventory.id, inv.id));
       }
    }
  }
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
export async function getCartItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: cartItems.id,
      userId: cartItems.userId,
      productId: cartItems.productId,
      quantity: cartItems.quantity,
      createdAt: cartItems.createdAt,
      updatedAt: cartItems.updatedAt,
      product: products,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, userId));
}

export async function upsertCartItem(userId: number, productId: number, quantity: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(cartItems)
      .set({ quantity })
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));
  } else {
    await db.insert(cartItems).values({ userId, productId, quantity });
  }
}

export async function removeCartItem(userId: number, productId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(cartItems).where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));
}

export async function clearCart(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────
export async function getWishlist(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ product: products }).from(wishlists).innerJoin(products, eq(wishlists.productId, products.id)).where(eq(wishlists.userId, userId)).orderBy(desc(wishlists.createdAt));
}

export async function toggleWishlistItem(userId: number, productId: number) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select().from(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.productId, productId))).limit(1);
  if (existing.length > 0) {
    await db.delete(wishlists).where(eq(wishlists.id, existing[0].id));
    return false; // Removed
  } else {
    await db.insert(wishlists).values({ userId, productId });
    return true; // Added
  }
}

// ─── Addresses ────────────────────────────────────────────────────────────────
export async function getUserAddresses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault));
}

export async function createAddress(data: {
  userId: number;
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  postalCode?: string;
  country: string;
  isDefault?: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  if (data.isDefault) {
    await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, data.userId));
  }
  const result = await db.insert(addresses).values(data);
  return result;
}

export async function deleteAddress(userId: number, addressId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(addresses).where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export async function createOrder(data: {
  orderNumber: string;
  userId?: number;
  shippingFullName: string;
  shippingEmail?: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingCounty?: string;
  shippingPostalCode?: string;
  shippingCountry: string;
  subtotal: string;
  shippingCost: string;
  total: string;
  paymentMethod?: "mpesa" | "paypal" | "stripe" | "card" | "cod";
  notes?: string;
  originWarehouseId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.insert(orders).values(data).returning({ insertId: orders.id });
  return result[0]?.insertId;
}

export async function createOrderItems(
  items: Array<{
    orderId: number;
    productId: number;
    productName: string;
    productImage?: string;
    price: string;
    quantity: number;
    subtotal: string;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(orderItems).values(items);
}

export async function getOrdersByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function getOrderById(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return result[0];
}

export async function getOrderByNumber(orderNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  return result[0];
}

export async function getOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function getAllOrders(opts?: { limit?: number; offset?: number; warehouseId?: number | null }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (opts?.warehouseId) {
    conditions.push(eq(orders.originWarehouseId, opts.warehouseId));
  }

  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      userId: orders.userId,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      total: orders.total,
      subtotal: orders.subtotal,
      shippingCost: orders.shippingCost,
      shippingFullName: orders.shippingFullName,
      shippingPhone: orders.shippingPhone,
      shippingAddress: orders.shippingAddress,
      shippingCity: orders.shippingCity,
      shippingCountry: orders.shippingCountry,
      trackingNumber: orders.trackingNumber,
      deliveryAgentId: orders.deliveryAgentId,
      deliveryOtp: orders.deliveryOtp,
      notes: orders.notes,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      customerName: users.name,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
}

export async function updateOrderStatus(
  orderId: number,
  status: string,
  note?: string,
  extra?: { trackingNumber?: string; estimatedDelivery?: Date; paymentStatus?: string; paymentReference?: string }
) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { status };
  if (extra?.trackingNumber) updateData.trackingNumber = extra.trackingNumber;
  if (extra?.estimatedDelivery) updateData.estimatedDelivery = extra.estimatedDelivery;
  if (extra?.paymentStatus) updateData.paymentStatus = extra.paymentStatus;
  if (extra?.paymentReference) updateData.paymentReference = extra.paymentReference;
  await db.update(orders).set(updateData).where(eq(orders.id, orderId));
  await db.insert(orderStatusHistory).values({ orderId, status, note });
}

export async function getOrderStatusHistory(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, orderId))
    .orderBy(orderStatusHistory.createdAt);
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export async function createPayment(data: {
  orderId: number;
  method: "mpesa" | "paypal" | "stripe" | "card" | "cod";
  amount: string;
  currency?: string;
  transactionId?: string;
  providerResponse?: unknown;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(payments).values(data);
}

export async function updatePaymentStatus(
  orderId: number,
  status: "pending" | "paid" | "failed" | "refunded",
  transactionId?: string,
  providerResponse?: unknown
) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { status };
  if (transactionId) updateData.transactionId = transactionId;
  if (providerResponse) updateData.providerResponse = providerResponse;
  await db.update(payments).set(updateData).where(eq(payments.orderId, orderId));
}

export async function getPaymentByOrder(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
  return result[0];
}

export async function getAllPayments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).orderBy(desc(payments.createdAt));
}

// ─── Reviews ──────────────────────────────────────────────────────────────────
export async function getProductReviews(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ review: reviews, user: { name: users.name } })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.productId, productId))
    .orderBy(desc(reviews.createdAt));
}

export async function addProductReview(data: { productId: number; userId: number; rating: number; title?: string; body?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(reviews).values(data);
  
  // Recalculate and update the product's aggregated stats
  const allReviews = await db.select().from(reviews).where(eq(reviews.productId, data.productId));
  const newCount = allReviews.length;
  const newAvg = allReviews.reduce((sum, r) => sum + r.rating, 0) / newCount;
  await db.update(products).set({ 
    rating: newAvg.toFixed(2), 
    reviewCount: newCount 
  }).where(eq(products.id, data.productId));
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function trackPageView(path: string) {
  const db = await getDb();
  if (db) await db.insert(pageViews).values({ path });
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────
export async function logAuditAction(userId: number, action: string, resourceId: string | number, details?: string) {
  const db = await getDb();
  if (!db) return;
  
  try {
    // Using raw SQL so it functions immediately even before you map it in schema.ts
    await db.execute(sql`
      INSERT INTO audit_logs (user_id, action, resource_id, details, created_at) 
      VALUES (${userId}, ${action}, ${String(resourceId)}, ${details ?? null}, NOW())
    `);
  } catch (error) {
    console.error("⚠️ Failed to write audit log (Ensure 'audit_logs' table exists):", error);
  }
}

export async function getAdminStats(timeRange: string = "30d", warehouseId?: number | null) {
  const db = await getDb();
  if (!db) {
    console.error("[getAdminStats] Database connection failed. Check your DATABASE_URL configuration.");
    throw new Error("Database connection failed. Check your DATABASE_URL configuration.");
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let days = 30;
  let isAllTime = false;

  if (!timeRange || timeRange === "all") {
    isAllTime = true;
    days = 3650; // Use a large number for charts fallback
  } else if (timeRange.endsWith("d")) {
    days = parseInt(timeRange.replace("d", ""));
  } else if (timeRange.endsWith("m")) {
    days = parseInt(timeRange.replace("m", "")) * 30;
  } else if (timeRange.endsWith("y")) {
    days = parseInt(timeRange.replace("y", "")) * 365;
  } else {
    days = parseInt(timeRange) || 30;
  }

  const dynamicDaysAgo = new Date();
  dynamicDaysAgo.setDate(dynamicDaysAgo.getDate() - days);
  
  const previousPeriodAgo = new Date();
  previousPeriodAgo.setDate(previousPeriodAgo.getDate() - (days * 2));
  
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const ordersConditions = isAllTime ? [] : [gte(orders.createdAt, dynamicDaysAgo)];
  if (warehouseId) ordersConditions.push(eq(orders.originWarehouseId, warehouseId));
  const ordersFilter = ordersConditions.length > 0 ? and(...ordersConditions) : undefined;

  const usersConditions = isAllTime ? [] : [gte(users.createdAt, dynamicDaysAgo)];
  if (warehouseId) usersConditions.push(eq(users.warehouseId, warehouseId));
  const usersFilter = usersConditions.length > 0 ? and(...usersConditions) : undefined;

  const productsConditions = isAllTime ? [] : [gte(products.createdAt, dynamicDaysAgo)];
  if (warehouseId) productsConditions.push(eq(products.warehouseId, warehouseId));
  const productsFilter = productsConditions.length > 0 ? and(...productsConditions) : undefined;

  const payoutsFilter = isAllTime ? undefined : gte(deliveryPayouts.requestedAt, dynamicDaysAgo);
  const viewsFilter = isAllTime ? undefined : gte(pageViews.createdAt, dynamicDaysAgo);
  
  const pastOrdersConditions = isAllTime ? [sql`1=0`] : [gte(orders.createdAt, previousPeriodAgo), lt(orders.createdAt, dynamicDaysAgo)];
  if (warehouseId) pastOrdersConditions.push(eq(orders.originWarehouseId, warehouseId));
  const pastOrdersFilter = pastOrdersConditions.length > 0 ? and(...pastOrdersConditions) : undefined;

  const pastUsersConditions = isAllTime ? [sql`1=0`] : [gte(users.createdAt, previousPeriodAgo), lt(users.createdAt, dynamicDaysAgo)];
  if (warehouseId) pastUsersConditions.push(eq(users.warehouseId, warehouseId));
  const pastUsersFilter = pastUsersConditions.length > 0 ? and(...pastUsersConditions) : undefined;

  const pastViewsFilter = isAllTime ? sql`1=0` : and(gte(pageViews.createdAt, previousPeriodAgo), lt(pageViews.createdAt, dynamicDaysAgo));

  // Group 1: General Stats (Prevents DB connection pool exhaustion - max 20 conns)
  const [[orderStats], [pastOrderStats], [pendingStats], [userCount], [productCount], [payoutStats]] = await Promise.all([
    db.select({
      totalOrders: sql<number>`COUNT(*)`,
      totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${orders.paymentStatus} = 'paid' THEN CAST(${orders.total} AS DECIMAL(10,2)) ELSE 0 END), 0)`,
    }).from(orders).where(ordersFilter),
    db.select({
      totalOrders: sql<number>`COUNT(*)`,
      totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${orders.paymentStatus} = 'paid' THEN CAST(${orders.total} AS DECIMAL(10,2)) ELSE 0 END), 0)`,
    }).from(orders).where(pastOrdersFilter),
    db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(and(eq(orders.status, "pending"), ordersFilter)),
    db.select({ count: sql<number>`COUNT(*)` }).from(users).where(and(eq(users.role, "user"), warehouseId ? eq(users.warehouseId, warehouseId) : undefined)),
    db.select({ count: sql<number>`COUNT(*)` }).from(products).where(and(eq(products.active, true), gt(products.stock, 0), warehouseId ? eq(products.warehouseId, warehouseId) : undefined)),
    db.select({ totalPayouts: sql<string>`COALESCE(SUM(amount), 0)` }).from(deliveryPayouts).where(and(eq(deliveryPayouts.status, "completed"), payoutsFilter)),
  ]);

  // Group 2: Recent Data & Lists
  const [recentOrderRows, recentAllOrders, recent7DaysOrders, recentPageViews] = await Promise.all([
    db.select({
      id: orders.id, orderNumber: orders.orderNumber, status: orders.status, total: orders.total,
      paymentStatus: orders.paymentStatus, createdAt: orders.createdAt, customerName: users.name,
    }).from(orders).leftJoin(users, eq(orders.userId, users.id)).where(ordersFilter).orderBy(desc(orders.createdAt)).limit(5),
    db.select({ total: orders.total, createdAt: orders.createdAt, userId: orders.userId })
      .from(orders)
      .where(and(sql`${orders.createdAt} >= ${sixMonthsAgo.toISOString()}`, eq(orders.paymentStatus, "paid"), warehouseId ? eq(orders.originWarehouseId, warehouseId) : undefined)),
    db.select({ total: orders.total, createdAt: orders.createdAt, userId: orders.userId }).from(orders).where(and(ordersFilter || undefined, eq(orders.paymentStatus, "paid"))),
    db.select({ path: pageViews.path, createdAt: pageViews.createdAt }).from(pageViews).where(viewsFilter).limit(50000),
  ]);

  // Group 3: Aggregations & AI User Tracking
  const [allOrderItems, categorySalesData, userOrderCounts, aiUserRows] = await Promise.all([
    db.select({ productName: orderItems.productName, quantity: orderItems.quantity })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(ordersFilter),
    db.select({ categoryName: categories.name, subtotal: orderItems.subtotal, brand: products.brand })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(ordersFilter),
    db.select({ userId: orders.userId, count: sql<number>`COUNT(*)` })
      .from(orders)
      .where(ordersFilter)
      .groupBy(orders.userId),
    db.select({ userId: aiConversations.userId }).from(aiConversations).where(sql`${aiConversations.userId} IS NOT NULL`)
  ]);

  // Group 4: Trends Calculation
  const [[recentUsers], [pastUsers], [recentProducts], [recentViews], [pastViews]] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(users).where(usersFilter),
    db.select({ count: sql<number>`COUNT(*)` }).from(users).where(pastUsersFilter),
    db.select({ count: sql<number>`COUNT(*)` }).from(products).where(and(eq(products.active, true), gt(products.stock, 0), productsFilter)),
    db.select({ count: sql<number>`COUNT(*)` }).from(pageViews).where(viewsFilter),
    db.select({ count: sql<number>`COUNT(*)` }).from(pageViews).where(pastViewsFilter),
  ]);

  const aiUsers = new Set((aiUserRows || []).map(r => r.userId));

  // Monthly Revenue (last 6 months)
  const monthlyDataMap: Record<string, { month: string, revenue: number, orders: number, _ts: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = months[d.getMonth()];
    monthlyDataMap[m] = { month: m, revenue: 0, orders: 0, _ts: d.getTime() };
  }
  (recentAllOrders || []).forEach(o => {
    const date = o?.createdAt ? new Date(o.createdAt) : new Date();
    const m = months[date.getMonth()];
    if (monthlyDataMap[m]) {
      monthlyDataMap[m].revenue += parseFloat((o?.total as string) || "0");
      monthlyDataMap[m].orders += 1;
    }
  });
  const monthlyRevenueData = Object.values(monthlyDataMap).sort((a, b) => a._ts - b._ts).map(({_ts, ...rest}) => rest);

  // Dynamic Revenue & Visitors Chart
  const dailyDataMap: Record<string, { date: string, revenue: number, visitors: number, aiRevenue: number, organicRevenue: number, _ts: number }> = {};
  if (isAllTime || days >= 365) {
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const dateStr = `${months[d.getMonth()]} ${d.getFullYear()}`;
      dailyDataMap[dateStr] = { date: dateStr, revenue: 0, visitors: 0, aiRevenue: 0, organicRevenue: 0, _ts: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
    }
    (recent7DaysOrders || []).forEach(o => {
      const date = o?.createdAt ? new Date(o.createdAt) : new Date();
      const dateStr = `${months[date.getMonth()]} ${date.getFullYear()}`;
      const rev = parseFloat((o?.total as string) || "0");
      if (dailyDataMap[dateStr]) {
        dailyDataMap[dateStr].revenue += rev;
        if (o.userId && aiUsers.has(o.userId)) dailyDataMap[dateStr].aiRevenue += rev;
        else dailyDataMap[dateStr].organicRevenue += rev;
      }
    });
    (recentPageViews || []).forEach(pv => {
      const date = pv?.createdAt ? new Date(pv.createdAt) : new Date();
      const dateStr = `${months[date.getMonth()]} ${date.getFullYear()}`;
      if (dailyDataMap[dateStr]) dailyDataMap[dateStr].visitors += 1;
    });
  } else {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${months[d.getMonth()]} ${d.getDate()}`;
      dailyDataMap[dateStr] = { date: dateStr, revenue: 0, visitors: 0, aiRevenue: 0, organicRevenue: 0, _ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() };
    }
    (recent7DaysOrders || []).forEach(o => {
      const date = o?.createdAt ? new Date(o.createdAt) : new Date();
      const dateStr = `${months[date.getMonth()]} ${date.getDate()}`;
      const rev = parseFloat((o?.total as string) || "0");
      if (dailyDataMap[dateStr]) {
        dailyDataMap[dateStr].revenue += rev;
        if (o.userId && aiUsers.has(o.userId)) dailyDataMap[dateStr].aiRevenue += rev;
        else dailyDataMap[dateStr].organicRevenue += rev;
      }
    });
    (recentPageViews || []).forEach(pv => {
      const date = pv?.createdAt ? new Date(pv.createdAt) : new Date();
      const dateStr = `${months[date.getMonth()]} ${date.getDate()}`;
      if (dailyDataMap[dateStr]) dailyDataMap[dateStr].visitors += 1;
    });
  }
  const revenueData = Object.values(dailyDataMap).sort((a, b) => a._ts - b._ts).map(({_ts, ...rest}) => rest);

  // Product Performance
  const productSales: Record<string, number> = {};
  (allOrderItems || []).forEach(item => {
    if (item?.productName) {
      productSales[item.productName] = (productSales[item.productName] || 0) + (item.quantity || 0);
    }
  });
  const productPerformanceData = Object.entries(productSales).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  // Category & Brand Sales
  const catSalesMap: Record<string, number> = {};
  const brandSalesMap: Record<string, number> = {};
  (categorySalesData || []).forEach(row => {
    const subtotal = parseFloat(row?.subtotal as string || "0");
    if (row?.categoryName) {
      catSalesMap[row.categoryName] = (catSalesMap[row.categoryName] || 0) + subtotal;
      if (row.brand) {
        brandSalesMap[row.brand] = (brandSalesMap[row.brand] || 0) + subtotal;
      }
    }
  });
  const categoryData = Object.entries(catSalesMap).map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales);
  const brandData = Object.entries(brandSalesMap).map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales).slice(0, 10);

  const returningUsersCount = (userOrderCounts || []).filter(u => Number(u?.count ?? 0) > 1).length;

  const currRevenue = parseFloat(orderStats?.totalRevenue || "0");
  const prevRevenue = parseFloat(pastOrderStats?.totalRevenue || "0");
  const revenueTrend = prevRevenue > 0 ? ((currRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  
  const currOrders = Number(orderStats?.totalOrders || 0);
  const prevOrders = Number(pastOrderStats?.totalOrders || 0);
  const ordersTrend = prevOrders > 0 ? ((currOrders - prevOrders) / prevOrders) * 100 : 0;
  
  const currUsersCount = Number(recentUsers?.count ?? 0);
  const prevUsersCount = Number(pastUsers?.count ?? 0);
  const customersTrend = prevUsersCount > 0 ? ((currUsersCount - prevUsersCount) / prevUsersCount) * 100 : 0;

  const currViews = Number(recentViews?.count ?? 0);
  const prevViews = Number(pastViews?.count ?? 0);
  const pageViewsTrend = prevViews > 0 ? ((currViews - prevViews) / prevViews) * 100 : 0;

  const currConvRate = currViews > 0 ? (currOrders / currViews) * 100 : 0;
  const prevConvRate = prevViews > 0 ? (prevOrders / prevViews) * 100 : 0;
  const convTrend = prevConvRate > 0 ? ((currConvRate - prevConvRate) / prevConvRate) * 100 : 0;
  
  const currAov = currOrders > 0 ? currRevenue / currOrders : 0;
  const prevAov = prevOrders > 0 ? prevRevenue / prevOrders : 0;
  const aovTrend = prevAov > 0 ? ((currAov - prevAov) / prevAov) * 100 : 0;
  
  const returningRatio = Number(userCount?.count ?? 0) > 0 ? (returningUsersCount / Number(userCount?.count ?? 1)) * 100 : 0;

  const trends = {
    revenue: Number(revenueTrend.toFixed(1)), orders: Number(ordersTrend.toFixed(1)), customers: Number(customersTrend.toFixed(1)),
    products: Number(recentProducts?.count ?? 0), pageViews: Number(pageViewsTrend.toFixed(1)), 
    conversion: Number(convTrend.toFixed(1)), aov: Number(aovTrend.toFixed(1)), returning: Number(returningRatio.toFixed(1))
  };

  // --- Actual PageView groupings ---
  const pathCounts: Record<string, number> = {};
  (recentPageViews || []).forEach(pv => {
    let p = (pv?.path || "").split('?')[0];
    let name = "Other";
    if (p === '/' || p === '') name = "Home / Direct";
    else if (p.startsWith('/products')) name = "Products / Shop";
    else if (p.startsWith('/cart') || p.startsWith('/checkout')) name = "Cart / Checkout";
    else if (p.startsWith('/dashboard')) name = "User Dashboard";
    else if (p.startsWith('/auth')) name = "Authentication";
    
    pathCounts[name] = (pathCounts[name] || 0) + 1;
  });
  const computedTrafficSourceData = Object.entries(pathCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value).slice(0, 4);

  return {
    totalOrders: Number(orderStats?.totalOrders ?? 0),
    totalRevenue: orderStats?.totalRevenue ?? "0",
    totalPayouts: payoutStats?.totalPayouts ?? "0",
    totalCustomers: Number(userCount?.count ?? 0),
    totalProducts: Number(productCount?.count ?? 0),
    pendingOrders: Number(pendingStats?.count ?? 0),
    recentOrders: recentOrderRows,
    returningUsersCount,
    trends,
    monthlyRevenueData,
    revenueData,
    productPerformanceData,
    categoryData,
    brandData,
    trafficSourceData: computedTrafficSourceData,
  };
}

export async function getStoreStats() {
  const db = await getDb();
  if (!db) return { productCount: 0, customerCount: 0, avgRating: "0.0" };
  const [productCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(products).where(and(eq(products.active, true), gt(products.stock, 0)));
  const [customerCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(users).where(eq(users.role, "user"));
  const [ratingStats] = await db.select({ avg: sql<number>`AVG(rating)` }).from(reviews);
  return {
    productCount: productCount?.count ?? 0,
    customerCount: customerCount?.count ?? 0,
    avgRating: ratingStats?.avg ? Number(ratingStats.avg).toFixed(1) : "0.0",
  };
}

export async function deleteProduct(productId: number) {
  const db = await getDb();
  if (!db) return;
  // Soft delete by setting active = false
  await db.update(products).set({ active: false }).where(eq(products.id, productId));
}

// ─── Settings & Content ───────────────────────────────────────────────────────
export async function getSetting(key: string): Promise<any> {
  try {
    const db = await getDb();
    if (!db) return null;
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return result[0]?.value ?? null;
  } catch (error) {
    console.warn(`⚠️  Database unavailable - getSetting("${key}") returned null:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function upsertSetting(key: string, value: unknown) {
  const db = await getDb();
  if (!db) return;
  const q = db.insert(settings).values({ key, value });
  if (typeof (q as any).onConflictDoUpdate === 'function') {
    await (q as any).onConflictDoUpdate({ target: settings.key, set: { value } });
  } else {
    await (q as any).onDuplicateKeyUpdate({ set: { value } });
  }
}

export async function getBanners(opts?: { activeOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  if (opts?.activeOnly) {
    return db.select().from(banners).where(eq(banners.active, true)).orderBy(desc(banners.createdAt));
  }
  return db.select().from(banners).orderBy(desc(banners.createdAt));
}

export async function upsertBanner(data: { id?: number; title: string; description?: string | null; image: string; active?: boolean }) {
  const db = await getDb();
  if (!db) return;
  if (data.id) {
    await db.update(banners).set(data).where(eq(banners.id, data.id));
  } else {
    await db.insert(banners).values(data as any);
  }
}

export async function deleteBanner(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(banners).where(eq(banners.id, id));
}

export async function getPromotions(opts?: { activeOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  if (opts?.activeOnly) {
    return db.select().from(promotions).where(eq(promotions.active, true)).orderBy(desc(promotions.createdAt));
  }
  return db.select().from(promotions).orderBy(desc(promotions.createdAt));
}

export async function upsertPromotion(data: { id?: number; title: string; description: string; active?: boolean }) {
  const db = await getDb();
  if (!db) return;
  if (data.id) {
    await db.update(promotions).set(data).where(eq(promotions.id, data.id));
  } else {
    await db.insert(promotions).values(data as any);
  }
}

export async function deletePromotion(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(promotions).where(eq(promotions.id, id));
}

export async function getAnnouncements(opts?: { activeOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  if (opts?.activeOnly) {
    return db.select().from(announcements).where(eq(announcements.active, true)).orderBy(desc(announcements.createdAt));
  }
  return db.select().from(announcements).orderBy(desc(announcements.createdAt));
}

export async function upsertAnnouncement(data: { id?: number; title: string; content: string; date: Date; active?: boolean; image?: string; linkUrl?: string }) {
  const db = await getDb();
  if (!db) return;
  if (data.id) {
    await db.update(announcements).set(data).where(eq(announcements.id, data.id));
  } else {
    await db.insert(announcements).values(data as any);
  }
}

export async function deleteAnnouncement(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(announcements).where(eq(announcements.id, id));
}

// ─── Product Views (Personalization) ─────────────────────────────────────────
export async function logProductView(userId: number | null, productId: number, sessionId?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(productViews).values({ userId: userId || undefined, sessionId, productId });
}

export async function getUserProductViews(userId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ productId: productViews.productId })
    .from(productViews)
    .where(eq(productViews.userId, userId))
    .orderBy(desc(productViews.viewedAt))
    .limit(limit);
}

// ─── AI Conversations (Analytics) ────────────────────────────────────────────
export async function logAIConversation(userId: number | null, userEmail: string | null, role: "user" | "assistant", message: string, messageType: "chat" | "product_recommendation" | "order_tracking" | "admin_query" = "chat") {
  const db = await getDb();
  if (!db) return;
  await db.insert(aiConversations).values({ userId: userId || undefined, userEmail, role, message, messageType });
}

export async function getAIConversationStats(daysBack: number = 7) {
  const db = await getDb();
  if (!db) return { totalChats: 0, uniqueUsers: 0, avgMessagesPerUser: 0, topTypes: [] };
  
  const dateFilter = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  
  const totalResult = await db.select({ count: sql<number>`COUNT(*)` }).from(aiConversations).where(sql`${aiConversations.createdAt} > ${dateFilter.toISOString()}`);
  const uniqueResult = await db.select({ count: sql<number>`COUNT(DISTINCT userId)` }).from(aiConversations).where(sql`${aiConversations.createdAt} > ${dateFilter.toISOString()}`);
  const typesResult = await db.select({ type: aiConversations.messageType, count: sql<number>`COUNT(*)` })
    .from(aiConversations)
    .where(sql`${aiConversations.createdAt} > ${dateFilter.toISOString()}`)
    .groupBy(aiConversations.messageType)
    .orderBy(desc(sql<number>`COUNT(*)`))
    .limit(5);

  return {
    totalChats: totalResult[0]?.count || 0,
    uniqueUsers: uniqueResult[0]?.count || 0,
    avgMessagesPerUser: totalResult[0]?.count / (uniqueResult[0]?.count || 1) || 0,
    topTypes: typesResult
  };
}

// ─── User Preferences (Personalization) ─────────────────────────────────────
export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return result[0] || null;
}

export async function updateUserPreferences(userId: number, data: Partial<typeof userPreferences.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  const existing = await getUserPreferences(userId);
  if (existing) {
    await db.update(userPreferences).set(data).where(eq(userPreferences.userId, userId));
  } else {
    await db.insert(userPreferences).values({ userId, ...data } as any);
  }
}

export async function getUserSegments() {
  const db = await getDb();
  if (!db) return { budget: [], premium: [], frequent: [] };
  
  const budgetResult = await db.select({ userId: userPreferences.userId })
    .from(userPreferences)
    .where(sql`${userPreferences.budgetMax} < 50000`)
    .limit(100);
  
  const premiumResult = await db.select({ userId: userPreferences.userId })
    .from(userPreferences)
    .where(sql`${userPreferences.budgetMin} > 150000`)
    .limit(100);
  
  const frequentResult = await db.select({ userId: userPreferences.userId })
    .from(userPreferences)
    .where(sql`${userPreferences.purchaseCount} > 3`)
    .limit(100);

  return {
    budget: budgetResult,
    premium: premiumResult,
    frequent: frequentResult
  };
}

// ─── Product Price History (Dynamic Pricing) ────────────────────────────────
export async function logPriceChange(productId: number, oldPrice: string | number, newPrice: string | number, reason: string, sales7d: number, demand: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(productPriceHistory).values({
    productId,
    oldPrice: String(oldPrice),
    newPrice: String(newPrice),
    reason,
    sales7d,
    demand
  } as any);
}

export async function getPricingSuggestions() {
  const db = await getDb();
  if (!db) return [];
  
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Find products with high sales but low price (increase opportunity)
  const suggestionsResult = await db.select({
    productId: products.id,
    name: products.name,
    currentPrice: products.price,
    recentSales: sql<number>`COUNT(${orderItems.id})`
  })
    .from(products)
    .leftJoin(orderItems, eq(orderItems.productId, products.id))
    .leftJoin(orders, eq(orders.id, orderItems.orderId))
    .where(sql`${orders.createdAt} >= ${sevenDaysAgo.toISOString()}`)
    .groupBy(products.id, products.name, products.price)
    .having(sql`COUNT(${orderItems.id}) > 5`)
    .limit(10);

  return suggestionsResult;
}

// ─── Demand Prediction ────────────────────────────────────────────────────────
export async function getDemandPrediction(daysBack: number = 7) {
  const db = await getDb();
  if (!db) return [];
  
  const dateFilter = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  
  // Get top products by sales in last N days
  const result = await db.select({
    productId: orderItems.productId,
    productName: products.name,
    salesCount: sql<number>`COUNT(${orderItems.id})`,
    revenue: sql<number>`SUM(CAST(${orderItems.subtotal} AS DECIMAL(10,2)))`
  })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(orders, eq(orders.id, orderItems.orderId))
    .where(sql`${orders.createdAt} > ${dateFilter.toISOString()}`)
    .groupBy(orderItems.productId, products.name)
    .orderBy(desc(sql<number>`COUNT(${orderItems.id})`))
    .limit(10);

  return result.map(r => ({
    ...r,
    trend: "high_demand",
    predictedSales: Math.ceil((r.salesCount || 0) * 1.2) // Simple 20% growth prediction
  }));
}
