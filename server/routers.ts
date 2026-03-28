import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  clearCart,
  createAddress,
  createOrder,
  createOrderItems,
  createPayment,
  deleteAddress,
  deleteProduct,
  getAllOrders,
  getAllPayments,
  getAllUsers,
  adminGlobalSearch,
  getAdminStats,
  getCartItems,
  getCategories,
  getCategoryBySlug,
  getDb,
  getOrderById,
  getUserByEmail,
  getOrderByNumber,
  getOrderItems,
  getOrderStatusHistory,
  getOrdersByUser,
  getPaymentByOrder,
  getProductsByIds,
  getProductById,
  getProductBySlug,
  getProductReviews,
  addProductReview,
  getProducts,
  getUserAddresses,
  removeCartItem,
  getStoreStats,
  updateOrderStatus,
  updatePaymentStatus,
  updateProductStock,
  upsertCartItem,
  upsertCategory,
  upsertProduct,
  getSetting,
  upsertSetting,
  getWishlist,
  toggleWishlistItem,
  getBanners,
  upsertBanner,
  deleteBanner,
  getPromotions,
  upsertPromotion,
  deletePromotion,
  trackPageView,
  getAnnouncements,
  upsertAnnouncement,
  deleteAnnouncement,
  logProductView,
  getUserProductViews,
  logAIConversation,
  getAIConversationStats,
  getUserPreferences,
  updateUserPreferences,
  getUserSegments,
  logPriceChange,
  getPricingSuggestions,
  getDemandPrediction,
} from "./db";
import { eq, and, lt, or, like, sql, inArray, desc } from "drizzle-orm";
import { users, categories as categoriesSchema, banners as bannersSchema, orders, payments, deliveryAgents, products, deliveryPayouts } from "../drizzle/schema";
import nodemailer from "nodemailer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import Stripe from "stripe";
import { getVerificationEmailHtml, getResetPasswordEmailHtml, getOrderConfirmationEmailHtml, getShippingNotificationEmailHtml, getAbandonedCartEmailHtml } from "./emailTemplates";
import { getPaypalAccessToken, getMpesaAccessToken, getMpesaTimestamp, formatMpesaPhone, initiateB2CPayout } from "./paymentUtils";
import { makeRequest } from "./_core/map";
import OpenAI from "openai";

// ─── Simple In-Memory Cache ───────────────────────────────────────────────────
const serverCache = new Map<string, { data: any, expires: number }>();

function getCache<T>(key: string): T | null {
  const cached = serverCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  return null;
}
function setCache(key: string, data: any, ttlSeconds: number) {
  serverCache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}
function clearCachePrefix(prefix: string) {
  for (const key of serverCache.keys()) {
    if (key.startsWith(prefix)) serverCache.delete(key);
  }
}

// ─── Admin guard ──────────────────────────────────────────────────────────────
// Always require admin role for admin procedures. Tests expect FORBIDDEN for
// non-admin users, so enforce role checks regardless of NODE_ENV.
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = scryptSync(password, salt, 64);
  return timingSafeEqual(keyBuffer, derivedKey);
}

// ─── Natural Language Search Parser ──────────────────────────────────────────
async function parseNaturalLanguageQuery(query: string) {
  let search = query;
  let minPrice: string | undefined;
  let maxPrice: string | undefined;
  let brand: string | undefined;
  let categoryId: number | undefined;
  let sortBy: "newest" | "price_asc" | "price_desc" | undefined;
  let featured: boolean | undefined;

  // Extract "between X and Y"
  const betweenMatch = search.match(/between\s*\$?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:and|to|-)\s*\$?(\d+(?:,\d{3})*(?:\.\d+)?)/i);
  if (betweenMatch) {
    minPrice = betweenMatch[1].replace(/,/g, '');
    maxPrice = betweenMatch[2].replace(/,/g, '');
    search = search.replace(betweenMatch[0], '');
  }

  // Extract max prices ("under 1000", "less than $500", "< 2000")
  const maxMatch = search.match(/(?:under|less than|below|cheaper than|<)\s*\$?(\d+(?:,\d{3})*(?:\.\d+)?)/i);
  if (maxMatch) {
    maxPrice = maxMatch[1].replace(/,/g, '');
    search = search.replace(maxMatch[0], '');
  }

  // Extract min prices ("over 1000", "more than $500", "> 2000")
  const minMatch = search.match(/(?:over|more than|above|expensive than|>)\s*\$?(\d+(?:,\d{3})*(?:\.\d+)?)/i);
  if (minMatch) {
    minPrice = minMatch[1].replace(/,/g, '');
    search = search.replace(minMatch[0], '');
  }

  // Extract Sort Intent
  if (/(?:cheap|affordable|budget|lowest price)/i.test(search)) {
    sortBy = "price_asc";
    search = search.replace(/\b(cheap|affordable|budget|lowest price)\b/gi, '');
  } else if (/(?:expensive|premium|highest price)/i.test(search)) {
    sortBy = "price_desc";
    search = search.replace(/\b(expensive|premium|highest price)\b/gi, '');
  } else if (/(?:new|latest|recent)/i.test(search)) {
    sortBy = "newest";
    search = search.replace(/\b(new|latest|recent)\b/gi, '');
  }

  // Extract Deals/Featured Intent
  if (/(?:deal|sale|discount|offer)s?\b/i.test(search)) {
    featured = true;
    search = search.replace(/\b(deal|sale|discount|offer)s?\b/gi, '');
  }

  // Extract Categories
  const allCats = await getCategories();
  for (const c of allCats) {
    const regex = new RegExp(`\\b${c.name.replace(/s$/i, '')}s?\\b|\\b${c.slug}\\b`, 'i');
    if (regex.test(search)) {
      categoryId = c.id;
      search = search.replace(regex, '');
      break;
    }
  }

  // Extract known brands
  const brandsSetting = await getSetting("brands");
  const availableBrands = Array.isArray(brandsSetting) ? brandsSetting : ["Samsung", "Dell", "HP", "Lenovo", "Asus", "Apple", "Acer", "MSI", "Razer", "Alienware", "Microsoft"];
  
  for (const b of availableBrands) {
    const regex = new RegExp(`\\b${b}\\b`, 'i');
    if (regex.test(search)) {
      brand = b;
      search = search.replace(regex, '');
      break; 
    }
  }

  // Clean up empty terms and leftover conjunctions
  search = search.replace(/\s+/g, ' ').trim();
  search = search.replace(/^(for|with|and|the|a|in|on)\b|\b(for|with|and|the|a|in|on)$/gi, '').trim();
  
  return { search: search || undefined, minPrice, maxPrice, brand, categoryId, sortBy, featured };
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "default_jwt_secret_for_development_only");

