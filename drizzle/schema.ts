import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  boolean,
  json,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Enums
export const deletionRequestStatusEnum = pgEnum("deletion_request_status", ["pending", "approved", "rejected"]);
export const userRoleEnum = pgEnum("user_role", ["user", "manager", "admin"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "payment_confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["mpesa", "paypal", "stripe", "card", "cod"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "failed", "refunded"]);
export const driverStatusEnum = pgEnum("driver_status", ["active", "inactive"]);
export const vehicleTypeEnum = pgEnum("vehicle_type", ["car", "motorcycle", "truck"]);
export const vehicleStatusEnum = pgEnum("vehicle_status", ["available", "assigned", "maintenance"]);
export const assignmentStatusEnum = pgEnum("assignment_status", ["active", "completed"]);
export const senderTypeEnum = pgEnum("sender_type", ["customer", "driver", "system"]);
export const inventoryTransferStatusEnum = pgEnum("inventory_transfer_status", [
  "pending_admin_approval",
  "pending_sender_fulfillment",
  "in_transit",
  "completed",
  "cancelled",
  "rejected"
]);


// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  password: varchar("password", { length: 256 }),
  role: userRoleEnum("role").default("user").notNull(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  pushSubscription: json("pushSubscription"),
  photoId: text("photo_id"),
  warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: 'set null' }),
  requiresPasswordChange: boolean("requires_password_change").default(false).notNull(),
  suspended: boolean("suspended").default(false).notNull(),
}, (table) => ({
  emailRoleUnique: uniqueIndex("idx_users_email_role").on(table.email, table.role),
  openIdUnique: uniqueIndex("idx_users_open_id").on(table.openId),
  nameIdx: index("users_name_idx").on(table.name),
  phoneIdx: index("users_phone_idx").on(table.phone),
  createdAtIdx: index("users_created_at_idx").on(table.createdAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  parentId: integer("parentId").references(() => categories.id, { onDelete: 'set null' }),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  icon: varchar("icon", { length: 64 }),
  featured: boolean("featured").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  activeIdx: index("categories_active_idx").on(table.active),
  slugIdx: index("categories_slug_idx").on(table.slug),
  parentIdIdx: index("categories_parent_id_idx").on(table.parentId),
}));

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// Products
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  categoryId: integer("categoryId").notNull().references(() => categories.id),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 256 }).notNull().unique(),
  description: text("description"),
  shortDescription: text("shortDescription"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  comparePrice: decimal("comparePrice", { precision: 10, scale: 2 }),
  stock: integer("stock").default(0).notNull(),
  brand: varchar("brand", { length: 128 }),
  sku: varchar("sku", { length: 128 }),
  images: json("images").$type<string[]>(),
  specifications: json("specifications").$type<Record<string, string>>(),
  tags: json("tags").$type<string[]>(),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("reviewCount").default(0),
  featured: boolean("featured").default(false),
  active: boolean("active").default(true),
  hasSerial: boolean("has_serial").default(false),
  warehouseId: integer("warehouseId").references(() => warehouses.id, { onDelete: 'set null' }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  slugUnique: uniqueIndex("idx_products_slug").on(table.slug),
  nameIdx: index("products_name_idx").on(table.name),
  brandIdx: index("products_brand_idx").on(table.brand),
  skuIdx: index("products_sku_idx").on(table.sku),
  activeIdx: index("products_active_idx").on(table.active),
  activeFeaturedIdx: index("idx_products_active_featured").on(table.active, table.featured),
  categoryIdIdx: index("products_category_id_idx").on(table.categoryId),
  createdAtIdx: index("products_created_at_idx").on(table.createdAt),
  featuredIdx: index("products_featured_idx").on(table.featured),
  tagsGinIdx: index("products_tags_gin_idx").using("gin", sql`(${table.tags}::jsonb)`),
}));

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// Addresses
export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar("fullName", { length: 256 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  addressLine: text("addressLine").notNull(),
  city: varchar("city", { length: 128 }).notNull(),
  postalCode: varchar("postalCode", { length: 32 }),
  country: varchar("country", { length: 128 }).notNull(),
  isDefault: boolean("isDefault").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("addresses_user_id_idx").on(table.userId),
}));

export type Address = typeof addresses.$inferSelect;
export type InsertAddress = typeof addresses.$inferInsert;

