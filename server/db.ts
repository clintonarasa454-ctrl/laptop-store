import { and, desc, eq, ilike, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
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
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      let dbUrl = process.env.DATABASE_URL.trim();
      
      // Remove accidental quotes if pasted directly from .env into Render
      if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
        dbUrl = dbUrl.slice(1, -1);
      }
      
      // Automatically append SSL requirement for TiDB Serverless if not present
      if (dbUrl.includes("tidbcloud.com") && !dbUrl.includes("ssl=")) {
        dbUrl += dbUrl.includes("?") ? "&ssl={\"rejectUnauthorized\":true}" : "?ssl={\"rejectUnauthorized\":true}";
      }

      const pool = mysql.createPool(dbUrl);

      // Test the connection immediately to catch Auth or SSL errors
      const connection = await pool.getConnection();
      connection.release();

      _db = drizzle(pool);
    } catch (error) {
      console.error("\n========================================");
      console.error("[Database Error] Failed to connect to TiDB/MySQL.");
      console.error("Details:", (error as Error).message);
      console.error("========================================\n");
      _db = null;
    }
  }
  return _db;
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
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
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

export async function upsertCategory(data: { name: string; slug: string; description?: string; imageUrl?: string }) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(categories)
    .values(data)
    .onDuplicateKeyUpdate({ set: { name: data.name, description: data.description, imageUrl: data.imageUrl } });
}

// ─── Products ─────────────────────────────────────────────────────────────────
export async function getProducts(opts?: {
  categoryId?: number;
  search?: string;
  featured?: boolean;
  limit?: number;
  tag?: string;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(products.active, true)];
  if (opts?.categoryId) conditions.push(eq(products.categoryId, opts.categoryId));
  if (opts?.featured) conditions.push(eq(products.featured, true));
  if (opts?.search) {
    conditions.push(
      or(
        like(products.name, `%${opts.search}%`),
        like(products.brand, `%${opts.search}%`)
      ) as ReturnType<typeof eq>
    );
  }
  if (opts?.tag) {
    conditions.push(sql`JSON_CONTAINS(COALESCE(${products.tags}, CAST('[]' AS JSON)), ${JSON.stringify(opts.tag)})` as ReturnType<typeof eq>);
  }
  return db
    .select()
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
    await db.update(products).set(payload).where(eq(products.id, data.id));
  } else {
    await db.insert(products).values(payload as any);
  }
}