export const appRouter = router({
  system: systemRouter,

  // ─── AI Assistant ──────────────────────────────────────────────────────────
  ai: router({
    chat: publicProcedure
      .input(z.object({
        message: z.string().min(1),
        history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).default([]),
        cartContext: z.array(z.object({ productId: z.number(), quantity: z.number() })).optional(),
        userId: z.number().optional(),
        userEmail: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (!process.env.GROQ_API_KEY) {
          return { reply: "I'm offline right now! Please ask the store administrator to configure the `GROQ_API_KEY` in the environment variables." };
        }
        
        const groq = new OpenAI({ 
          apiKey: process.env.GROQ_API_KEY,
          baseURL: "https://api.groq.com/openai/v1"
        });
        const db = await getDb();

        // ─── Detect message type ───
        let messageType: "product_recommendation" | "order_tracking" | "chat" = "chat";
        if (input.message.toLowerCase().includes("order") || input.message.toLowerCase().includes("track")) {
          messageType = "order_tracking";
        } else if (input.message.toLowerCase().includes("find") || input.message.toLowerCase().includes("recommend") || input.message.toLowerCase().includes("laptop")) {
          messageType = "product_recommendation";
        }

        // ─── Detect deep search request ───
        const enableDeepSearch = /deep\s+search|broader\s+search|external\s+search|research|compare\s+market|market\s+comparison|what\s+else|similar\s+alternatives|industry\s+options/i.test(input.message);
        let deepSearchNotice = "";
        if (enableDeepSearch) {
          deepSearchNotice = "\n\n[Deep search mode enabled - I can reference external sources and broader market options]";
        }

        // ─── Build cart context ───
        let cartInfo = "";
        const cartProductIds = new Set<number>();
        if (db && input.cartContext && input.cartContext.length > 0) {
          const productIds = input.cartContext.map(i => i.productId);
          productIds.forEach(id => cartProductIds.add(id));
          const cartProds = await db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, productIds));
          const cartDetails = input.cartContext.map(item => {
            const p = cartProds.find(cp => cp.id === item.productId);
            return p ? `${item.quantity}x ${p.name}` : null;
          }).filter(Boolean);
          if (cartDetails.length > 0) {
            cartInfo = `\n\nThe user currently has these items in their cart: ${cartDetails.join(", ")}. Do not recommend these exact items again unless specifically asked.`;
          }
        }

        // ─── Personalization Context ───
        let personalizationContext = "";
        if (db && input.userId) {
          try {
            const userPrefs = await getUserPreferences(input.userId);
            if (userPrefs?.preferredBrands?.length > 0 || userPrefs?.preferredCategories?.length > 0) {
              const brandStr = userPrefs.preferredBrands?.join(", ") || "";
              const budgetStr = userPrefs.budgetMin && userPrefs.budgetMax 
                ? `KES ${parseFloat(userPrefs.budgetMin as any).toLocaleString()} - KES ${parseFloat(userPrefs.budgetMax as any).toLocaleString()}`
                : "";
              personalizationContext = `\n\nBased on ${userPrefs.viewCount || 0} product views, this user prefers: ${[brandStr, budgetStr].filter(Boolean).join(", ")}. Tailor recommendations accordingly.`;
            }
          } catch (e) {
            // Silent fail
          }
        }

        // ─── Store Context (Categories & Brands) ───
        let storeContext = "";
        if (db) {
          try {
            const allCats = await getCategories();
            const catNames = allCats.filter(c => c.active !== false).map(c => c.name).join(", ");
            const brandsSetting = await getSetting("brands");
            const brandNames = Array.isArray(brandsSetting) ? brandsSetting.join(", ") : "Samsung, Dell, HP, Lenovo, Asus, Apple, Acer";
            storeContext = `\n\n**Store Catalog Info:**\nWe sell products in these categories: ${catNames}.\nAvailable brands include: ${brandNames}.`;
          } catch(e) {}
        }

        // ─── Intelligent Product Search ───
        let productContext = "";
        if (db) {
          try {
            const parsedQuery = await parseNaturalLanguageQuery(input.message);
            
            if (messageType === "product_recommendation" || parsedQuery.search || parsedQuery.brand || parsedQuery.categoryId) {
              let recommendations = await getProducts({ 
                search: parsedQuery.search,
                categoryId: parsedQuery.categoryId,
                limit: 20
              });

              // Apply Node-side filtering for price and brand
              if (parsedQuery.minPrice) recommendations = recommendations.filter((p: any) => parseFloat(p.price as any) >= parseFloat(parsedQuery.minPrice!));
              if (parsedQuery.maxPrice) recommendations = recommendations.filter((p: any) => parseFloat(p.price as any) <= parseFloat(parsedQuery.maxPrice!));
              if (parsedQuery.brand) recommendations = recommendations.filter((p: any) => p.brand?.toLowerCase() === parsedQuery.brand!.toLowerCase());

              // Fallback if no direct match but they want recommendations
              if (recommendations.length === 0 && messageType === "product_recommendation") {
                recommendations = await getProducts({ featured: true, limit: 10 });
                if (recommendations.length === 0) recommendations = await getProducts({ limit: 10 });
              }

              // Prioritize products with high stock levels
              recommendations.sort((a: any, b: any) => (b.stock || 0) - (a.stock || 0));

              if (recommendations.length > 0) {
                const relevantProducts = recommendations
                  .filter(p => !cartProductIds.has(p.id))
                  .map(p => {
                    const specs = p.specifications 
                      ? Object.entries(p.specifications).map(([k, v]) => `${k}: ${v}`).join(", ")
                      : "";
                    return {
                      id: p.id,
                      name: p.name,
                      brand: p.brand,
                      price: p.price,
                      rating: p.rating,
                      specs: specs,
                      slug: p.slug,
                      stock: p.stock,
                    };
                  });

                if (relevantProducts.length > 0) {
                  productContext = `\n\nWe have these matching products available:\n${relevantProducts.slice(0, 5).map((p, idx) => 
                    `${idx + 1}. **${p.name}** by ${p.brand || "Unknown"}\n` +
                    `   Price: KES ${parseFloat(p.price as any).toLocaleString()}\n` +
                    `   Rating: ${p.rating ? parseFloat(p.rating as any).toFixed(1) + "★" : "New"}\n` +
                    `   Specs: ${p.specs || "Standard specs"}\n` +
                    `   In Stock: ${p.stock > 0 ? "Yes" : "Out of Stock"}\n` +
                    `   View Details`
                  ).join("\n")}`;
                }
              }
            }
          } catch(e) {}
        }

        // ─── Order Tracking Context ───
        let orderContext = "";
        const messageLower = input.message.toLowerCase();
        if (db && (messageLower.includes("order") || messageLower.includes("track") || messageLower.includes("delivery") || messageLower.includes("ship"))) {
          const orderMatch = input.message.match(/(?:order\s+)?([A-Z]{0,3}[-]?[0-9]{4,8})/i);
          if (orderMatch) {
            try {
              const order = await getOrderByNumber(orderMatch[1]);
              if (order) {
                const statusDescriptions: Record<string, string> = {
                  pending: "Your order has been received and is being processed",
                  payment_confirmed: "Payment confirmed! Your order is being prepared",
                  processing: "Your order is being prepared for shipment",
                  shipped: "Your order has been shipped!",
                  out_for_delivery: "Your order is out for delivery today",
                  delivered: "Your order has been delivered",
                  cancelled: "This order has been cancelled",
                  refunded: "This order has been refunded"
                };
                orderContext = `\n\n**Order Status Lookup:**\nOrder #${order.orderNumber}\nStatus: ${order.status}\nUpdate: ${statusDescriptions[order.status as any] || "No information available"}\nShipping to: ${order.shippingCity || order.shippingAddress}\nEstimated delivery: 3-5 business days from shipment`;
              }
            } catch (e) {
              // Silent fail
            }
          }
        }

        // ─── Demand Prediction Context (for high-demand products) ───
        let demandContext = "";
        if (db && messageType === "product_recommendation") {
          try {
            const predictions = await getDemandPrediction(7);
            if (predictions.length > 0) {
              const topDemand = predictions.slice(0, 2);
              demandContext = `\n\n**Currently In High Demand:**\n${topDemand.map(p => `- ${p.productName} (${p.salesCount} sold this week)`).join("\n")}`;
            }
          } catch (e) {
            // Silent fail
          }
        }

        // ─── Pricing Suggestions Context ───
        let pricingContext = "";
        if (db && messageLower.includes("price") || messageLower.includes("discount")) {
          try {
            const suggestions = await getPricingSuggestions();
            if (suggestions.length > 0) {
              pricingContext = `\n\nCurrent strong sellers: ${suggestions.slice(0, 3).map((s: any) => s.name).join(", ")}`;
            }
          } catch (e) {
            // Silent fail
          }
        }

        let baseRules = `⚠️ CRITICAL RULES - FOLLOW STRICTLY:
- ONLY recommend products from the list provided below in "We have these matching products available"
- NEVER mention products not in our database or from other stores/websites
- NEVER make up product names or specifications
- NEVER tell customers to search the internet for products
- If asked about a product not in our list, say: "I don't have that specific model in stock, but I can recommend similar alternatives from our inventory"
- When NO products match the search, offer to help them narrow down their requirements`;

        let deepSearchRules = `⚠️ DEEP SEARCH MODE - RULES:
- You can reference external sources, market comparisons, and broader industry options
- When mentioning external products, clearly distinguish them from our catalog with "➜ From other markets:" prefix
- Prioritize our database products first, then suggest external alternatives if requested
- Always emphasize products we have in stock before suggesting external options
- Format external product mentions clearly so users know they're not in our inventory`;

        const systemPrompt = `You are an expert AI sales assistant for a tech store specializing in laptops and accessories. Your role is to:
1. Help customers find the perfect laptop or accessory from our catalog
2. Answer technical questions clearly and accurately
3. Provide honest recommendations based on budget and needs
4. Help track orders and deliveries
5. Help admins upload and manage bulk products (detect when user says "upload", "bulk add", "add products")
6. Reference specific products when relevant
7. Be concise, friendly, and professional

${enableDeepSearch ? deepSearchRules : baseRules}

IMPORTANT: When you mention a specific product, format as a clickable link using [Product Name](/products/slug-name) format.
For product uploads: When asked to help add products, ask for CSV data or descriptions and help structure the data.
Keep responses under 3 sentences unless asked for more detail.${cartInfo}${personalizationContext}${storeContext}${productContext}${demandContext}${pricingContext}${orderContext}`;

        let messages: any[] = [
          { role: "system", content: systemPrompt },
          ...input.history,
          { role: "user", content: input.message }
        ];

        // Call Groq API
        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        });

        let reply = response.choices[0].message.content || "I couldn't process that right now. Please try again.";
        
        // ─── Validate response: Ensure AI only recommended products from our database ───
        if (db && productContext && productContext.includes("matching products")) {
          try {
            // Extract all product names that were provided to the AI
            const allProducts = await getProducts({ limit: 1000 });
            const productNames = new Set(allProducts.map(p => p.name.toLowerCase()));
            
            // Check if response mentions any product-like terms that aren't in our database
            const possibleProductMatches = reply.match(/\*\*([^*]+)\*\*/g) || [];
            for (const match of possibleProductMatches) {
              const productName = match.replace(/\*\*/g, "").toLowerCase().trim();
              if (productName.length > 3 && !productNames.has(productName)) {
                // This looks like a product name that's not in our database
                const foundInContext = productContext.toLowerCase().includes(productName);
                if (!foundInContext) {
                  // Remove this product reference and warn the user
                  reply = reply.replace(match, "_[Product not currently available]_");
                }
              }
            }
          } catch (e) {
            // Silent fail - validation error shouldn't break the response
          }
        }
        
        // ─── Log conversation to database ───
        if (db) {
          try {
            await logAIConversation(input.userId || null, input.userEmail || null, "user", input.message, messageType);
            await logAIConversation(input.userId || null, input.userEmail || null, "assistant", reply, messageType);
            
            // Update user preferences (track interactions)
            if (input.userId) {
              const userPrefs = await getUserPreferences(input.userId);
              if (userPrefs) {
                await updateUserPreferences(input.userId, {
                  viewCount: (userPrefs.viewCount || 0) + 1,
                  lastInteractionAt: new Date(),
                });
              } else {
                await updateUserPreferences(input.userId, {
                  viewCount: 1,
                  lastInteractionAt: new Date(),
                  customerSegment: messageType === "product_recommendation" ? "browser" : "shopper"
                });
              }
            }
          } catch (e) {
            // Silent fail - don't break the chat if logging fails
          }
        }

        return { reply: reply + deepSearchNotice };
      }),

    // ─── Admin Chat for Dashboard ───
    adminChat: adminProcedure
      .input(z.object({
        message: z.string().min(1),
        history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).default([]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!process.env.GROQ_API_KEY) {
          return { reply: "Admin AI is offline. Please configure GROQ_API_KEY." };
        }
        
        const groq = new OpenAI({ 
          apiKey: process.env.GROQ_API_KEY,
          baseURL: "https://api.groq.com/openai/v1"
        });
        const db = await getDb();

        // ─── Admin Context: Sales Stats ───
        let statsContext = "";
        try {
          if (db) {
            const totalOrdersResult = await db.select({ count: sql<number>`COUNT(*)` }).from(orders);
            const totalOrders = totalOrdersResult[0]?.count || 0;
            
            const totalRevenueResult = await db.select({ sum: sql<number>`SUM(CAST(${orders.totalAmount} AS DECIMAL(10,2)))` }).from(orders).where(eq(orders.status, 'delivered'));
            const totalRevenue = totalRevenueResult[0]?.sum || 0;
            
            const topProductsResult = await db.select({ name: products.name, count: sql<number>`COUNT(*)` })
              .from(orderItems)
              .leftJoin(products, eq(orderItems.productId, products.id))
              .groupBy(orderItems.productId)
              .orderBy(desc(sql<number>`COUNT(*)`))
              .limit(3);
            
            statsContext = `\n\n**Store Analytics:**\nTotal Orders: ${totalOrders}\nTotal Revenue: KES ${parseFloat(totalRevenue).toLocaleString()}\nTop Products: ${topProductsResult.map(p => p.name).join(", ")}`;
          }
        } catch (e) {
          // Silent fail
        }

        // ─── Admin Context: Store Catalog ───
        let storeContext = "";
        try {
          if (db) {
            const allCats = await getCategories();
            const catNames = allCats.filter(c => c.active !== false).map(c => c.name).join(", ");
            const brandsSetting = await getSetting("brands");
            const brandNames = Array.isArray(brandsSetting) ? brandsSetting.join(", ") : "Samsung, Dell, HP, Lenovo, Asus, Apple, Acer";
            storeContext = `\n\n**Store Catalog Info:**\nCategories: ${catNames}\nBrands: ${brandNames}`;
          }
        } catch (e) {}

        // ─── Admin Context: Recent Orders ───
        let recentOrdersContext = "";
        try {
          if (db) {
            const recentOrders = await db.select({ 
              orderNumber: orders.orderNumber, 
              status: orders.status, 
              totalAmount: orders.totalAmount,
              customerName: orders.shippingFullName
            })
              .from(orders)
              .orderBy(desc(orders.createdAt))
              .limit(5);
            
            if (recentOrders.length > 0) {
              recentOrdersContext = `\n\n**Recent Orders:**\n${recentOrders.map(o => 
                `${o.orderNumber}: ${o.customerName} - KES ${parseFloat(o.totalAmount as any).toLocaleString()} (${o.status})`
              ).join("\n")}`;
            }
          }
        } catch (e) {
          // Silent fail
        }

        const systemPrompt = `You are an expert AI assistant for store management. Your role is to:
1. Help manage inventory and product catalog (ONLY from our database)
2. Assist with store analytics and reporting
3. Provide insights on sales trends and customer behavior
4. Help with order management and customer support
5. Provide actionable recommendations for business growth
6. Answer questions about store operations

⚠️ CRITICAL: 
- ONLY reference products that exist in our database catalog
- NEVER suggest products from external sources
- When discussing products, use ONLY the products listed in our system

When users ask to update products or prices, acknowledge the action and ask for confirmation details first.
Be professional, concise, and data-driven.${statsContext}${storeContext}${recentOrdersContext}`;

        let messages: any[] = [
          { role: "system", content: systemPrompt },
          ...input.history,
          { role: "user", content: input.message }
        ];

        // Call Groq API
        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        });

        const reply = response.choices[0].message.content || "I couldn't process that right now. Please try again.";
        return { reply };
      }),
  }),

  // ─── Public Store Stats ──────────────────────────────────────────────────────
  store: router({
    stats: publicProcedure.query(async () => {
      const cached = getCache("storeStats");
      if (cached) return cached;
      const data = await getStoreStats();
      setCache("storeStats", data, 60); // Cache stats for 1 minute
      return data;
    }),
    trackPageView: publicProcedure
      .input(z.object({ path: z.string() }))
      .mutation(async ({ input }) => {
        await trackPageView(input.path);
        return { success: true };
      }),
  }),

  // ─── Public Settings & Content ───────────────────────────────────────────────
  settings: router({
    public: publicProcedure
      .input(z.object({ keys: z.array(z.string()) }))
      .query(async ({ input }) => {
        const cacheKey = `settings-${input.keys.sort().join(",")}`;
        const cached = getCache<Record<string, any>>(cacheKey);
        if (cached) return cached;

        // Only allow public-facing settings to be queried unauthenticated
        const allowed = ["general", "appearance", "social", "payment_methods", "brands", "shipping"];
        const result: Record<string, any> = {};
        for (const k of input.keys) {
          if (allowed.includes(k)) {
            result[k] = await getSetting(k);
          }
        }
        setCache(cacheKey, result, 86400); // Cache for 24 hours (cleared automatically on admin update)
        return result;
      }),
  }),

  content: router({
    banners: publicProcedure.query(async () => {
      const cached = getCache("banners-active");
      if (cached) return cached;
      const data = await getBanners({ activeOnly: true });
      setCache("banners-active", data, 86400); // Cache for 24 hours
      return data;
    }),
    promotions: publicProcedure.query(async () => {
      const cached = getCache("promotions-active");
      if (cached) return cached;
      const data = await getPromotions({ activeOnly: true });
      setCache("promotions-active", data, 86400); // Cache for 24 hours
      return data;
    }),
    announcements: publicProcedure.query(async () => {
      const cached = getCache("announcements-active");
      if (cached) return cached;
      const data = await getAnnouncements({ activeOnly: true });
      setCache("announcements-active", data, 86400); // Cache for 24 hours
      return data;
    }),
  }),

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const isSecure = ctx.req.protocol === "https" || ctx.req.headers["x-forwarded-proto"] === "https";
      const cookieOpts = {
        httpOnly: true, path: "/", secure: isSecure, sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
      };
      if (typeof (ctx.res as any).clearCookie === "function") {
        (ctx.res as any).clearCookie(COOKIE_NAME, { ...cookieOpts, maxAge: -1 });
      } else {
        const sameSiteStr = cookieOpts.sameSite === "none" ? "None" : "Lax";
        (ctx.res as any).setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=${sameSiteStr}${isSecure ? "; Secure" : ""}`);
      }
      return { success: true } as const;
    }),
    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(2),
          email: z.string().email(),
          password: z.string()
            .min(8, "Password must be at least 8 characters")
            .regex(/[A-Z]/, "Password must contain an uppercase letter")
            .regex(/[a-z]/, "Password must contain a lowercase letter")
            .regex(/[0-9]/, "Password must contain a number")
            .regex(/[^A-Za-z0-9]/, "Password must contain a symbol"),
          claimOrderNumber: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed. Please check your DATABASE_URL variable." });

        try {
          const existing = await getUserByEmail(input.email);
          if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });

          const openId = `local-${nanoid()}`;
          const hashedPassword = hashPassword(input.password);
          
          await db.insert(users).values({
            openId,
            name: input.name,
            email: input.email,
            password: hashedPassword,
            loginMethod: "email",
            role: "user",
            lastSignedIn: new Date()
          });
        } catch (err: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `DB Error: ${err.message}` });
        }

        const user = await getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        if (input.claimOrderNumber) {
          await db.update(orders).set({ userId: user.id }).where(eq(orders.orderNumber, input.claimOrderNumber));
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const token = await new SignJWT({ email: input.email, purpose: "verify", otp })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("24h")
          .sign(JWT_SECRET);

        try {
          const emailSettings = await getSetting("email");
          const appearance = await getSetting("appearance");
          const general = await getSetting("general");
          
          const storeName = general?.storeName || "Store";
          const logoUrl = appearance?.logoUrl;
          const primaryColor = emailSettings?.emailButtonColor || appearance?.primaryColor || "#3b82f6";
          const storePhone = general?.phone || "";
          const contactEmail = general?.contactEmail || "support@example.com";
          
          const emailHtml = getVerificationEmailHtml({
            storeName, logoUrl, primaryColor, contactEmail, storePhone,
            name: input.name, otp
          });

          if (emailSettings?.smtpHost && emailSettings.smtpUser) {
             const transporter = nodemailer.createTransport({
               host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
               secure: Number(emailSettings.smtpPort) === 465,
               auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
               connectionTimeout: 10000,
               greetingTimeout: 10000,
               socketTimeout: 10000
             });
             await transporter.sendMail({
               from: `"${storeName}" <${emailSettings.smtpUser}>`, to: input.email, subject: `Verify your email - ${storeName}`, html: emailHtml
             });
          } else {
             console.log("No SMTP configured. Verification Code for", input.email, "is", otp);
          }
        } catch (err: any) { 
          console.error("Failed to send verification email", err); 
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Email sending failed: ${err.message}. Please check your SMTP settings.` });
        }

        return { success: true, token, email: input.email };
      }),
    login: publicProcedure
      .input(
        z.object({ 
          email: z.string().trim().toLowerCase().email("Please enter a valid email address"), 
          password: z.string().min(1, "Password is required") 
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed. Please check your DATABASE_URL variable." });

        let user;
        try {
          user = await getUserByEmail(input.email);
        } catch (err: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `DB Error: ${err.message}` });
        }

        if (!user || !user.password) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }

        const isValid = verifyPassword(input.password, user.password);
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }

        // Enforce email verification 
        if (user.emailVerified === false) {
          const emailSettings = await getSetting("email");
          const isSmtpConfigured = !!(emailSettings?.smtpHost && emailSettings?.smtpUser);
          if (isSmtpConfigured) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Please verify your email before logging in. Check your inbox." });
          } else if (db) {
            // Auto-verify the user in the database so they don't get locked out when SMTP is added later
            await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
            user.emailVerified = true;
          }
        }

        if (db) {
          await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
        }

        const token = await new SignJWT({ 
          id: user.id, 
          openId: user.openId,
          email: user.email,
          name: user.name,
          role: user.role 
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("7d")
          .sign(JWT_SECRET);

        const isSecure = ctx.req.protocol === "https" || ctx.req.headers["x-forwarded-proto"] === "https";
        const cookieOpts = {
          httpOnly: true, path: "/", secure: isSecure, sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
        };
        if (typeof (ctx.res as any).cookie === "function") {
          (ctx.res as any).cookie(COOKIE_NAME, token, { ...cookieOpts, maxAge: 604800000 });
        } else {
          const sameSiteStr = cookieOpts.sameSite === "none" ? "None" : "Lax";
          (ctx.res as any).setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Max-Age=604800; SameSite=${sameSiteStr}${isSecure ? "; Secure" : ""}`);
        }

        return { success: true };
      }),
    resetPasswordRequest: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const token = await new SignJWT({ email: user.email, name: user.name, purpose: "reset", otp })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("15m")
          .sign(JWT_SECRET);

        try {
          const emailSettings = await getSetting("email");
          const appearance = await getSetting("appearance");
          const general = await getSetting("general");
          
          const storeName = general?.storeName || "NexusTech Store";
          const logoUrl = appearance?.logoUrl;
          const primaryColor = emailSettings?.emailButtonColor || appearance?.primaryColor || "#3b82f6";
          const storePhone = general?.phone || "";
          const contactEmail = general?.contactEmail || "support@nexustech.com";
          
          const emailHtml = getResetPasswordEmailHtml({
            storeName, logoUrl, primaryColor, contactEmail, storePhone,
            name: user.name || 'there', otp
          });

          if (emailSettings?.smtpHost && emailSettings.smtpUser) {
             const transporter = nodemailer.createTransport({
               host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
               secure: Number(emailSettings.smtpPort) === 465,
               auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
               connectionTimeout: 10000,
               greetingTimeout: 10000,
               socketTimeout: 10000
             });
             await transporter.sendMail({
               from: `"${storeName}" <${emailSettings.smtpUser}>`, to: user.email, subject: `Password Reset Request - ${storeName}`,
               html: emailHtml
             });
          }
          else {
             console.log("No SMTP configured. Reset Code for", user.email, "is", otp);
          }
        } catch (err: any) { 
          console.error("Failed to send reset email", err); 
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Email sending failed: ${err.message}. Please check your SMTP settings.` });
        }
        return { success: true, token, email: user.email };
      }),
    resetPassword: publicProcedure
      .input(
        z.object({
          token: z.string(),
          code: z.string(),
          newPassword: z.string()
            .min(8, "Password must be at least 8 characters")
            .regex(/[A-Z]/, "Password must contain an uppercase letter")
            .regex(/[a-z]/, "Password must contain a lowercase letter")
            .regex(/[0-9]/, "Password must contain a number")
            .regex(/[^A-Za-z0-9]/, "Password must contain a symbol"),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const { payload } = await jwtVerify(input.token, JWT_SECRET);
          if (payload.purpose !== "reset" || !payload.email) throw new Error();
          if (payload.otp !== input.code) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Incorrect reset code" });
          }
          const user = await getUserByEmail(payload.email as string);
          if (!user) throw new Error();
          const db = await getDb();
          if (db) await db.update(users).set({ password: hashPassword(input.newPassword) }).where(eq(users.id, user.id));
          return { success: true };
        } catch (err: any) { 
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset token" }); 
        }
      }),
    verifyEmail: publicProcedure
      .input(z.object({ token: z.string(), code: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const { payload } = await jwtVerify(input.token, JWT_SECRET);
          if (payload.purpose !== "verify" || !payload.email) throw new Error();
          
          if (payload.otp !== input.code) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Incorrect verification code" });
          }
          
          const user = await getUserByEmail(payload.email as string);
          if (!user) throw new Error();
          
          const db = await getDb();
          if (db) await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
          
          return { success: true };
        } catch (err: any) { 
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired verification token" }); 
        }
      }),
    resendVerification: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        if (user.emailVerified) throw new TRPCError({ code: "BAD_REQUEST", message: "Email is already verified" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const token = await new SignJWT({ email: input.email, purpose: "verify", otp })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("24h")
          .sign(JWT_SECRET);

        try {
          const emailSettings = await getSetting("email");
          const appearance = await getSetting("appearance");
          const general = await getSetting("general");
          
          const storeName = general?.storeName || "Store";
          const logoUrl = appearance?.logoUrl;
          const primaryColor = emailSettings?.emailButtonColor || appearance?.primaryColor || "#3b82f6";
          const storePhone = general?.phone || "";
          const contactEmail = general?.contactEmail || "support@example.com";
          
          const emailHtml = getVerificationEmailHtml({
            storeName, logoUrl, primaryColor, contactEmail, storePhone,
            name: user.name || 'there', otp, isResend: true
          });

          if (emailSettings?.smtpHost && emailSettings.smtpUser) {
             const transporter = nodemailer.createTransport({
               host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
               secure: Number(emailSettings.smtpPort) === 465,
               auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
               connectionTimeout: 10000,
               greetingTimeout: 10000,
               socketTimeout: 10000
             });
             await transporter.sendMail({
               from: `"${storeName}" <${emailSettings.smtpUser}>`, to: input.email, subject: `Verify your email - ${storeName}`, html: emailHtml
             });
          } else {
             console.log("No SMTP configured. Verification Code for", input.email, "is", otp);
          }
        } catch (err: any) { 
          console.error("Failed to send verification email", err); 
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Email sending failed: ${err.message}. Please check your SMTP settings.` });
        }

        return { success: true, token, email: input.email };
      }),
    updateAdminProfile: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          currentPassword: z.string().min(1),
          newPassword: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (!user || !user.password) throw new TRPCError({ code: "BAD_REQUEST", message: "Account does not have a password set" });
        const isValid = verifyPassword(input.currentPassword, user.password);
        if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect current password" });
        const updateData: any = { name: input.name, email: input.email };
        if (input.newPassword) updateData.password = hashPassword(input.newPassword);
        await db.update(users).set(updateData).where(eq(users.id, user.id));
        return { success: true };
      }),
  }),

  // ─── Categories ────────────────────────────────────────────────────────────
  categories: router({
    list: publicProcedure.query(async () => {
      const cached = getCache("categories");
      if (cached) return cached;
      const data = await getCategories();
      setCache("categories", data, 86400); // Cache for 24 hours
      return data;
    }),
    bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(({ input }) =>
      getCategoryBySlug(input.slug)
    ),
  }),

  // ─── Products ──────────────────────────────────────────────────────────────
  products: router({
    facets: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { brands: {} as Record<string, number>, categories: {} as Record<number, number> };
      
      const allProducts = await db.select({
        categoryId: products.categoryId,
        brand: products.brand,
      }).from(products).where(eq(products.active, true));

      const brands: Record<string, number> = {};
      const categories: Record<number, number> = {};

      allProducts.forEach(p => {
        if (p.brand) brands[p.brand] = (brands[p.brand] || 0) + 1;
        categories[p.categoryId] = (categories[p.categoryId] || 0) + 1;
      });

      return { brands, categories };
    }),

    list: publicProcedure
      .input(
        z.object({
          categoryId: z.union([z.number(), z.array(z.number())]).optional(),
          search: z.string().optional(),
          tag: z.string().optional(),
          featured: z.boolean().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
          minPrice: z.string().optional(),
          maxPrice: z.string().optional(),
          brand: z.string().optional(),
          sortBy: z.enum(["newest", "price_asc", "price_desc"]).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        let finalSearch = input?.search;
        let finalMinPrice = input?.minPrice;
        let finalMaxPrice = input?.maxPrice;
        let finalBrand = input?.brand;
        let finalCategoryId = input?.categoryId;
        let finalSortBy = input?.sortBy;
        let finalFeatured = input?.featured;

        if (finalSearch) {
          const parsed = await parseNaturalLanguageQuery(finalSearch);
          finalSearch = parsed.search;
          if (parsed.minPrice && !finalMinPrice) finalMinPrice = parsed.minPrice;
          if (parsed.maxPrice && !finalMaxPrice) finalMaxPrice = parsed.maxPrice;
          if (parsed.brand && !finalBrand) finalBrand = parsed.brand;
          if (parsed.categoryId && !finalCategoryId) finalCategoryId = parsed.categoryId;
          if (parsed.sortBy && (!finalSortBy || finalSortBy === 'newest')) finalSortBy = parsed.sortBy;
          if (parsed.featured !== undefined && finalFeatured === undefined) finalFeatured = parsed.featured;
        }

        let products = await getProducts({ ...(input ?? {}), search: finalSearch, categoryId: finalCategoryId, featured: finalFeatured });
        
        // Server-side filtering before returning to the client
        if (finalMinPrice) products = products.filter((p: any) => parseFloat(p.price) >= parseFloat(finalMinPrice!));
        if (finalMaxPrice) products = products.filter((p: any) => parseFloat(p.price) <= parseFloat(finalMaxPrice!));
        if (finalBrand) products = products.filter((p: any) => p.brand?.toLowerCase() === finalBrand!.toLowerCase());
        if (finalSortBy) {
          products = products.sort((a: any, b: any) => {
            if (finalSortBy === "price_asc") return parseFloat(a.price) - parseFloat(b.price);
            if (finalSortBy === "price_desc") return parseFloat(b.price) - parseFloat(a.price);
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }
        return products;
      }),

    infinite: publicProcedure
      .input(
        z.object({
          categoryId: z.union([z.number(), z.array(z.number())]).optional(),
          search: z.string().optional(),
          tag: z.string().optional(),
          featured: z.boolean().optional(),
          limit: z.number().min(1).max(100).nullish(),
          cursor: z.number().nullish(), // offset
          minPrice: z.string().optional(),
          maxPrice: z.string().optional(),
          brand: z.string().optional(),
          sortBy: z.enum(["newest", "price_asc", "price_desc"]).optional(),
        })
      )
      .query(async ({ input }) => {
        const limit = input.limit ?? 12;
        const offset = input.cursor ?? 0;
        
        let finalSearch = input?.search;
        let finalMinPrice = input?.minPrice;
        let finalMaxPrice = input?.maxPrice;
        let finalBrand = input?.brand;
        let finalCategoryId = input?.categoryId;
        let finalSortBy = input?.sortBy;
        let finalFeatured = input?.featured;

        if (finalSearch) {
          const parsed = await parseNaturalLanguageQuery(finalSearch);
          finalSearch = parsed.search;
          if (parsed.minPrice && !finalMinPrice) finalMinPrice = parsed.minPrice;
          if (parsed.maxPrice && !finalMaxPrice) finalMaxPrice = parsed.maxPrice;
          if (parsed.brand && !finalBrand) finalBrand = parsed.brand;
          if (parsed.categoryId && !finalCategoryId) finalCategoryId = parsed.categoryId;
          if (parsed.sortBy && (!finalSortBy || finalSortBy === 'newest')) finalSortBy = parsed.sortBy;
          if (parsed.featured !== undefined && finalFeatured === undefined) finalFeatured = parsed.featured;
        }
        
        let products = await getProducts({ ...input, search: finalSearch, categoryId: finalCategoryId, featured: finalFeatured, limit: 1000, offset: 0 }); // Allow ample room for Node filtering
        
        // Server-side filtering & sorting
        if (finalMinPrice) products = products.filter((p: any) => parseFloat(p.price) >= parseFloat(finalMinPrice!));
        if (finalMaxPrice) products = products.filter((p: any) => parseFloat(p.price) <= parseFloat(finalMaxPrice!));
        if (finalBrand) products = products.filter((p: any) => p.brand?.toLowerCase() === finalBrand!.toLowerCase());
        if (finalSortBy) {
          products = products.sort((a: any, b: any) => {
            if (finalSortBy === "price_asc") return parseFloat(a.price) - parseFloat(b.price);
            if (finalSortBy === "price_desc") return parseFloat(b.price) - parseFloat(a.price);
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }

        const sliced = products.slice(offset, offset + limit);
        const nextCursor = offset + limit < products.length ? offset + limit : null;
        return { items: sliced, nextCursor };
      }),

    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const product = await getProductBySlug(input.slug);
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        return product;
      }),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await getProductById(input.id);
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        return product;
      }),

    reviews: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => getProductReviews(input.productId)),

    addReview: protectedProcedure
      .input(z.object({
        productId: z.number(),
        rating: z.number().min(1).max(5),
        title: z.string().optional(),
        body: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await addProductReview({ ...input, userId: ctx.user.id });
        return { success: true };
      }),
  }),

  // ─── Cart ──────────────────────────────────────────────────────────────────
  cart: router({
    get: protectedProcedure.query(({ ctx }) => getCartItems(ctx.user.id)),

    upsert: protectedProcedure
      .input(z.object({ productId: z.number(), quantity: z.number().min(0) }))
      .mutation(async ({ ctx, input }) => {
        if (input.quantity === 0) {
          await removeCartItem(ctx.user.id, input.productId);
        } else {
          await upsertCartItem(ctx.user.id, input.productId, input.quantity);
        }
        return { success: true };
      }),

    remove: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await removeCartItem(ctx.user.id, input.productId);
        return { success: true };
      }),

    clear: protectedProcedure.mutation(async ({ ctx }) => {
      await clearCart(ctx.user.id);
      return { success: true };
    }),

    syncFromGuest: protectedProcedure
      .input(z.array(z.object({ productId: z.number(), quantity: z.number().min(1) })))
      .mutation(async ({ ctx, input }) => {
        for (const item of input) {
          await upsertCartItem(ctx.user.id, item.productId, item.quantity);
        }
        return { success: true, mergedItems: input.length, conflicts: [] };
      }),
  }),

  // ─── Wishlist ──────────────────────────────────────────────────────────────
  wishlist: router({
    get: protectedProcedure.query(({ ctx }) => getWishlist(ctx.user.id)),

    toggle: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const added = await toggleWishlistItem(ctx.user.id, input.productId);
        return { success: true, added };
      }),
  }),

  // ─── Addresses ─────────────────────────────────────────────────────────────
  addresses: router({
    list: protectedProcedure.query(({ ctx }) => getUserAddresses(ctx.user.id)),

    create: protectedProcedure
      .input(
        z.object({
          fullName: z.string().min(1),
          phone: z.string().regex(/^\+?[0-9\s\-\(\)]{7,20}$/, "Please enter a valid phone number"),
          addressLine: z.string().min(1),
          city: z.string().min(1),
          postalCode: z.string().regex(/^(?:[A-Za-z0-9\s\-]{3,12})?$/, "Please enter a valid postal code").optional(),
          country: z.string().min(1),
          isDefault: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await createAddress({ ...input, userId: ctx.user.id });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ addressId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteAddress(ctx.user.id, input.addressId);
        return { success: true };
      }),
  }),

  // ─── Maps & Places ─────────────────────────────────────────────────────────
  maps: router({
    autocomplete: protectedProcedure
      .input(z.object({ input: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const data = await makeRequest<any>("/maps/api/place/autocomplete/json", { 
          input: input.input, 
          types: "address" 
        });
        return data.predictions || [];
      }),

    placeDetails: protectedProcedure
      .input(z.object({ placeId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const data = await makeRequest<any>("/maps/api/place/details/json", { 
          place_id: input.placeId, 
          fields: "address_components,formatted_address" 
        });
        return data.result;
      }),
  }),

  // ─── Checkout ──────────────────────────────────────────────────────────────
  checkout: router({
    placeOrder: publicProcedure
      .input(
        z.object({
          shippingFullName: z.string().min(1),
          shippingEmail: z.string().email().optional(),
          shippingPhone: z.string().regex(/^\+?[0-9\s\-\(\)]{7,20}$/, "Please enter a valid phone number"),
          shippingAddress: z.string().min(1),
          shippingCity: z.string().min(1),
          shippingCounty: z.string().optional(),
          shippingPostalCode: z.string().regex(/^(?:[A-Za-z0-9\s\-]{3,12})?$/, "Please enter a valid postal code").optional(),
          shippingCountry: z.string().min(1),
          paymentMethod: z.enum(["mpesa", "paypal", "stripe", "card", "cod"]),
          saveAddress: z.boolean().optional(),
          isExpress: z.boolean().optional(),
          discountCode: z.string().optional(),
          notes: z.string().optional(),
          guestCartItems: z.array(z.object({ productId: z.number(), quantity: z.number() })).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        let cartData: any[] = [];
        if (ctx.user) {
          cartData = await getCartItems(ctx.user.id);
        } else {
          if (!input.guestCartItems || input.guestCartItems.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Cart is empty" });
          for (const item of input.guestCartItems) {
            const product = await getProductById(item.productId);
            if (product) cartData.push({ productId: item.productId, quantity: item.quantity, product });
          }
        }
        if (cartData.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Cart is empty" });

        const shippingSettings = await getSetting("shipping");
        const freeThreshold = shippingSettings?.freeShippingThreshold ? parseFloat(shippingSettings.freeShippingThreshold) : 50000;
        const standardFee = shippingSettings?.standardFee ? parseFloat(shippingSettings.standardFee) : 50;
        const expressFee = shippingSettings?.expressDelivery ? parseFloat(shippingSettings.expressDelivery) : 100;

        const subtotal = cartData.reduce(
          (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
          0
        );
        const baseShipping = subtotal >= freeThreshold ? 0 : standardFee;
        const shippingCost = input.isExpress ? expressFee : baseShipping;
        
        let discountAmount = 0;
        if (input.discountCode === "WELCOME10") discountAmount = subtotal * 0.1;

        const total = Math.max(0, subtotal + shippingCost - discountAmount);

        const orderNumber = `ORD-${Date.now()}-${nanoid(6).toUpperCase()}`;
        const orderId = await createOrder({
          orderNumber,
          userId: ctx.user?.id,
          shippingFullName: input.shippingFullName,
          shippingEmail: input.shippingEmail,
          shippingPhone: input.shippingPhone,
          shippingAddress: input.shippingAddress,
          shippingCity: input.shippingCity,
          shippingCounty: input.shippingCounty,
          shippingPostalCode: input.shippingPostalCode,
          shippingCountry: input.shippingCountry,
          subtotal: subtotal.toFixed(2),
          shippingCost: shippingCost.toFixed(2),
          total: total.toFixed(2),
          paymentMethod: input.paymentMethod,
          notes: input.notes,
        });

        if (!orderId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create order" });

        await createOrderItems(
          cartData.map((item) => ({
            orderId,
            productId: item.productId,
            productName: item.product.name,
            productImage: (item.product.images as string[])?.[0] ?? "",
            price: item.product.price,
            quantity: item.quantity,
            subtotal: (parseFloat(item.product.price) * item.quantity).toFixed(2),
          }))
        );

        // Create payment record
        await createPayment({
          orderId,
          method: input.paymentMethod,
          amount: total.toFixed(2),
        });

        // Add initial status history
        await updateOrderStatus(orderId, "pending", "Order placed successfully");

        // Save address if requested
        if (input.saveAddress && ctx.user) {
          await createAddress({
            userId: ctx.user.id,
            fullName: input.shippingFullName,
            phone: input.shippingPhone,
            addressLine: input.shippingAddress,
            city: input.shippingCity,
            postalCode: input.shippingPostalCode,
            country: input.shippingCountry,
          });
        }

        // --- Order Confirmation Email Generation ---
        // (Email generation logic is now handled in the payment success handlers: 
        // verifyMpesa, confirmPaypal, and processCard)

        return { orderId, orderNumber, total: total.toFixed(2) };
      }),

    initiateMpesa: protectedProcedure
      .input(z.object({ orderId: z.number(), phone: z.string().min(10) }))
      .mutation(async ({ ctx, input }) => {
        const paymentSettings = await getSetting("payment");
        const consumerKey = paymentSettings?.mpesaKey;
        const consumerSecret = paymentSettings?.mpesaSecret;
        const shortcode = paymentSettings?.mpesaShortcode;
        const passkey = paymentSettings?.mpesaPasskey;
        const env = paymentSettings?.mpesaEnv || "sandbox";

        if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "M-Pesa is not fully configured by the administrator." });
        }

        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

        const generalSettings = await getSetting("general");
        const currency = generalSettings?.currency || "KES";
        let finalTotal = parseFloat(order.total);

        if (currency !== "KES") {
          // Convert common currencies to KES roughly if the store isn't native KES
          if (currency === "USD") finalTotal = finalTotal * 130;
          else if (currency === "EUR") finalTotal = finalTotal * 140;
          else if (currency === "GBP") finalTotal = finalTotal * 165;
          else throw new TRPCError({ code: "BAD_REQUEST", message: `M-Pesa requires KES. Unsupported currency: ${currency}`});
        }

        const amount = Math.ceil(finalTotal);
        const phone = formatMpesaPhone(input.phone);
        if (phone.length < 12) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid phone number format for M-Pesa." });

        const token = await getMpesaAccessToken(consumerKey, consumerSecret, env);
        const baseUrl = env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
        const timestamp = getMpesaTimestamp();
        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

        const host = ctx.req.headers.host || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        const callbackUrl = process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/api/webhooks/mpesa` : `${protocol}://${host}/api/webhooks/mpesa`;

        const payload = {
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline", // Change to CustomerBuyGoodsOnline if using Till number
          Amount: amount,
          PartyA: phone,
          PartyB: shortcode,
          PhoneNumber: phone,
          CallBackURL: callbackUrl,
          AccountReference: order.orderNumber.substring(0, 12),
          TransactionDesc: `Payment for Order ${order.orderNumber}`
        };

        const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (!response.ok || data.ResponseCode !== "0") {
          throw new TRPCError({ code: "BAD_REQUEST", message: data.errorMessage || data.CustomerMessage || "Failed to initiate STK Push. Check configurations." });
        }

        await updatePaymentStatus(input.orderId, "pending", data.CheckoutRequestID, { provider: "mpesa", raw: data });

        return {
          success: true,
          checkoutRequestId: data.CheckoutRequestID,
          message: "STK Push sent to your phone. Please enter your M-Pesa PIN to complete payment.",
        };
      }),

    verifyMpesa: protectedProcedure
      .input(z.object({ orderId: z.number(), checkoutRequestId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const paymentSettings = await getSetting("payment");
        const consumerKey = paymentSettings?.mpesaKey;
        const consumerSecret = paymentSettings?.mpesaSecret;
        const shortcode = paymentSettings?.mpesaShortcode;
        const passkey = paymentSettings?.mpesaPasskey;
        const env = paymentSettings?.mpesaEnv || "sandbox";

        if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "M-Pesa is not configured." });
        }

        const token = await getMpesaAccessToken(consumerKey, consumerSecret, env);
        const baseUrl = env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
        const timestamp = getMpesaTimestamp();
        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

        const response = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ BusinessShortCode: shortcode, Password: password, Timestamp: timestamp, CheckoutRequestID: input.checkoutRequestId })
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.errorMessage && data.errorMessage.toLowerCase().includes("being processed")) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Payment is still being processed on your phone. Please enter your PIN and click verify again." });
            }
            throw new TRPCError({ code: "BAD_REQUEST", message: data.errorMessage || data.ResultDesc || "Error checking payment status." });
        }

        if (data.ResultCode === "0") {
          const transactionId = data.CheckoutRequestID;
          await updatePaymentStatus(input.orderId, "completed", transactionId, { provider: "mpesa", raw: data });
        await updateOrderStatus(input.orderId, "payment_confirmed", "M-Pesa payment confirmed", {
          paymentStatus: "paid",
          paymentReference: transactionId,
        });
        // --- Order Confirmation Email on Successful Payment ---
        try {
          const emailSettings = await getSetting("email");
          if (emailSettings?.orderConfirmation) {
            const order = await getOrderById(input.orderId);
            if (order) {
              const items = await getOrderItems(order.id);
              const productIds = items.map(i => i.productId);
              const productsFromDb = await getProductsByIds(productIds);
              const appearance = await getSetting("appearance");
              const general = await getSetting("general");
              const storeName = general?.storeName || "Store";
              const host = ctx.req.headers.host || "localhost:3000";
              const protocol = host.includes("localhost") ? "http" : "https";
              const fullHost = `${protocol}://${host}`;
              const emailHtml = getOrderConfirmationEmailHtml({
                storeName,
                logoUrl: appearance?.logoUrl,
                primaryColor: emailSettings?.emailButtonColor || appearance?.primaryColor || "#3b82f6",
                contactEmail: general?.contactEmail || "support@example.com",
                orderLink: `${fullHost}/dashboard/orders/${order.id}`,
                storePhone: general?.phone || "",
                storeCurrency: general?.currency || "USD",
                shippingFullName: order.shippingFullName,
                orderNumber: order.orderNumber,
                cartData: items.map(i => {
                  const product = productsFromDb.find(p => p.id === i.productId);
                  return { name: i.productName, slug: product?.slug, price: i.price, quantity: i.quantity, image: (product?.images as string[])?.[0] || null };
                }),
                subtotal: parseFloat(order.subtotal),
                shippingCost: parseFloat(order.shippingCost),
                total: parseFloat(order.total),
                customMessage: emailSettings.orderConfirmationMessage,
                host: fullHost,
                productImageWidth: emailSettings.productImageWidth,
                emailBackgroundColor: emailSettings.emailBackgroundColor,
              });
              const transporter = nodemailer.createTransport({ host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort), secure: Number(emailSettings.smtpPort) === 465, auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword } });
              const customerEmail = (await getUserByEmail(order.shippingEmail || ''))?.email || order.shippingEmail;
              if (customerEmail) await transporter.sendMail({ from: `"${storeName}" <${emailSettings.smtpUser}>`, to: customerEmail, subject: `Order Confirmation #${order.orderNumber}`, html: emailHtml });
            }
          }
        } catch (error) {
          console.error("Failed to send order confirmation email:", error);
        }
        const order = await getOrderById(input.orderId);
        if (order) {
          const items = await getOrderItems(order.id);
          for (const item of items) { await updateProductStock(item.productId, -item.quantity); }
          await clearCart(order.userId);
        }
        return { success: true, transactionId };
        } else {
          let msg = data.ResultDesc || "Payment not completed.";
          if (data.ResultCode === "1032") msg = "Payment was cancelled. Please try again.";
          throw new TRPCError({ code: "BAD_REQUEST", message: msg });
        }
      }),

    initiatePaypal: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const paymentSettings = await getSetting("payment");
        if (!paymentSettings?.paypalClientId || !paymentSettings?.paypalSecret) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "PayPal is not configured by the administrator." });
        }

        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

        const generalSettings = await getSetting("general");
        const currency = generalSettings?.currency || "USD";
        const token = await getPaypalAccessToken(paymentSettings.paypalClientId, paymentSettings.paypalSecret);

        const host = ctx.req.headers.host || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";

        // PayPal Supported Currencies
        const PAYPAL_CURRENCIES = ["AUD", "BRL", "CAD", "CNY", "CZK", "DKK", "EUR", "HKD", "HUF", "ILS", "JPY", "MYR", "MXN", "TWD", "NZD", "NOK", "PHP", "PLN", "GBP", "RUB", "SGD", "SEK", "CHF", "THB", "USD"];
        
        let finalCurrency = currency;
        let finalTotal = parseFloat(order.total);

        // If the store is using an unsupported currency (like KES), dynamically convert it to USD
        if (!PAYPAL_CURRENCIES.includes(currency)) {
          finalCurrency = "USD";
          if (currency === "KES") finalTotal = finalTotal / 130;
          else if (currency === "NGN") finalTotal = finalTotal / 1500;
          else if (currency === "ZAR") finalTotal = finalTotal / 19;
          else if (currency === "UGX") finalTotal = finalTotal / 3800;
          else if (currency === "TZS") finalTotal = finalTotal / 2500;
        }

        const PAYPAL_API_BASE = process.env.PAYPAL_ENV === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
        const PAYPAL_WEB_BASE = process.env.PAYPAL_ENV === "production" ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";

        const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [{
              reference_id: order.orderNumber,
              custom_id: order.id.toString(),
              amount: { currency_code: finalCurrency, value: finalTotal.toFixed(2) }
            }],
            // Use application_context (documented API shape) so PayPal shows the proper
            // checkout UX (return/cancel, brand name, and user_action=PAY_NOW).
            application_context: {
              return_url: `${protocol}://${host}/paypal-return?paypal_success=true&order_id=${order.id}`,
              cancel_url: `${protocol}://${host}/paypal-return?paypal_cancel=true`,
              user_action: "PAY_NOW",
              brand_name: generalSettings?.storeName || "Store",
              landing_page: "LOGIN",
            }
          })
        });

        const data = await response.json();
        if (!response.ok) throw new TRPCError({ code: "BAD_REQUEST", message: data.message || "Failed to create PayPal order" });

        let approvalUrl = data.links?.find((l: any) => l.rel === "approve" || l.rel === "payer-action" || (l.href && l.href.includes("checkoutnow")))?.href;
        
        if (!approvalUrl && data.id) {
          approvalUrl = `${PAYPAL_WEB_BASE}/checkoutnow?token=${data.id}`;
        }

        return {
          success: true,
          paypalOrderId: data.id,
          approvalUrl,
          message: "PayPal checkout initiated. Please complete the payment in the new window.",
        };
      }),

    confirmPaypal: protectedProcedure
      .input(z.object({ orderId: z.number(), paypalOrderId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const paymentSettings = await getSetting("payment");
        if (!paymentSettings?.paypalClientId || !paymentSettings?.paypalSecret) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "PayPal is not configured." });
        }

        const token = await getPaypalAccessToken(paymentSettings.paypalClientId, paymentSettings.paypalSecret);

        const PAYPAL_API_BASE = process.env.PAYPAL_ENV === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

        // Fetch order details first to inspect payer info (to ensure buyer isn't the merchant)
        const orderResp = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${input.paypalOrderId}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        const orderInfo = await orderResp.json().catch(() => ({}));

        // Determine merchant email(s) from settings to compare against payer
        const generalSettings = await getSetting("general");
        const merchantEmailCandidates = [paymentSettings.paypalMerchantEmail || null, generalSettings?.contactEmail || null]
          .filter(Boolean)
          .map((s: string) => s.toLowerCase());

        const payerEmail = (orderInfo.payer && orderInfo.payer.email_address) ? String(orderInfo.payer.email_address).toLowerCase() : null;
        if (payerEmail && merchantEmailCandidates.includes(payerEmail)) {
          // Buyer appears to be the merchant — ask user to logout of merchant account
          throw new TRPCError({ code: "BAD_REQUEST", message: "It looks like you're logged into the merchant PayPal account. Please log out of that account and sign in with your buyer account to complete payment." });
        }

        // Capture the order
        const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${input.paypalOrderId}/capture`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          }
        });

        const data = await response.json();

        if (response.ok && data.status === "COMPLETED") {
          const transactionId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id || data.id;
          await updatePaymentStatus(input.orderId, "completed", transactionId, { provider: "paypal", raw: data });
          await updateOrderStatus(input.orderId, "payment_confirmed", "PayPal payment confirmed", {
            paymentStatus: "paid",
            paymentReference: transactionId,
          });
          // --- Order Confirmation Email on Successful Payment ---
          try {
            const emailSettings = await getSetting("email");
            if (emailSettings?.orderConfirmation) {
              const order = await getOrderById(input.orderId);
              if (order) {
                const items = await getOrderItems(order.id);
                const productIds = items.map(i => i.productId);
                const productsFromDb = await getProductsByIds(productIds);
                const appearance = await getSetting("appearance");
                const general = await getSetting("general");
                const storeName = general?.storeName || "Store";
                const host = ctx.req.headers.host || "localhost:3000";
                const protocol = host.includes("localhost") ? "http" : "https";
                const fullHost = `${protocol}://${host}`;
                const emailHtml = getOrderConfirmationEmailHtml({
                  storeName,
                  logoUrl: appearance?.logoUrl,
                  primaryColor: emailSettings?.emailButtonColor || appearance?.primaryColor || "#3b82f6",
                  contactEmail: general?.contactEmail || "support@example.com",
                  orderLink: `${fullHost}/dashboard/orders/${order.id}`,
                  storePhone: general?.phone || "",
                  storeCurrency: general?.currency || "USD",
                  shippingFullName: order.shippingFullName,
                  orderNumber: order.orderNumber,
                  cartData: items.map(i => {
                    const product = productsFromDb.find(p => p.id === i.productId);
                    return { name: i.productName, slug: product?.slug, price: i.price, quantity: i.quantity, image: (product?.images as string[])?.[0] || null };
                  }),
                  subtotal: parseFloat(order.subtotal),
                  shippingCost: parseFloat(order.shippingCost),
                  total: parseFloat(order.total),
                  customMessage: emailSettings.orderConfirmationMessage,
                  host: fullHost,
                  productImageWidth: emailSettings.productImageWidth,
                  emailBackgroundColor: emailSettings.emailBackgroundColor,
                });
                const transporter = nodemailer.createTransport({ host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort), secure: Number(emailSettings.smtpPort) === 465, auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword } });
                const customerEmail = (await getUserByEmail(order.shippingEmail || ''))?.email || order.shippingEmail;
                if (customerEmail) await transporter.sendMail({ from: `"${storeName}" <${emailSettings.smtpUser}>`, to: customerEmail, subject: `Order Confirmation #${order.orderNumber}`, html: emailHtml });
              }
            }
          } catch (error) {
            console.error("Failed to send order confirmation email:", error);
          }
          const order = await getOrderById(input.orderId);
          if (order) {
            const items = await getOrderItems(order.id);
            for (const item of items) { await updateProductStock(item.productId, -item.quantity); }
            await clearCart(order.userId);
          }
          return { success: true, transactionId };
        } else {
          let errorMessage = data.message || data.details?.[0]?.description || "Payment not completed yet. Please try again.";
          if (data.details?.[0]?.issue === "ORDER_NOT_APPROVED") {
             errorMessage = "Please finish checking out in the PayPal popup window before clicking verify!";
          }
          throw new TRPCError({ code: "BAD_REQUEST", message: errorMessage });
        }
      }),

    // Simulate Stripe
    processCard: protectedProcedure
      .input(
        z.object({
          orderId: z.number(),
          cardNumber: z.string().min(16).max(19),
          expiry: z.string(),
          cvv: z.string().min(3).max(4),
          cardholderName: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const paymentSettings = await getSetting("payment");
          if (!paymentSettings?.stripeSecret) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe is not configured by the administrator." });
          }

          const order = await getOrderById(input.orderId);
          if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

          const generalSettings = await getSetting("general");
          const currency = (generalSettings?.currency || "USD").toLowerCase();

          const stripe = new Stripe(paymentSettings.stripeSecret, { apiVersion: "2023-10-16" });
          const [expMonth, expYear] = input.expiry.split("/");

          // Create Payment Method
          const paymentMethod = await stripe.paymentMethods.create({
            type: "card",
            card: { number: input.cardNumber, exp_month: parseInt(expMonth, 10), exp_year: parseInt(`20${expYear}`, 10), cvc: input.cvv },
            billing_details: { name: input.cardholderName },
          });

          // Create & Confirm Payment Intent
          // Note: Zero-decimal currencies like JPY require amount without multiplying by 100
          const isZeroDecimal = ["jpy", "krw", "bif", "pyg", "vnd", "xaf", "xpf", "clp", "djf", "gnf", "kmf", "mga", "rwf", "ugx", "vuv"].includes(currency);
          const amount = isZeroDecimal ? Math.round(parseFloat(order.total)) : Math.round(parseFloat(order.total) * 100);

          const intent = await stripe.paymentIntents.create({
            amount,
            currency: currency,
            payment_method: paymentMethod.id,
            confirm: true,
            payment_method_types: ["card"],
            description: `Order #${order.orderNumber}`,
            metadata: { orderId: order.id.toString() },
          });

          if (intent.status === "succeeded") {
            await updatePaymentStatus(input.orderId, "completed", intent.id, { provider: "stripe" });
            await updateOrderStatus(input.orderId, "payment_confirmed", "Card payment confirmed via Stripe", { paymentStatus: "paid", paymentReference: intent.id });
            // --- Order Confirmation Email on Successful Payment ---
            try {
              const emailSettings = await getSetting("email");
              if (emailSettings?.orderConfirmation) {
                const order = await getOrderById(input.orderId);
                if (order) {
                  const items = await getOrderItems(order.id);
                  const productIds = items.map(i => i.productId);
                  const productsFromDb = await getProductsByIds(productIds);
                  const appearance = await getSetting("appearance");
                  const general = await getSetting("general");
                  const storeName = general?.storeName || "Store";
                  const host = ctx.req.headers.host || "localhost:3000";
                  const protocol = host.includes("localhost") ? "http" : "https";
                  const fullHost = `${protocol}://${host}`;
                  const emailHtml = getOrderConfirmationEmailHtml({
                    storeName,
                    logoUrl: appearance?.logoUrl,
                    primaryColor: emailSettings?.emailButtonColor || appearance?.primaryColor || "#3b82f6",
                    contactEmail: general?.contactEmail || "support@example.com",
                    storePhone: general?.phone || "",
                    storeCurrency: general?.currency || "USD",
                    shippingFullName: order.shippingFullName,
                    orderNumber: order.orderNumber,
                    cartData: items.map(i => {
                      const product = productsFromDb.find(p => p.id === i.productId);
                      return { name: i.productName, slug: product?.slug, price: i.price, quantity: i.quantity, image: (product?.images as string[])?.[0] || null };
                    }),
                    subtotal: parseFloat(order.subtotal),
                    shippingCost: parseFloat(order.shippingCost),
                    total: parseFloat(order.total),
                    customMessage: emailSettings.orderConfirmationMessage,
                    host: fullHost,
                    productImageWidth: emailSettings.productImageWidth,
                    emailBackgroundColor: emailSettings.emailBackgroundColor,
                  });
                  const transporter = nodemailer.createTransport({ host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort), secure: Number(emailSettings.smtpPort) === 465, auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword } });
                  const customerEmail = (await getUserByEmail(order.shippingEmail || ''))?.email || order.shippingEmail;
                  if (customerEmail) await transporter.sendMail({ from: `"${storeName}" <${emailSettings.smtpUser}>`, to: customerEmail, subject: `Order Confirmation #${order.orderNumber}`, html: emailHtml });
                }
              }
            } catch (error) {
              console.error("Failed to send order confirmation email:", error);
            }
            const items = await getOrderItems(order.id);
            for (const item of items) { await updateProductStock(item.productId, -item.quantity); }
            await clearCart(order.userId);
            return { success: true, transactionId: intent.id };
          } else {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Payment requires additional action." });
          }
        } catch (error: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message || "Payment processing failed" });
        }
      }),

    updatePaymentMethod: protectedProcedure
      .input(
        z.object({
          orderId: z.number(),
          paymentMethod: z.enum(["mpesa", "paypal", "stripe", "card", "cod"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const order = await getOrderById(input.orderId);
        if (!order || order.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.update(orders).set({ paymentMethod: input.paymentMethod }).where(eq(orders.id, input.orderId));
        await db.update(payments).set({ method: input.paymentMethod }).where(eq(payments.orderId, input.orderId));

        return { success: true };
      }),
  }),

  // ─── Orders ────────────────────────────────────────────────────────────────
  orders: router({
    myOrders: protectedProcedure.query(({ ctx }) => getOrdersByUser(ctx.user.id)),

    detail: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ ctx, input }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const items = await getOrderItems(input.orderId);
        const history = await getOrderStatusHistory(input.orderId);
        const payment = await getPaymentByOrder(input.orderId);
        let agent = null;
        if (order.deliveryAgentId) {
          const db = await getDb();
          if (db) {
            [agent] = await db.select().from(deliveryAgents).where(eq(deliveryAgents.id, order.deliveryAgentId)).limit(1);
          }
        }
        return { order, items, history, payment, agent };
      }),

    byNumber: publicProcedure
      .input(z.object({ orderNumber: z.string() }))
      .query(async ({ ctx, input }) => {
        const order = await getOrderByNumber(input.orderNumber);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        // If the order is claimed by an account, ensure only that user (or an admin) can see it
        if (order.userId && order.userId !== ctx.user?.id && ctx.user?.role !== "admin" && !ctx.user) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const items = await getOrderItems(order.id);
        const history = await getOrderStatusHistory(order.id);
        const payment = await getPaymentByOrder(order.id);
        return { order, items, history, payment };
      }),

    cancel: publicProcedure
      .input(z.object({ orderNumber: z.string(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const order = await getOrderByNumber(input.orderNumber);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        
        // If the order is claimed by an account, ensure only that user (or an admin) can cancel it
        if (order.userId && order.userId !== ctx.user?.id && ctx.user?.role !== "admin" && !ctx.user) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (!["pending", "payment_confirmed", "processing"].includes(order.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order cannot be cancelled at this stage." });
        }

        // Prevent cancellation if the order is older than 24 hours (admins are exempt)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (ctx.user?.role !== "admin" && new Date(order.createdAt) < twentyFourHoursAgo) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Orders cannot be cancelled after 24 hours." });
        }
        
        const cancelNote = input.reason 
          ? `Cancelled via tracking page. Reason: ${input.reason}`
          : "Cancelled by customer via tracking page";
          
        await updateOrderStatus(order.id, "cancelled", cancelNote);
        
        if (order.paymentStatus === "paid" || order.status !== "pending") {
          const items = await getOrderItems(order.id);
          for (const item of items) { await updateProductStock(item.productId, item.quantity); }
        }

        // --- SEND EMAIL NOTIFICATION TO ADMIN ---
        try {
          const emailSettings = await getSetting("email");
          const generalSettings = await getSetting("general");
          
          if (emailSettings?.smtpHost && generalSettings?.contactEmail) {
            const transporter = nodemailer.createTransport({
              host: emailSettings.smtpHost,
              port: Number(emailSettings.smtpPort),
              secure: Number(emailSettings.smtpPort) === 465,
              auth: {
                user: emailSettings.smtpUser,
                pass: emailSettings.smtpPassword,
              },
            });

            const currency = generalSettings.currency || "USD";
            const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(parseFloat(order.total));

            await transporter.sendMail({
              from: `"${generalSettings.storeName || 'Store System'}" <${emailSettings.smtpUser}>`,
              to: generalSettings.contactEmail,
              subject: `🚨 Order Cancelled - #${order.orderNumber}`,
              html: `
                <h3>Order Cancelled by Customer</h3>
                <p>A customer has just cancelled their order via the tracking page.</p>
                <ul>
                  <li><strong>Order Number:</strong> ${order.orderNumber}</li>
                  <li><strong>Customer:</strong> ${order.shippingFullName} (${order.shippingEmail || 'N/A'})</li>
                  <li><strong>Total:</strong> ${formattedTotal}</li>
                  <li><strong>Previous Payment Status:</strong> ${order.paymentStatus}</li>
                  <li><strong>Reason:</strong> ${input.reason || "None provided"}</li>
                </ul>
                <p>Please log in to the Admin Panel > Orders to review this cancellation and process any necessary refunds.</p>
              `,
            });
            console.log(`[Email] Admin cancellation notification sent to ${generalSettings.contactEmail}`);
          }
        } catch (err) {
          console.error("Failed to send admin cancellation notification email:", err);
        }

        // --- SEND CANCELLATION CONFIRMATION TO CUSTOMER ---
        try {
          const emailSettings = await getSetting("email");
          const generalSettings = await getSetting("general");
          const appearanceSettings = await getSetting("appearance");
          const customerEmail = order.shippingEmail || (order.userId ? (await getUserByEmail(order.userId.toString()))?.email : null);

          if (emailSettings?.smtpHost && customerEmail) {
            const transporter = nodemailer.createTransport({
              host: emailSettings.smtpHost,
              port: Number(emailSettings.smtpPort),
              secure: Number(emailSettings.smtpPort) === 465,
              auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
            });

            const emailHtml = getOrderCancelledEmailHtml({
              storeName: generalSettings?.storeName || "Store",
              logoUrl: appearanceSettings?.logoUrl,
              primaryColor: emailSettings?.emailButtonColor || appearanceSettings?.primaryColor || "#3b82f6",
              contactEmail: generalSettings?.contactEmail || "support@example.com",
              storePhone: generalSettings?.phone,
              shippingFullName: order.shippingFullName,
              orderNumber: order.orderNumber,
              total: order.total,
              storeCurrency: generalSettings?.currency || "USD",
            });

            await transporter.sendMail({
              from: `"${generalSettings.storeName || 'Store System'}" <${emailSettings.smtpUser}>`,
              to: customerEmail,
              subject: `Your Order #${order.orderNumber} has been Cancelled`,
              html: emailHtml,
            });
            console.log(`[Email] Customer cancellation confirmation sent to ${customerEmail}`);
          }
        } catch (err) { console.error("Failed to send customer cancellation email:", err); }

        return { success: true };
      }),
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────────
  admin: router({
    stats: adminProcedure
      .input(z.object({ timeRange: z.string().optional() }).optional())
      .query(({ input }) => getAdminStats(input?.timeRange)),

    globalSearch: adminProcedure
      .input(z.object({ query: z.string(), cursor: z.number().nullish(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        if (!input.query) {
          return { products: [], orders: [], customers: [], categories: [], nextCursor: null };
        }
        
        const limit = input.limit ?? 10;
        const offset = input.cursor ?? 0;
        const results = await adminGlobalSearch(input.query, limit, offset);
        
        const hasMore = results.products.length === limit || results.orders.length === limit || results.customers.length === limit || results.categories.length === limit;
        return { ...results, nextCursor: hasMore ? offset + limit : null };
      }),

    orders: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional(), search: z.string().optional(), status: z.string().optional() }).optional())
      .query(async ({ input }) => {
        let orders = await getAllOrders(input ?? {});
        if (input?.search) {
          const s = input.search.toLowerCase();
          orders = orders.filter((o: any) => o.orderNumber.toLowerCase().includes(s) || (o.customerName || "").toLowerCase().includes(s));
        }
        if (input?.status) orders = orders.filter((o: any) => o.status === input.status);
        return orders;
      }),

    orderDetail: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        const items = await getOrderItems(input.orderId);
        const history = await getOrderStatusHistory(input.orderId);
        const payment = await getPaymentByOrder(input.orderId);
        const db = await getDb();
        let customer = null;
        if (db) {
          const result = await db.select().from(users).where(eq(users.id, order.userId)).limit(1);
          customer = result[0] ?? null;
        }
        return { order, items, history, payment, customer };
      }),

    updateOrderStatus: adminProcedure
      .input(
        z.object({
          orderId: z.number(),
          status: z.enum(["pending", "payment_confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled", "refunded"]),
          note: z.string().optional(),
          trackingNumber: z.string().optional(),
          estimatedDelivery: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateOrderStatus(input.orderId, input.status, input.note, {
          trackingNumber: input.trackingNumber,
          estimatedDelivery: input.estimatedDelivery,
        });

        // --- Shipping Notification Email ---
        if (input.status === "shipped") {
          try {
            const emailSettings = await getSetting("email");
            if (emailSettings?.shippingNotification) {
              const order = await getOrderById(input.orderId);
              if (order) {
                const db = await getDb();
                let customerEmail = "";
                if (db && order.userId) {
                  const [customer] = await db.select().from(users).where(eq(users.id, order.userId)).limit(1);
                  customerEmail = customer?.email || "";
                } else if (order.shippingEmail) customerEmail = order.shippingEmail;

                if (customerEmail) {
                  const appearance = await getSetting("appearance");
                  const general = await getSetting("general");
                  
                  const storeName = general?.storeName || "Store";
                  const storePhone = general?.phone || "";
                  const logoUrl = appearance?.logoUrl;
                  const contactEmail = general?.contactEmail || "support@example.com";
                  const primaryColor = emailSettings?.emailButtonColor || appearance?.primaryColor || "#3b82f6";
                  
                  const host = ctx.req.headers.host || "localhost:3000";
                  const protocol = host.includes("localhost") ? "http" : "https";
                  const trackLink = `${protocol}://${host}/dashboard/orders/${order.id}`;

                  const emailHtml = getShippingNotificationEmailHtml({
                    storeName, logoUrl, contactEmail, storePhone, primaryColor,
                    shippingFullName: order.shippingFullName,
                    orderNumber: order.orderNumber,
                    trackingNumber: input.trackingNumber,
                    trackLink,
                    customMessage: emailSettings?.shippingNotificationMessage,
                    shippingAddress: `${order.shippingAddress}\n${order.shippingCity}, ${order.shippingPostalCode || ''}\n${order.shippingCountry}`
                  });

                  if (emailSettings?.smtpHost && emailSettings.smtpUser) {
                    const transporter = nodemailer.createTransport({
                      host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
                      secure: Number(emailSettings.smtpPort) === 465,
                      auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
                      connectionTimeout: 10000,
                      greetingTimeout: 10000,
                      socketTimeout: 10000
                    });
                    await transporter.sendMail({
                      from: `"${storeName}" <${emailSettings.smtpUser}>`, to: customerEmail, subject: `Your ${storeName} Order Has Shipped!`,
                      html: emailHtml
                    });
                    console.log(`[Email] Shipping notification sent successfully to ${customerEmail}`);
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error generating shipping email:", error);
          }
        }

        return { success: true };
      }),

    payments: adminProcedure.query(() => getAllPayments()),

    customers: adminProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        let allUsers = await getAllUsers();
        if (input?.search) {
          const s = input.search.toLowerCase();
          allUsers = allUsers.filter((u: any) => (u.name || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s));
        }
        return allUsers;
      }),

    verifyPayment: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        const transactionId = `MANUAL-${Date.now()}`;
        await updatePaymentStatus(input.orderId, "completed", transactionId, { provider: "manual" });
        await updateOrderStatus(input.orderId, "payment_confirmed", "Payment manually verified by admin", {
          paymentStatus: "paid",
          paymentReference: transactionId,
        });
        const order = await getOrderById(input.orderId);
        if (order) {
          const items = await getOrderItems(order.id);
          for (const item of items) { await updateProductStock(item.productId, -item.quantity); }
        }
        return { success: true };
      }),

    createProduct: adminProcedure
      .input(
        z.object({
          categoryId: z.number(),
          name: z.string().min(1),
          slug: z.string().min(1),
          description: z.string().optional(),
          shortDescription: z.string().optional(),
          price: z.string(),
          comparePrice: z.string().optional(),
          stock: z.number().min(0),
          brand: z.string().optional(),
          sku: z.string().optional(),
          images: z.array(z.string()).optional(),
          specifications: z.record(z.string(), z.string()).optional(),
          tags: z.array(z.string()).optional(),
          featured: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await upsertProduct(input);
        return { success: true };
      }),

    updateProduct: adminProcedure
      .input(
        z.object({
          productId: z.number(),
          categoryId: z.number(),
          name: z.string().min(1),
          slug: z.string().min(1),
          description: z.string().optional(),
          shortDescription: z.string().optional(),
          price: z.string(),
          comparePrice: z.string().optional(),
          stock: z.number().min(0),
          brand: z.string().optional(),
          sku: z.string().optional(),
          images: z.array(z.string()).optional(),
          specifications: z.record(z.string(), z.string()).optional(),
          tags: z.array(z.string()).optional(),
          featured: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { productId, ...rest } = input;
        await upsertProduct({ id: productId, ...rest });
        return { success: true };
      }),

    deleteProduct: adminProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteProduct(input.productId);
        return { success: true };
      }),

    products: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional(), search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        let products = await getProducts({ limit: input?.limit ?? 100, offset: input?.offset ?? 0 });
        if (input?.search) {
          const s = input.search.toLowerCase();
          products = products.filter((p: any) => p.name.toLowerCase().includes(s) || (p.brand || "").toLowerCase().includes(s));
        }
        return products;
      }),

    upsertProduct: adminProcedure
      .input(
        z.object({
          id: z.number().optional(),
          categoryId: z.number(),
          name: z.string().min(1),
          slug: z.string().min(1),
          description: z.string().optional(),
          shortDescription: z.string().optional(),
          price: z.string(),
          comparePrice: z.string().optional(),
          stock: z.number().min(0),
          brand: z.string().optional(),
          sku: z.string().optional(),
          images: z.array(z.string()).optional(),
          specifications: z.record(z.string(), z.string()).optional(),
          tags: z.array(z.string()).optional(),
          featured: z.boolean().optional(),
          active: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await upsertProduct(input);
        return { success: true };
      }),

    upsertCategory: adminProcedure
      .input(
        z.object({
          id: z.number().optional(),
          parentId: z.number().nullable().optional(),
          name: z.string().min(1),
          slug: z.string().min(1),
          description: z.string().nullable().optional(),
          imageUrl: z.string().nullable().optional(),
          icon: z.string().nullable().optional(),
          featured: z.boolean().optional(),
          active: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (db && input.id) {
          await db.update(categoriesSchema).set({ parentId: input.parentId ?? null, name: input.name, slug: input.slug, description: input.description, imageUrl: input.imageUrl, icon: input.icon, featured: input.featured ?? false, active: input.active ?? true }).where(eq(categoriesSchema.id, input.id));
        } else {
          await upsertCategory(input);
        }
        clearCachePrefix("categories");
        return { success: true };
      }),

    deleteCategory: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (db) {
          // Safely release any subcategories so they don't become hidden orphans
          await db.update(categoriesSchema).set({ parentId: null }).where(eq(categoriesSchema.parentId, input.id));
          // Delete the requested category
          await db.delete(categoriesSchema).where(eq(categoriesSchema.id, input.id));
        }
        clearCachePrefix("categories");
        return { success: true };
      }),

    reorderCategories: adminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (db) {
          for (let i = 0; i < input.ids.length; i++) {
            await db.update(categoriesSchema).set({ order: i }).where(eq(categoriesSchema.id, input.ids[i]));
          }
        }
        clearCachePrefix("categories");
        return { success: true };
      }),

    exportDatabase: adminProcedure.query(async () => {
      const usersList = await getAllUsers();
      const productsList = await getProducts();
      const ordersList = await getAllOrders();
      return { timestamp: new Date().toISOString(), data: { users: usersList, products: productsList, orders: ordersList } };
    }),

    refundPayment: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        await updatePaymentStatus(input.orderId, "refunded");
        await updateOrderStatus(input.orderId, "refunded", "Payment refunded by admin");
        return { success: true };
      }),

    getPayoutRequests: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return await db.select().from(deliveryPayouts).orderBy(desc(deliveryPayouts.requestedAt));
    }),

    approvePayout: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const mpesaSettings = await getSetting("mpesa_b2c");
        if (!mpesaSettings?.consumerKey || !mpesaSettings.certContent) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "M-Pesa B2C settings are not fully configured in the admin panel." });
        }

        const [payoutRequest] = await db.select().from(deliveryPayouts).where(eq(deliveryPayouts.id, input.id)).limit(1);
        if (!payoutRequest) throw new TRPCError({ code: "NOT_FOUND", message: "Payout request not found." });
        const [agent] = await db.select().from(deliveryAgents).where(eq(deliveryAgents.id, payoutRequest.agentId)).limit(1);
        if (!agent || !agent.phone) throw new TRPCError({ code: "BAD_REQUEST", message: "Driver phone number is missing." });
        const generalSettings = await getSetting("general");
        
        try {
          const mpesaResponse = await initiateB2CPayout(mpesaSettings, { amount: parseFloat(payoutRequest.amount), phone: agent.phone, remarks: `Payout from ${generalSettings?.storeName || "Store"}`, occasion: `Payout ID ${payoutRequest.id}` });
          await db.update(deliveryPayouts).set({ mpesaConversationId: mpesaResponse.ConversationID, mpesaOriginatorConversationId: mpesaResponse.OriginatorConversationID }).where(eq(deliveryPayouts.id, input.id));
          return { success: true, message: "M-Pesa payout initiated successfully." };
        } catch (error: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message || "Failed to initiate M-Pesa payout" });
        }
      }),

    rejectPayout: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(deliveryPayouts).set({ status: 'failed', processedAt: new Date() }).where(eq(deliveryPayouts.id, input.id));
        return { success: true };
      }),

    createPresignedUrl: adminProcedure
      .input(z.object({ filename: z.string(), contentType: z.string() }))
      .mutation(async ({ input }) => {
        const accessKey = process.env.AWS_ACCESS_KEY_ID;
        // If AWS keys are missing or using the placeholder, signal the frontend to fallback to Base64
        if (!accessKey || accessKey === "your_access_key") {
          return { uploadUrl: null, publicUrl: null };
        }

        const s3Client = new S3Client({
          region: process.env.AWS_REGION || "auto",
          endpoint: process.env.AWS_ENDPOINT || undefined,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
          },
        });
        
        const safeName = input.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
        const key = `uploads/${Date.now()}-${safeName}`;
        
        const command = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET || "",
          Key: key,
          ContentType: input.contentType,
        });
        
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        const publicUrl = process.env.AWS_PUBLIC_URL ? `${process.env.AWS_PUBLIC_URL}/${key}` : `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
        
        return { uploadUrl, publicUrl };
      }),

    // --- Settings Management ---
    getSetting: adminProcedure
      .input(z.object({ key: z.string() }))
      .query(({ input }) => getSetting(input.key)),

    updateSetting: adminProcedure
      .input(z.object({ key: z.string(), value: z.any() }))
      .mutation(async ({ input }) => {
        await upsertSetting(input.key, input.value);
        clearCachePrefix("settings");
        return { success: true };
      }),

    // --- Content Management ---
    banners: adminProcedure.query(() => getBanners()),
    upsertBanner: adminProcedure
      .input(z.object({ id: z.number().optional(), title: z.string().min(1), description: z.string().nullable().optional(), image: z.string().min(1), active: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        await upsertBanner(input);
        clearCachePrefix("banners");
        return { success: true };
      }),
    deleteBanner: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBanner(input.id);
        clearCachePrefix("banners");
        return { success: true };
      }),

    reorderBanners: adminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (db) {
          for (let i = 0; i < input.ids.length; i++) {
            await db.update(bannersSchema).set({ order: i }).where(eq(bannersSchema.id, input.ids[i]));
          }
        }
        clearCachePrefix("banners");
        return { success: true };
      }),

    promotions: adminProcedure.query(() => getPromotions()),
    upsertPromotion: adminProcedure
      .input(z.object({ id: z.number().optional(), title: z.string().min(1), description: z.string().min(1), active: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        await upsertPromotion(input);
        clearCachePrefix("promotions");
        return { success: true };
      }),
    deletePromotion: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deletePromotion(input.id);
        clearCachePrefix("promotions");
        return { success: true };
      }),

    announcements: adminProcedure.query(() => getAnnouncements()),
    upsertAnnouncement: adminProcedure
      .input(z.object({ id: z.number().optional(), title: z.string().min(1), content: z.string().min(1), date: z.string().or(z.date()), image: z.string().optional(), linkUrl: z.string().optional(), active: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const date = new Date(input.date);
        await upsertAnnouncement({ ...input, date });
        clearCachePrefix("announcements");
        return { success: true };
      }),
    deleteAnnouncement: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAnnouncement(input.id);
        clearCachePrefix("announcements");
        return { success: true };
      }),
  }),

  // ─── Delivery ──────────────────────────────────────────────────────────────
  delivery: router({
    getAgents: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const agentsList = await db.select().from(deliveryAgents);
      
      const activeOrders = await db.select({
        agentId: orders.deliveryAgentId,
        city: orders.shippingCity
      }).from(orders).where(eq(orders.status, "out_for_delivery"));

      return agentsList.map(agent => {
        const agentOrders = activeOrders.filter(o => o.agentId === agent.id);
        const activeCity = agentOrders.length > 0 ? agentOrders[0].city : null;
        const { pin, ...rest } = agent;
        return { ...rest, activeCity };
      });
    }),

    getDriverProfile: protectedProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [agent] = await db.select().from(deliveryAgents).where(eq(deliveryAgents.id, input.agentId)).limit(1);
        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Driver not found" });
        const { pin, ...rest } = agent;
        return rest;
      }),

    updateAvailability: protectedProcedure
      .input(z.object({ agentId: z.number(), isAvailable: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(deliveryAgents).set({ isAvailable: input.isAvailable }).where(eq(deliveryAgents.id, input.agentId));
        return { success: true };
      }),

    upsertAgent: adminProcedure
      .input(z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        phone: z.string().min(1),
        vehicleNumber: z.string().min(1),
        vehicleType: z.string().min(1),
        pin: z.string().optional(),
        isAvailable: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const dataToUpdate: any = {
          name: input.name,
          phone: input.phone,
          vehicleNumber: input.vehicleNumber,
          vehicleType: input.vehicleType,
        };
        if (input.isAvailable !== undefined) dataToUpdate.isAvailable = input.isAvailable;
        if (input.pin) dataToUpdate.pin = hashPassword(input.pin); // Hash the PIN before saving!

        if (input.id) {
          await db.update(deliveryAgents).set(dataToUpdate).where(eq(deliveryAgents.id, input.id));
        } else {
          if (!input.pin) throw new TRPCError({ code: "BAD_REQUEST", message: "PIN is required for new drivers" });
          await db.insert(deliveryAgents).values(dataToUpdate as any);
        }
        return { success: true };
      }),

    deleteAgent: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(deliveryAgents).where(eq(deliveryAgents.id, input.id));
        return { success: true };
    }),

    assignDelivery: adminProcedure
      .input(z.object({ orderId: z.number(), agentId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const [orderToAssign] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
        if (!orderToAssign) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

        const [agent] = await db.select().from(deliveryAgents).where(eq(deliveryAgents.id, input.agentId)).limit(1);
        if (!agent || !agent.isAvailable) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Agent not found or is currently offline" });
        }

        // Enforce Geographic Delivery Constraints
        const activeOrders = await db.select().from(orders).where(
          and(eq(orders.deliveryAgentId, agent.id), eq(orders.status, "out_for_delivery"))
        );
        if (activeOrders.length > 0) {
          if (activeOrders[0].shippingCity !== orderToAssign.shippingCity) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Agent is currently delivering in ${activeOrders[0].shippingCity}. You cannot assign them an order in ${orderToAssign.shippingCity}.` });
          }
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        await db.update(orders).set({
          deliveryAgentId: agent.id,
          deliveryOtp: otp,
        }).where(eq(orders.id, input.orderId));

        // Update the timeline so the customer sees the status change
        await updateOrderStatus(input.orderId, "out_for_delivery", `Assigned to delivery agent: ${agent.name}`);

        return { success: true, message: "Delivery assigned successfully!" };
      }),

    myDeliveries: protectedProcedure
      .input(z.object({ agentId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (input?.agentId) {
          return db.select().from(orders).where(
            and(
              eq(orders.status, "out_for_delivery"),
              eq(orders.deliveryAgentId, input.agentId)
            )
          );
        }
        return db.select().from(orders).where(eq(orders.status, "out_for_delivery"));
      }),

    verifyOtpAndComplete: protectedProcedure
      .input(z.object({ orderId: z.number(), otp: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        if (order.deliveryOtp !== input.otp) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid OTP code provided" });

        // Formally complete the delivery in the timeline
        await updateOrderStatus(input.orderId, "delivered", "Delivery successfully completed via OTP confirmation");
        return { success: true };
      }),

    verifyDriverPin: protectedProcedure
      .input(z.object({ phone: z.string(), pin: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [agent] = await db.select().from(deliveryAgents).where(eq(deliveryAgents.phone, input.phone)).limit(1);
        if (!agent) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid Phone Number or PIN" });

        const isHashed = agent.pin.includes(":");
        const isValid = isHashed ? verifyPassword(input.pin, agent.pin) : agent.pin === input.pin;

        if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid Phone Number or PIN" });

        // Auto-upgrade unhashed PINs for better security dynamically
        if (!isHashed) {
          await db.update(deliveryAgents).set({ pin: hashPassword(input.pin) }).where(eq(deliveryAgents.id, agent.id));
        }

        return { success: true, agentId: agent.id, agentName: agent.name };
      }),

    getEarnings: protectedProcedure
      .input(z.object({ agentId: z.number(), timeRange: z.string().default('week') }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const completedDeliveries = await db.select().from(orders).where(
          and(eq(orders.deliveryAgentId, input.agentId), eq(orders.status, "delivered"))
        );

        let totalEarned = 0;
        let today = 0, week = 0, month = 0;
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const chartMap = new Map(days.map(d => [d, 0]));
        const breakdown: any[] = [];

        completedDeliveries.forEach(d => {
          // Driver earns 80% of the shipping fee. You can adjust this percentage.
          const earned = parseFloat(d.shippingCost) * 0.8;
          totalEarned += earned;
          const dDate = new Date(d.updatedAt || d.createdAt);
          if (dDate >= startOfDay) today += earned;
          if (dDate >= startOfWeek) {
            week += earned;
            const dayName = days[dDate.getDay()];
            chartMap.set(dayName, (chartMap.get(dayName) || 0) + earned);
          }
          if (dDate >= startOfMonth) month += earned;
          breakdown.push({ orderNumber: d.orderNumber, date: dDate, earnings: earned });
        });

        let withdrawable = totalEarned;
        try {
          const payouts = await db.select().from(deliveryPayouts).where(
            and(eq(deliveryPayouts.agentId, input.agentId), or(eq(deliveryPayouts.status, 'completed'), eq(deliveryPayouts.status, 'pending')))
          );
          const totalPaidOrPending = payouts.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
          withdrawable = totalEarned - totalPaidOrPending;
        } catch(e) {}

        return {
          summary: { today, week, month, withdrawable },
          chartData: Array.from(chartMap.entries()).map(([day, earnings]) => ({ day, earnings })),
          breakdown: breakdown.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10),
        };
      }),

    requestPayout: protectedProcedure
      .input(z.object({ agentId: z.number(), amount: z.number() }))
      .mutation(async ({ input }) => {
        if (input.amount <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Amount must be positive." });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(deliveryPayouts).values({ agentId: input.agentId, amount: input.amount.toString(), status: 'pending' } as any);

        // --- SEND EMAIL NOTIFICATION TO ADMIN ---
        try {
          const emailSettings = await getSetting("email");
          const generalSettings = await getSetting("general");
          
          if (emailSettings?.smtpHost && generalSettings?.contactEmail) {
            const transporter = nodemailer.createTransport({
              host: emailSettings.smtpHost,
              port: Number(emailSettings.smtpPort),
              secure: Number(emailSettings.smtpPort) === 465,
              auth: {
                user: emailSettings.smtpUser,
                pass: emailSettings.smtpPassword,
              },
            });

            const [agent] = await db.select({ name: deliveryAgents.name }).from(deliveryAgents).where(eq(deliveryAgents.id, input.agentId)).limit(1);
            
            const currency = generalSettings.currency || "USD";
            const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(input.amount);

            await transporter.sendMail({
              from: `"${generalSettings.storeName || 'Store System'}" <${emailSettings.smtpUser}>`,
              to: generalSettings.contactEmail,
              subject: `🚨 New Driver Payout Request - ${formattedAmount}`,
              html: `
                <h3>New Payout Request Received</h3>
                <p>A new payout request has been submitted by a driver.</p>
                <ul>
                  <li><strong>Driver:</strong> ${agent?.name || `Agent ID ${input.agentId}`}</li>
                  <li><strong>Amount:</strong> ${formattedAmount}</li>
                </ul>
                <p>Please log in to the Admin Panel > Payments > Driver Payouts to review and process this request.</p>
              `,
            });
            console.log(`[Email] Payout request notification sent to ${generalSettings.contactEmail}`);
          }
        } catch (err) {
          console.error("Failed to send admin payout notification email:", err);
          // Do not fail the whole transaction if email fails, just log it.
        }

        return { success: true };
      }),

    getPayoutHistory: protectedProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return await db.select().from(deliveryPayouts).where(eq(deliveryPayouts.agentId, input.agentId)).orderBy(desc(deliveryPayouts.requestedAt));
      }),
  }),

  // ─── M-Pesa Callbacks ──────────────────────────────────────────────────────
  mpesa: router({
    b2cResult: publicProcedure.input(z.any()).mutation(async ({ input }) => {
      const { Result } = input;
      if (!Result || !Result.OriginatorConversationID) return { ResultCode: 1, ResultDesc: "Invalid payload" };
      const db = await getDb();
      if (db) {
        if (Result.ResultCode === 0) {
          await db.update(deliveryPayouts).set({ status: 'completed', processedAt: new Date(), transactionId: Result.TransactionID }).where(eq(deliveryPayouts.mpesaOriginatorConversationId, Result.OriginatorConversationID));
        } else {
          await db.update(deliveryPayouts).set({ status: 'failed', processedAt: new Date(), notes: Result.ResultDesc }).where(eq(deliveryPayouts.mpesaOriginatorConversationId, Result.OriginatorConversationID));
        }
      }
      return { ResultCode: 0, ResultDesc: "Accepted" };
    }),
    b2cQueueTimeout: publicProcedure.input(z.any()).mutation(async ({ input }) => {
      const db = await getDb();
      if (db && input.OriginatorConversationID) {
        await db.update(deliveryPayouts).set({ status: 'failed', notes: 'M-Pesa API request timed out.' }).where(eq(deliveryPayouts.mpesaOriginatorConversationId, input.OriginatorConversationID));
      }
      return { ResultCode: 0, ResultDesc: "Accepted" };
    }),
  }),

  // ─── Analytics ──────────────────────────────────────────────────────────────
  analytics: router({
    aiConversationStats: adminProcedure
      .input(z.object({ daysBack: z.number().default(7) }))
      .query(async ({ input }) => {
        const stats = await getAIConversationStats(input.daysBack);
        return stats;
      }),

    demandPrediction: adminProcedure
      .input(z.object({ daysBack: z.number().default(7) }))
      .query(async ({ input }) => {
        const predictions = await getDemandPrediction(input.daysBack);
        return predictions;
      }),

    pricingSuggestions: adminProcedure.query(async () => {
      const suggestions = await getPricingSuggestions();
      return suggestions;
    }),

    customerSegments: adminProcedure.query(async () => {
      const segments = await getUserSegments();
      return {
        budgetBuyers: segments.budget.length,
        premiumBuyers: segments.premium.length,
        frequentShoppers: segments.frequent.length,
      };
    }),

    productViews: adminProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return 0;
        const views = await db.select({ count: sql<number>`COUNT(*)` })
          .from(productViews)
          .where(eq(productViews.productId, input.productId));
        return views[0]?.count || 0;
      }),
  }),
});