// Cart Items
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer("quantity").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("cart_items_user_id_idx").on(table.userId),
  productIdIdx: index("cart_items_product_id_idx").on(table.productId),
}));

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

// Orders
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("orderNumber", { length: 64 }).notNull().unique(),
  userId: integer("userId").references(() => users.id, { onDelete: 'set null' }),
  status: orderStatusEnum("status").default("pending").notNull(),
  shippingFullName: varchar("shippingFullName", { length: 256 }).notNull(),
  shippingEmail: varchar("shippingEmail", { length: 320 }),
  shippingPhone: varchar("shippingPhone", { length: 32 }).notNull(),
  shippingAddress: text("shippingAddress").notNull(),
  shippingCity: varchar("shippingCity", { length: 128 }).notNull(),
  shippingCounty: varchar("shippingCounty", { length: 128 }),
  shippingPostalCode: varchar("shippingPostalCode", { length: 32 }),
  shippingCountry: varchar("shippingCountry", { length: 128 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingCost: decimal("shippingCost", { precision: 10, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("paymentMethod"),
  paymentStatus: paymentStatusEnum("paymentStatus").default("pending").notNull(),
  paymentReference: varchar("paymentReference", { length: 256 }),
  trackingNumber: varchar("trackingNumber", { length: 128 }),
  estimatedDelivery: timestamp("estimatedDelivery"),
  notes: text("notes"),
  abandonedEmailSent: boolean("abandonedEmailSent").default(false).notNull(),
  deliveryAgentId: integer("delivery_agent_id").references(() => drivers.id, { onDelete: 'set null' }),
  deliveryOtp: varchar("delivery_otp", { length: 10 }),
  originWarehouseId: integer("origin_warehouse_id").references(() => warehouses.id),
  driverRating: integer("driver_rating"),
  driverFeedback: text("driver_feedback"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("orders_user_id_idx").on(table.userId),
  statusIdx: index("orders_status_idx").on(table.status),
  createdAtIdx: index("idx_orders_created_at").on(table.createdAt),
  orderNumberIdx: uniqueIndex("idx_orders_order_number").on(table.orderNumber),
  paymentStatusIdx: index("orders_payment_status_idx").on(table.paymentStatus),
  statusPaymentIdx: index("idx_orders_status_payment").on(table.status, table.paymentStatus),
  abandonedIdx: index("orders_abandoned_idx").on(table.paymentStatus, table.status, table.abandonedEmailSent, table.createdAt),
  createdAtPaymentStatusIdx: index("orders_created_at_payment_status_idx").on(table.createdAt, table.paymentStatus),
  createdAtStatusIdx: index("orders_created_at_status_idx").on(table.createdAt, table.status),
}));

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// Order Items
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: 'cascade' }),
  productName: varchar("productName", { length: 256 }).notNull(),
  productImage: text("productImage"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
}, (table) => ({
  orderIdIdx: index("order_items_order_id_idx").on(table.orderId),
  productIdIdx: index("order_items_product_id_idx").on(table.productId),
}));

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// Wishlists
export const wishlists = pgTable("wishlists", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: 'cascade' }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("wishlists_user_id_idx").on(table.userId),
  productIdIdx: index("wishlists_product_id_idx").on(table.productId),
}));

export type Wishlist = typeof wishlists.$inferSelect;

// Order Status History
export const orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: varchar("status", { length: 64 }).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("order_status_history_order_id_idx").on(table.orderId),
}));

export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;

// Payments
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  method: paymentMethodEnum("method").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  transactionId: varchar("transactionId", { length: 256 }),
  providerResponse: json("providerResponse"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("payments_order_id_idx").on(table.orderId),
  transactionIdIdx: index("payments_transaction_id_idx").on(table.transactionId),
  methodStatusIdx: index("payments_method_status_idx").on(table.method, table.status),
}));

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// Reviews
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: integer("rating").notNull(),
  title: varchar("title", { length: 256 }),
  body: text("body"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("reviews_product_id_idx").on(table.productId),
  userIdIdx: index("reviews_user_id_idx").on(table.userId),
  productUserUnique: unique("reviews_product_user_unique_idx").on(table.productId, table.userId),
}));

export type Review = typeof reviews.$inferSelect;