export async function updateProductStock(productId: number, delta: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(products)
    .set({ stock: sql`${products.stock} + ${delta}` })
    .where(eq(products.id, productId));
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
  userId: number;
  shippingFullName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode?: string;
  shippingCountry: string;
  subtotal: string;
  shippingCost: string;
  total: string;
  paymentMethod?: "mpesa" | "paypal" | "stripe" | "card";
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(orders).values(data);
  const insertId = (result as unknown as [{ insertId: number }])[0]?.insertId;
  return insertId;
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

export async function getAllOrders(opts?: { limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
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
      notes: orders.notes,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      customerName: users.name,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
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
  method: "mpesa" | "paypal" | "stripe" | "card";
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
  status: "pending" | "completed" | "failed" | "refunded",
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
export async function getAdminStats() {
  const db = await getDb();
  if (!db) return {
    totalOrders: 0, totalRevenue: "0", totalUsers: 0, totalProducts: 0, totalCustomers: 0, pendingOrders: 0, recentOrders: [],
    monthlyRevenueData: [], productPerformanceData: [], categoryData: [], trafficSourceData: [], revenueData: [],
    trends: { revenue: 0, orders: 0, customers: 0, products: 0, pageViews: 0, conversion: 0, aov: 0, returning: 0 }
  };

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // Run all independent queries in parallel to drastically reduce lag
  const [
    [orderStats], [pendingStats], [userCount], [productCount],
    recentOrderRows, recentAllOrders, recent7DaysOrders, recentPageViews,
    allOrderItems, categorySalesData, userOrderCounts,
    [recentUsers], [pastUsers], [recentProducts], [recentViews], [pastViews]
  ] = await Promise.all([
    db.select({
      totalOrders: sql<number>`COUNT(*)`,
      totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN paymentStatus = 'paid' THEN total ELSE 0 END), 0)`,
    }).from(orders),
    db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(eq(orders.status, "pending")),
    db.select({ count: sql<number>`COUNT(*)` }).from(users),
    db.select({ count: sql<number>`COUNT(*)` }).from(products).where(eq(products.active, true)),
    db.select({
      id: orders.id, orderNumber: orders.orderNumber, status: orders.status, total: orders.total,
      paymentStatus: orders.paymentStatus, createdAt: orders.createdAt, customerName: users.name,
    }).from(orders).leftJoin(users, eq(orders.userId, users.id)).orderBy(desc(orders.createdAt)).limit(5),
    db.select({ total: orders.total, createdAt: orders.createdAt }).from(orders).where(and(sql`${orders.createdAt} >= ${sixMonthsAgo}`, eq(orders.paymentStatus, "paid"))),
    db.select({ total: orders.total, createdAt: orders.createdAt }).from(orders).where(and(sql`${orders.createdAt} >= ${sevenDaysAgo}`, eq(orders.paymentStatus, "paid"))),
    db.select({ path: pageViews.path, createdAt: pageViews.createdAt }).from(pageViews).where(sql`${pageViews.createdAt} >= ${sevenDaysAgo}`),
    db.select().from(orderItems),
    db.select({ categoryName: categories.name, subtotal: orderItems.subtotal }).from(orderItems).innerJoin(products, eq(orderItems.productId, products.id)).innerJoin(categories, eq(products.categoryId, categories.id)),
    db.select({ userId: orders.userId, count: sql<number>`COUNT(*)` }).from(orders).groupBy(orders.userId),
    db.select({ count: sql<number>`COUNT(*)` }).from(users).where(sql`${users.createdAt} >= ${thirtyDaysAgo}`),
    db.select({ count: sql<number>`COUNT(*)` }).from(users).where(sql`${users.createdAt} >= ${sixtyDaysAgo} AND ${users.createdAt} < ${thirtyDaysAgo}`),
    db.select({ count: sql<number>`COUNT(*)` }).from(products).where(sql`${products.createdAt} >= ${thirtyDaysAgo}`),
    db.select({ count: sql<number>`COUNT(*)` }).from(pageViews).where(sql`${pageViews.createdAt} >= ${thirtyDaysAgo}`),
    db.select({ count: sql<number>`COUNT(*)` }).from(pageViews).where(sql`${pageViews.createdAt} >= ${sixtyDaysAgo} AND ${pageViews.createdAt} < ${thirtyDaysAgo}`)
  ]);

  // Monthly Revenue (last 6 months)
  const monthlyDataMap: Record<string, { month: string, revenue: number, orders: number, _ts: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = months[d.getMonth()];
    monthlyDataMap[m] = { month: m, revenue: 0, orders: 0, _ts: d.getTime() };
  }
  recentAllOrders.forEach(o => {
    const m = months[o.createdAt.getMonth()];
    if (monthlyDataMap[m]) {
      monthlyDataMap[m].revenue += parseFloat(o.total as string);
      monthlyDataMap[m].orders += 1;
    }
  });
  const monthlyRevenueData = Object.values(monthlyDataMap).sort((a, b) => a._ts - b._ts).map(({_ts, ...rest}) => rest);

  // Daily Revenue (last 7 days)
  const dailyDataMap: Record<string, { date: string, revenue: number, visitors: number, _ts: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${months[d.getMonth()]} ${d.getDate()}`;
    dailyDataMap[dateStr] = { date: dateStr, revenue: 0, visitors: 0, _ts: d.getTime() };
  }
  recent7DaysOrders.forEach(o => {
    const dateStr = `${months[o.createdAt.getMonth()]} ${o.createdAt.getDate()}`;
    if (dailyDataMap[dateStr]) dailyDataMap[dateStr].revenue += parseFloat(o.total as string);
  });
  recentPageViews.forEach(pv => {
    const dateStr = `${months[pv.createdAt.getMonth()]} ${pv.createdAt.getDate()}`;
    if (dailyDataMap[dateStr]) dailyDataMap[dateStr].visitors += 1;
  });
  const revenueData = Object.values(dailyDataMap).sort((a, b) => a._ts - b._ts).map(({_ts, ...rest}) => rest);

  // Product Performance
  const productSales: Record<string, number> = {};
  allOrderItems.forEach(item => {
    productSales[item.productName] = (productSales[item.productName] || 0) + item.quantity;
  });
  const productPerformanceData = Object.entries(productSales).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  // Category Sales
  const catSalesMap: Record<string, number> = {};
  categorySalesData.forEach(row => {
    catSalesMap[row.categoryName] = (catSalesMap[row.categoryName] || 0) + parseFloat(row.subtotal as string);
  });
  const categoryData = Object.entries(catSalesMap).map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales);

  const returningUsersCount = userOrderCounts.filter(u => Number(u.count) > 1).length;

  const currMonth = monthlyRevenueData[monthlyRevenueData.length - 1];
  const prevMonth = monthlyRevenueData[monthlyRevenueData.length - 2];
  
  const revenueTrend = prevMonth?.revenue ? ((currMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100 : 0;
  const ordersTrend = prevMonth?.orders ? ((currMonth.orders - prevMonth.orders) / prevMonth.orders) * 100 : 0;
  const customersTrend = pastUsers?.count ? ((Number(recentUsers?.count || 0) - Number(pastUsers.count)) / Number(pastUsers.count)) * 100 : 0;
  const pageViewsTrend = pastViews?.count ? ((Number(recentViews?.count || 0) - Number(pastViews.count)) / Number(pastViews.count)) * 100 : 0;

  // --- Dynamic Live Trends (30 vs 60 days) ---
  const thirtyDaysAgoTs = thirtyDaysAgo.getTime();
  const sixtyDaysAgoTs = sixtyDaysAgo.getTime();
  let recent30DaysOrdersCount = 0;
  let past30DaysOrdersCount = 0;
  let recent30DaysRevenue = 0;
  let past30DaysRevenue = 0;
  
  recentAllOrders.forEach(o => {
    const ts = o.createdAt.getTime();
    const rev = parseFloat(o.total as string);
    if (ts >= thirtyDaysAgoTs) {
      recent30DaysOrdersCount++;
      recent30DaysRevenue += rev;
    } else if (ts >= sixtyDaysAgoTs) {
      past30DaysOrdersCount++;
      past30DaysRevenue += rev;
    }
  });

  const currViews = Number(recentViews?.count || 0);
  const prevViews = Number(pastViews?.count || 0);
  const currConvRate = currViews > 0 ? (recent30DaysOrdersCount / currViews) * 100 : 0;
  const prevConvRate = prevViews > 0 ? (past30DaysOrdersCount / prevViews) * 100 : 0;
  const convTrend = prevConvRate > 0 ? ((currConvRate - prevConvRate) / prevConvRate) * 100 : 0;
  
  const currAov = recent30DaysOrdersCount > 0 ? recent30DaysRevenue / recent30DaysOrdersCount : 0;
  const prevAov = past30DaysOrdersCount > 0 ? past30DaysRevenue / past30DaysOrdersCount : 0;
  const aovTrend = prevAov > 0 ? ((currAov - prevAov) / prevAov) * 100 : 0;
  
  const returningRatio = Number(userCount?.count || 0) > 0 ? (returningUsersCount / Number(userCount!.count)) * 100 : 0;

  const trends = {
    revenue: Number(revenueTrend.toFixed(1)), orders: Number(ordersTrend.toFixed(1)), customers: Number(customersTrend.toFixed(1)),
    products: Number(recentProducts?.count ?? 0), pageViews: Number(pageViewsTrend.toFixed(1)), 
    conversion: Number(convTrend.toFixed(1)), aov: Number(aovTrend.toFixed(1)), returning: Number(returningRatio.toFixed(1))
  };

  // --- Actual PageView groupings ---
  const pathCounts: Record<string, number> = {};
  recentPageViews.forEach(pv => {
    let p = pv.path.split('?')[0];
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
    totalOrders: orderStats?.totalOrders ?? 0,
    totalRevenue: orderStats?.totalRevenue ?? "0",
    totalCustomers: userCount?.count ?? 0,
    totalProducts: productCount?.count ?? 0,
    pendingOrders: pendingStats?.count ?? 0,
    recentOrders: recentOrderRows,
    returningUsersCount,
    trends,
    monthlyRevenueData,
    revenueData,
    productPerformanceData: productPerformanceData.length ? productPerformanceData : [{ name: "No Sales", value: 1 }],
    categoryData: categoryData.length ? categoryData : [{ name: "No Sales", sales: 1 }],
    trafficSourceData: computedTrafficSourceData.length ? computedTrafficSourceData : [{ name: "No Traffic", value: 1 }],
  };
}

export async function getStoreStats() {
  const db = await getDb();
  if (!db) return { productCount: 0, customerCount: 0, avgRating: "0.0" };
  const [productCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(products).where(eq(products.active, true));
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
export async function getSetting(key: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return result[0]?.value ?? null;
}

export async function upsertSetting(key: string, value: unknown) {
  const db = await getDb();
  if (!db) return;
  await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
}

export async function getBanners(opts?: { activeOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  if (opts?.activeOnly) {
    return db.select().from(banners).where(eq(banners.active, true)).orderBy(desc(banners.createdAt));
  }
  return db.select().from(banners).orderBy(desc(banners.createdAt));
}

export async function upsertBanner(data: { id?: number; title: string; image: string; active?: boolean }) {
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