export type AppRouter = typeof appRouter;

// ─── Background Worker ────────────────────────────────────────────────────────
export async function processAbandonedCheckouts() {
  try {
    const emailSettings = await getSetting("email");
    if (!emailSettings?.abandonedCartReminder || !emailSettings?.smtpHost || !emailSettings?.smtpUser) return;

    const db = await getDb();
    if (!db) return;

    // Look back exactly 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const abandonedOrders = await db.select().from(orders).where(
      and(
        eq(orders.paymentStatus, "pending"),
        eq(orders.status, "pending"),
        eq(orders.abandonedEmailSent, false),
        lt(orders.createdAt, twentyFourHoursAgo)
      )
    );

    if (abandonedOrders.length === 0) return;

    const appearance = await getSetting("appearance");
    const general = await getSetting("general");
    
    const storeName = general?.storeName || "Store";
    const storeCurrency = general?.currency || "USD";
    const logoUrl = appearance?.logoUrl;
    const primaryColor = emailSettings?.emailButtonColor || appearance?.primaryColor || "#3b82f6";
    const storePhone = general?.phone || "";
    const contactEmail = general?.contactEmail || "support@example.com";
    
    const transporter = nodemailer.createTransport({
      host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
      secure: Number(emailSettings.smtpPort) === 465,
      auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    for (const order of abandonedOrders) {
      const [customer] = order.userId ? await db.select().from(users).where(eq(users.id, order.userId)).limit(1) : [null];
      if (!customer || !customer.email) continue;

      const host = process.env.PUBLIC_URL || "http://localhost:3000";
      const fullHost = host.startsWith('http') ? host : `http://${host}`;
      const orderLink = `${host}/order-confirmation/${order.orderNumber}`;

      const items = await getOrderItems(order.id);
      const productIds = items.map(i => i.productId);
      const productsFromDb = await getProductsByIds(productIds);

      const emailHtml = getAbandonedCartEmailHtml({
        storeName, logoUrl, primaryColor, contactEmail, storePhone, storeCurrency,
        shippingFullName: order.shippingFullName,
        orderNumber: order.orderNumber,
        total: order.total,
        orderLink,
        host: fullHost,
        productImageWidth: emailSettings.productImageWidth,
        cartData: items.map(i => {
          const product = productsFromDb.find(p => p.id === i.productId);
          return { name: i.productName, slug: product?.slug, price: i.price, quantity: i.quantity, image: (product?.images as string[])?.[0] || null };
        }),
      });

      await transporter.sendMail({ from: `"${storeName}" <${emailSettings.smtpUser}>`, to: customer.email, subject: `Did you forget something? Complete your order at ${storeName}`, html: emailHtml });
      await db.update(orders).set({ abandonedEmailSent: true }).where(eq(orders.id, order.id));
      console.log(`[Email] Abandoned checkout reminder sent to ${customer.email} for order ${order.orderNumber}`);
    }
  } catch (err) { console.error("Error processing abandoned checkouts", err); }
}