// Analytics
export const pageViews = pgTable("page_views", {
  id: serial("id").primaryKey(),
  path: varchar("path", { length: 256 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index("idx_page_views_created_at").on(table.createdAt),
}));

export type PageView = typeof pageViews.$inferSelect;

// Settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: json("value"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;

// Banners
export const banners = pgTable("banners", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  image: text("image").notNull(),
  active: boolean("active").default(true).notNull(),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Banner = typeof banners.$inferSelect;

// Drivers (for future use)
export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  email: varchar("email", { length: 320 }).unique(),
  licenseNumber: varchar("license_number", { length: 50 }),
  status: driverStatusEnum("status").default("active").notNull(),
  pin: varchar("pin", { length: 256 }).notNull(),
  photoUrl: text("photo_url"),
  pushSubscription: json("pushSubscription"),
  warehouseId: integer("warehouseId").references(() => warehouses.id, { onDelete: 'set null' }),
});

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;

// Vehicles
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  numberPlate: varchar("number_plate", { length: 20 }).notNull().unique(),
  type: vehicleTypeEnum("type").notNull(),
  status: vehicleStatusEnum("status").default("available").notNull(),
  warehouseId: integer("warehouseId").references(() => warehouses.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Vehicle = typeof vehicles.$inferSelect;

// Assignments
export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => drivers.id, { onDelete: 'cascade' }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  returnedAt: timestamp("returned_at"),
  status: assignmentStatusEnum("status").default("active").notNull(),
});

export type Assignment = typeof assignments.$inferSelect;

// Promotions
export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Promotion = typeof promotions.$inferSelect;

// Announcements
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  date: timestamp("date").notNull(),
  active: boolean("active").default(true).notNull(),
  image: text("image"),
  linkUrl: varchar("linkUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Announcement = typeof announcements.$inferSelect;

// Delivery Payouts
export const deliveryPayouts = pgTable("delivery_payouts", {
  id: serial("id").primaryKey(),
  agentId: integer("agentId").notNull().references(() => drivers.id, { onDelete: 'cascade' }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 64 }).default("pending").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
  transactionId: varchar("transactionId", { length: 256 }),
  mpesaConversationId: varchar("mpesaConversationId", { length: 256 }),
  mpesaOriginatorConversationId: varchar("mpesaOriginatorConversationId", { length: 256 }),
});

export type DeliveryPayout = typeof deliveryPayouts.$inferSelect;

// Product Views (Personalization)
export const productViews = pgTable("product_views", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: integer("userId").references(() => users.id, { onDelete: 'set null' }),
  sessionId: varchar("sessionId", { length: 256 }),
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("product_views_user_id_idx").on(table.userId),
  viewedAtIdx: index("product_views_viewed_at_idx").on(table.viewedAt),
}));

// AI Conversations
export const aiConversations = pgTable("ai_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: 'set null' }),
  userEmail: varchar("userEmail", { length: 320 }),
  role: varchar("role", { length: 64 }).notNull(),
  message: text("message").notNull(),
  messageType: varchar("messageType", { length: 64 }).default("chat").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index("ai_conversations_created_at_idx").on(table.createdAt),
  messageTypeIdx: index("ai_conversations_message_type_idx").on(table.messageType),
}));

// User Preferences
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  budgetMin: decimal("budgetMin", { precision: 10, scale: 2 }),
  budgetMax: decimal("budgetMax", { precision: 10, scale: 2 }),
  preferredBrands: json("preferredBrands").$type<string[]>().default([]),
  preferredCategories: json("preferredCategories").$type<number[]>().default([]),
  viewCount: integer("viewCount").default(0),
  purchaseCount: integer("purchaseCount").default(0),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Product Price History
export const productPriceHistory = pgTable("product_price_history", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: 'cascade' }),
  oldPrice: decimal("oldPrice", { precision: 10, scale: 2 }).notNull(),
  newPrice: decimal("newPrice", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  sales7d: integer("sales7d").notNull(),
  demand: varchar("demand", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Delivery Messages (Driver-Customer Chat)
export const deliveryMessages = pgTable("delivery_messages", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  senderType: senderTypeEnum("senderType").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("delivery_messages_order_id_idx").on(table.orderId),
  createdAtIdx: index("delivery_messages_created_at_idx").on(table.createdAt),
}));

