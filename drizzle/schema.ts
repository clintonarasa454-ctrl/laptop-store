import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
  longtext,
  index,
  serial,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  password: varchar("password", { length: 256 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  nameIdx: index("name_idx").on(table.name),
  phoneIdx: index("phone_idx").on(table.phone),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  parentId: int("parentId"),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  imageUrl: longtext("imageUrl"),
  icon: varchar("icon", { length: 64 }),
  featured: boolean("featured").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  order: int("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  activeIdx: index("active_idx").on(table.active),
  slugIdx: index("slug_idx").on(table.slug),
  parentIdIdx: index("parent_id_idx").on(table.parentId),
}));

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// ─── Products ─────────────────────────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 256 }).notNull().unique(),
  description: text("description"),
  shortDescription: text("shortDescription"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  comparePrice: decimal("comparePrice", { precision: 10, scale: 2 }),
  stock: int("stock").default(0).notNull(),
  brand: varchar("brand", { length: 128 }),
  sku: varchar("sku", { length: 128 }),
  images: json("images").$type<string[]>(),
  specifications: json("specifications").$type<Record<string, string>>(),
  tags: json("tags").$type<string[]>(),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: int("reviewCount").default(0),
  featured: boolean("featured").default(false),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  nameIdx: index("name_idx").on(table.name),
  brandIdx: index("brand_idx").on(table.brand),
  skuIdx: index("sku_idx").on(table.sku),
  activeIdx: index("active_idx").on(table.active),
  categoryIdIdx: index("category_id_idx").on(table.categoryId),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
  featuredIdx: index("featured_idx").on(table.featured),
}));

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Addresses ────────────────────────────────────────────────────────────────
export const addresses = mysqlTable("addresses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fullName: varchar("fullName", { length: 256 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  addressLine: text("addressLine").notNull(),
  city: varchar("city", { length: 128 }).notNull(),
  postalCode: varchar("postalCode", { length: 32 }),
  country: varchar("country", { length: 128 }).notNull(),
  isDefault: boolean("isDefault").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Address = typeof addresses.$inferSelect;
export type InsertAddress = typeof addresses.$inferInsert;

// ─── Cart Items ───────────────────────────────────────────────────────────────
export const cartItems = mysqlTable("cart_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productId: int("productId").notNull(),
  quantity: int("quantity").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  productIdIdx: index("product_id_idx").on(table.productId),
}));

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 64 }).notNull().unique(),
  userId: int("userId"),
  status: mysqlEnum("status", [
    "pending",
    "payment_confirmed",
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "refunded",
  ]).default("pending").notNull(),
  // Shipping snapshot
  shippingFullName: varchar("shippingFullName", { length: 256 }).notNull(),
  shippingEmail: varchar("shippingEmail", { length: 320 }),
  shippingPhone: varchar("shippingPhone", { length: 32 }).notNull(),
  shippingAddress: text("shippingAddress").notNull(),
  shippingCity: varchar("shippingCity", { length: 128 }).notNull(),
  shippingCounty: varchar("shippingCounty", { length: 128 }),
  shippingPostalCode: varchar("shippingPostalCode", { length: 32 }),
  shippingCountry: varchar("shippingCountry", { length: 128 }).notNull(),
  // Financials
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingCost: decimal("shippingCost", { precision: 10, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  // Payment
  paymentMethod: mysqlEnum("paymentMethod", ["mpesa", "paypal", "stripe", "card", "cod"]),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  paymentReference: varchar("paymentReference", { length: 256 }),
  // Tracking
  trackingNumber: varchar("trackingNumber", { length: 128 }),
  estimatedDelivery: timestamp("estimatedDelivery"),
  notes: text("notes"),
  abandonedEmailSent: boolean("abandonedEmailSent").default(false).notNull(),
  deliveryAgentId: int("delivery_agent_id"),
  deliveryOtp: varchar("delivery_otp", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  statusIdx: index("status_idx").on(table.status),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
  orderNumberIdx: index("order_number_idx").on(table.orderNumber),
}));

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ─── Order Items ──────────────────────────────────────────────────────────────
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 256 }).notNull(),
  productImage: longtext("productImage"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  quantity: int("quantity").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
}, (table) => ({
  orderIdIdx: index("order_id_idx").on(table.orderId),
}));

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ─── Wishlists ────────────────────────────────────────────────────────────────
export const wishlists = mysqlTable("wishlists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productId: int("productId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  productIdIdx: index("product_id_idx").on(table.productId),
}));

export type Wishlist = typeof wishlists.$inferSelect;

// ─── Order Status History ─────────────────────────────────────────────────────
export const orderStatusHistory = mysqlTable("order_status_history", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  status: varchar("status", { length: 64 }).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;

// ─── Payments ─────────────────────────────────────────────────────────────────
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  method: mysqlEnum("method", ["mpesa", "paypal", "stripe", "card", "cod"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  transactionId: varchar("transactionId", { length: 256 }),
  providerResponse: json("providerResponse"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orderIdIdx: index("order_id_idx").on(table.orderId),
  transactionIdIdx: index("transaction_id_idx").on(table.transactionId),
}));

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ─── Product Reviews ──────────────────────────────────────────────────────────
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(),
  title: varchar("title", { length: 256 }),
  body: text("body"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("product_id_idx").on(table.productId),
  userIdIdx: index("user_id_idx").on(table.userId),
}));

export type Review = typeof reviews.$inferSelect;

// ─── Analytics ────────────────────────────────────────────────────────────────
export const pageViews = mysqlTable("page_views", {
  id: int("id").autoincrement().primaryKey(),
  path: varchar("path", { length: 256 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

export type PageView = typeof pageViews.$inferSelect;

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: json("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;

// ─── Content ──────────────────────────────────────────────────────────────────
export const banners = mysqlTable("banners", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  image: longtext("image").notNull(),
  active: boolean("active").default(true).notNull(),
  order: int("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Banner = typeof banners.$inferSelect;

export const promotions = mysqlTable("promotions", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  date: timestamp("date").notNull(),
  active: boolean("active").default(true).notNull(),
  image: longtext("image"),
  linkUrl: varchar("linkUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Delivery Agents ──────────────────────────────────────────────────────────
export const deliveryAgents = mysqlTable("delivery_agents", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  vehicleNumber: varchar("vehicle_number", { length: 50 }).notNull(),
  vehicleType: varchar("vehicle_type", { length: 50 }).default("bike"),
  isAvailable: boolean("is_available").default(true),
  pin: varchar("pin", { length: 256 }).notNull(),
});

export type DeliveryAgent = typeof deliveryAgents.$inferSelect;
export type InsertDeliveryAgent = typeof deliveryAgents.$inferInsert;

// ─── Delivery Payouts ───────────────────────────────────────────────────────
export const deliveryPayouts = mysqlTable('delivery_payouts', {
  id: int('id').autoincrement().primaryKey(),
  agentId: int('agent_id').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum('status', ['pending', 'completed', 'failed']).default('pending').notNull(),
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  transactionId: varchar('transaction_id', { length: 255 }),
  notes: varchar('notes', { length: 255 }),
  mpesaConversationId: varchar('mpesa_conversation_id', { length: 255 }),
  mpesaOriginatorConversationId: varchar('mpesa_originator_conversation_id', { length: 255 }),
});

export type DeliveryPayout = typeof deliveryPayouts.$inferSelect;
export type InsertDeliveryPayout = typeof deliveryPayouts.$inferInsert;

// ─── Product Views (Personalization) ───────────────────────────────────────────
export const productViews = mysqlTable("product_views", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 128 }),
  productId: int("productId").notNull(),
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  productIdIdx: index("product_id_idx").on(table.productId),
  viewedAtIdx: index("viewed_at_idx").on(table.viewedAt),
}));

export type ProductView = typeof productViews.$inferSelect;
export type InsertProductView = typeof productViews.$inferInsert;

// ─── AI Conversations (Analytics) ──────────────────────────────────────────────
export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  userEmail: varchar("userEmail", { length: 320 }),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  message: text("message").notNull(),
  messageType: mysqlEnum("messageType", ["chat", "product_recommendation", "order_tracking", "admin_query"]).default("chat").notNull(),
  sentiment: varchar("sentiment", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
  messageTypeIdx: index("message_type_idx").on(table.messageType),
}));

export type AIConversation = typeof aiConversations.$inferSelect;
export type InsertAIConversation = typeof aiConversations.$inferInsert;

// ─── User Preferences (Personalization) ─────────────────────────────────────────
export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  preferredBrands: json("preferredBrands").$type<string[]>().default([]),
  preferredCategories: json("preferredCategories").$type<number[]>().default([]),
  budgetMin: decimal("budgetMin", { precision: 10, scale: 2 }),
  budgetMax: decimal("budgetMax", { precision: 10, scale: 2 }),
  viewCount: int("viewCount").default(0),
  purchaseCount: int("purchaseCount").default(0),
  lastInteractionAt: timestamp("lastInteractionAt"),
  customerSegment: varchar("customerSegment", { length: 64 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
}));

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// ─── Product Price History (Dynamic Pricing) ──────────────────────────────────
export const productPriceHistory = mysqlTable("product_price_history", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  oldPrice: decimal("oldPrice", { precision: 10, scale: 2 }).notNull(),
  newPrice: decimal("newPrice", { precision: 10, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 256 }),
  sales7d: int("sales7d").default(0),
  demand: varchar("demand", { length: 64 }),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("product_id_idx").on(table.productId),
  changedAtIdx: index("changed_at_idx").on(table.changedAt),
}));

export type ProductPriceHistory = typeof productPriceHistory.$inferSelect;
export type InsertProductPriceHistory = typeof productPriceHistory.$inferInsert;