export type DeliveryMessage = typeof deliveryMessages.$inferSelect;
export type InsertDeliveryMessage = typeof deliveryMessages.$inferInsert;

// Warehouses
export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  address: text("address").notNull(),
  country: varchar("country", { length: 128 }).notNull().default('Kenya'),
  county: varchar("county", { length: 128 }),
  city: varchar("city", { length: 128 }).notNull(),
  lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
  lng: decimal("lng", { precision: 10, scale: 7 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Warehouse = typeof warehouses.$inferSelect;
export type InsertWarehouse = typeof warehouses.$inferInsert;

// Product Units (Serialized items)
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
    warehouseId: integer("warehouse_id").references(() => warehouses.id),
  },
  (table) => ({
    productIdIdx: index("idx_product_units_product_id").on(table.productId),
    serialIdx: index("idx_product_units_serial").on(table.serialNumber),
    statusIdx: index("idx_product_units_status").on(table.status),
    barcodeIdx: index("idx_product_units_barcode").on(table.barcode),
    imeiIdx: index("idx_product_units_imei").on(table.imei),
  })
);

export type ProductUnit = typeof productUnits.$inferSelect;
export type InsertProductUnit = typeof productUnits.$inferInsert;

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

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InsertInventoryTransaction = typeof inventoryTransactions.$inferInsert;

// Product Inventory (Multi-Warehouse Partial Tracking)
export const productInventory = pgTable("product_inventory", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: 'cascade' }),
  warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  stock: integer("stock").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productWarehouseUnique: uniqueIndex("idx_product_inventory_unique").on(table.productId, table.warehouseId),
  productIdIdx: index("idx_product_inventory_product_id").on(table.productId),
  warehouseIdIdx: index("idx_product_inventory_warehouse_id").on(table.warehouseId),
}));

export type ProductInventory = typeof productInventory.$inferSelect;
export type InsertProductInventory = typeof productInventory.$inferInsert;

// Inventory Transfers (Workflow: Manager A -> Admin -> Manager B -> Driver -> Manager A)
export const inventoryTransfers = pgTable("inventory_transfers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: 'cascade' }),
  fromWarehouseId: integer("from_warehouse_id").references(() => warehouses.id, { onDelete: 'set null' }),
  toWarehouseId: integer("to_warehouse_id").notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  quantity: integer("quantity").notNull(),
  status: inventoryTransferStatusEnum("status").default("pending_admin_approval").notNull(),
  requestedBy: integer("requested_by").references(() => users.id, { onDelete: 'set null' }),
  approvedBy: integer("approved_by").references(() => users.id, { onDelete: 'set null' }),
  driverId: integer("driver_id").references(() => drivers.id, { onDelete: 'set null' }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  statusIdx: index("idx_inventory_transfers_status").on(table.status),
  fromWarehouseIdx: index("idx_inventory_transfers_from_warehouse").on(table.fromWarehouseId),
  toWarehouseIdx: index("idx_inventory_transfers_to_warehouse").on(table.toWarehouseId),
}));

export type InventoryTransfer = typeof inventoryTransfers.$inferSelect;
export type InsertInventoryTransfer = typeof inventoryTransfers.$inferInsert;

// Deletion Requests (Manager -> Admin)
export const deletionRequests = pgTable("deletion_requests", {
  id: serial("id").primaryKey(),
  itemType: varchar("item_type", { length: 64 }).notNull(),
  itemId: varchar("item_id", { length: 64 }).notNull(),
  itemName: varchar("item_name", { length: 256 }).notNull(),
  managerId: integer("manager_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  status: deletionRequestStatusEnum("status").default("pending").notNull(),
  adminId: integer("admin_id").references(() => users.id),
  warehouseId: integer("warehouseId").references(() => warehouses.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Staff Messages (Admin <-> Manager Chat)
export const staffMessages = pgTable("staff_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  senderIdx: index("idx_staff_messages_sender").on(table.senderId),
  receiverIdx: index("idx_staff_messages_receiver").on(table.receiverId),
  createdAtIdx: index("idx_staff_messages_created_at").on(table.createdAt),
}));

export type StaffMessage = typeof staffMessages.$inferSelect;
export type InsertStaffMessage = typeof staffMessages.$inferInsert;

// Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  resourceId: varchar("resource_id", { length: 255 }).notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
