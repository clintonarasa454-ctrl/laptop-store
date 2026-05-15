import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { hashPassword, verifyPassword } from "./_core/passwordHash";
import { cacheGet, cacheSet, cacheDelPattern } from "./cache";
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
  logAuditAction,
} from "./db";
import {
  estimateDeliveryDays,
  getStockHeatmapByWarehouse,
  getStockVelocityTrends,
  getWarehouseImbalances,
  getDemandForecasts,
  getInventoryAging
} from "./inventoryAnalytics";
import { eq, and, lt, lte, gt, or, like, sql, inArray, desc, count } from "drizzle-orm";
import { users, categories as categoriesSchema, banners as bannersSchema, orders, payments, drivers, vehicles, assignments, products, deliveryPayouts, aiConversations, orderItems, productViews, deliveryMessages, productUnits, inventoryTransactions, warehouses, deletionRequests, staffMessages, pageViews, productInventory, inventoryTransfers, auditLogs } from "../drizzle/schema";
import nodemailer from "nodemailer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "crypto";
import Stripe from "stripe";
import { getVerificationEmailHtml, getResetPasswordEmailHtml, getOrderConfirmationEmailHtml, getShippingNotificationEmailHtml, getAbandonedCartEmailHtml, getOrderCancelledEmailHtml, getAdminOrderCancelledEmailHtml, getDriverPinEmailHtml, getBroadcastEmailHtml, getAIMarketingEmailHtml, getAutoRestockEmailHtml, getManagerWelcomeEmailHtml, getDismissalEmailHtml, getAppealResultEmailHtml } from "./emailTemplates";
import { getPaypalAccessToken, getMpesaAccessToken, getMpesaTimestamp, formatMpesaPhone, initiateB2CPayout } from "./paymentUtils";
import { makeRequest } from "./_core/map";
import OpenAI from "openai";
import webpush from "web-push";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@store.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ─── Validation Helpers ───────────────────────────────────────────────────────
function sanitizeMessageForDb(message: string): string {
  return message.slice(0, 5000).replace(/'/g, "''");
}

function validateAIResponse(reply: string): { valid: boolean; message: string } {
  if (!reply || typeof reply !== 'string') {
    return { valid: false, message: "Invalid AI response format" };
  }
  if (reply.length > 10000) {
    return { valid: false, message: "Response too long" };
  }
  if (reply.length < 5) {
    return { valid: false, message: "Response too short" };
  }
  return { valid: true, message: reply };
}

// ─── Address Sanitization Helper ───────────────────────────────────────────────
function sanitizeAddressField(value: any): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  let cleaned = value.trim();
  // Filter out "undefined", "null", "na", "n/a" (case-insensitive)
  if (/^(undefined|null|na|n\/a)$/i.test(cleaned)) {
    return '';
  }
  
  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Max length 256 for safety
  return cleaned.slice(0, 256);
}

function sanitizeOrderAddress(data: any) {
  return {
    ...data,
    shippingFullName: sanitizeAddressField(data.shippingFullName),
    shippingEmail: data.shippingEmail ? sanitizeAddressField(data.shippingEmail) : undefined,
    shippingAddress: sanitizeAddressField(data.shippingAddress),
    shippingCity: sanitizeAddressField(data.shippingCity),
    shippingCounty: data.shippingCounty ? sanitizeAddressField(data.shippingCounty) : undefined,
    shippingPostalCode: data.shippingPostalCode ? sanitizeAddressField(data.shippingPostalCode) : undefined,
    shippingCountry: sanitizeAddressField(data.shippingCountry),
  };
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

// ─── Manager guard ────────────────────────────────────────────────────────────
const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Manager or Admin access required" });
  }
  return next({ ctx });
});

// ─── Password Hashing (async, non-blocking) ────────────────────────────────
// Use the imported functions from passwordHash.ts for secure, non-blocking password operations

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

  search = search.replace(/\s+/g, ' ').trim();
  search = search.replace(/^(for|with|and|the|a|in|on)\b|\b(for|with|and|the|a|in|on)$/gi, '').trim();
  
  return { search: search || undefined, minPrice, maxPrice, brand, categoryId, sortBy, featured };
}

// ─── Secure JWT Secret Configuration ───────────────────────────────────────
function getSecureJWTSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim().length === 0) {
    throw new Error(
      "FATAL: JWT_SECRET is not configured. Set the JWT_SECRET environment variable before starting the server. " +
      "This is required for authentication security."
    );
  }
  return new TextEncoder().encode(jwtSecret);
}

const JWT_SECRET = getSecureJWTSecret();

export const appRouter = router({
  // ─── Health Check Endpoint (Blue-Green Deployment Monitoring) ───
  healthcheck: publicProcedure.query(async () => {
    try {
      const db = await getDb();
      // Lightweight query to ensure the database connection pool is responsive
      await db.select({ count: sql<number>`1` }).from(users).limit(1);
      return { status: "ok", db: "connected", timestamp: Date.now() };
    } catch (error) {
      return { status: "error", db: "disconnected", timestamp: Date.now() };
    }
  }),

  system: systemRouter,

  // ─── AI Assistant ──────────────────────────────────────────────────────────
  ai: router({
    // ─── Fetch Cross-Session Chat History ───
    getHistory: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select()
        .from(aiConversations)
        .where(eq(aiConversations.userId, ctx.user.id))
        .orderBy(desc(aiConversations.createdAt))
        .limit(30); // Load last 30 messages
    }),
    
    // ─── Clear Chat History ───
    clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (db) {
        await db.delete(aiConversations).where(eq(aiConversations.userId, ctx.user.id));
      }
      return { success: true };
    }),

    chat: publicProcedure
      .input(z.object({
        message: z.string().min(1),
        history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).default([]),
        cartContext: z.array(z.object({ productId: z.number(), quantity: z.number() })).optional(),
        userId: z.number().optional(),
        userEmail: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const aiSettings = db ? await getSetting("ai") : null;
        
        if (aiSettings?.enabled === false) {
          return { reply: "The AI Assistant is currently disabled by the store administrator." };
        }

        if (!process.env.GROQ_API_KEY) {
          return { reply: "I'm offline right now! Please ask the store administrator to configure the `GROQ_API_KEY` in the environment variables." };
        }
        
        const groq = new OpenAI({ 
          apiKey: process.env.GROQ_API_KEY,
          baseURL: "https://api.groq.com/openai/v1"
        });

        // ─── Detect message type ───
        let messageType: "product_recommendation" | "order_tracking" | "chat" = "chat";
        if (input.message.toLowerCase().includes("order") || input.message.toLowerCase().includes("track")) {
          messageType = "order_tracking";
        } else if (input.message.toLowerCase().includes("find") || input.message.toLowerCase().includes("recommend") || input.message.toLowerCase().includes("laptop")) {
          messageType = "product_recommendation";
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
            if (userPrefs && ((userPrefs.preferredBrands?.length ?? 0) > 0 || (userPrefs.preferredCategories?.length ?? 0) > 0)) {
              const brandStr = userPrefs.preferredBrands?.join(", ") || "";
              const budgetStr = userPrefs?.budgetMin && userPrefs?.budgetMax 
                ? `KES ${parseFloat(userPrefs.budgetMin as any).toLocaleString()} - KES ${parseFloat(userPrefs.budgetMax as any).toLocaleString()}`
                : "";
              personalizationContext = `\n\nBased on ${userPrefs?.viewCount || 0} product views, this user prefers: ${[brandStr, budgetStr].filter(Boolean).join(", ")}. Tailor recommendations accordingly.`;
            }
          } catch (e) {
            // Silent fail
          }
        }

        // ─── Store Context (Categories & Brands) ───
        let storeContext = "";
        if (db) {
          try {
            const cacheKey = "ai_store_context";
            const cachedContext = await cacheGet<string>(cacheKey);
            if (cachedContext) storeContext = cachedContext;
            else {
              const allCats = await getCategories();
              const catNames = allCats.filter(c => c.active !== false).map(c => c.name).join(", ");
              const brandsSetting = await getSetting("brands");
              const brandNames = Array.isArray(brandsSetting) ? brandsSetting.join(", ") : "Samsung, Dell, HP, Lenovo, Asus, Apple, Acer";
              storeContext = `\n\n**Store Catalog Info:**\nWe sell products in these categories: ${catNames}.\nAvailable brands include: ${brandNames}.`;
              await cacheSet(cacheKey, storeContext, 3600);
            }
          } catch(e) {}
        }

        // ─── Intelligent Product Search ───
        let productContext = "";
        let finalRecommendedProducts: any[] = [];
        if (db && aiSettings?.allowProductSearch !== false) {
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
                    const specs = (p as any).specifications 
                      ? Object.entries((p as any).specifications as Record<string, string>)
                          .map(([k, v]) => `${k}: ${String(v).substring(0, 100)}`)
                          .slice(0, 10)
                          .join(", ")
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
                      image: (p.images as string[])?.[0] || null,
                    };
                  });

                if (relevantProducts.length > 0) {
                  // Isolate the top 3 products so the frontend can render Generative UI cards
                  finalRecommendedProducts = relevantProducts.slice(0, 3);
                  
                  productContext = `\n\nWe have these matching products available:\n${relevantProducts.slice(0, 5).map((p, idx) => 
                    `${idx + 1}. ${p.name} by ${p.brand || "Unknown"}\n` +
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
        if (db && aiSettings?.allowOrderTracking !== false && (messageLower.includes("order") || messageLower.includes("track") || messageLower.includes("delivery") || messageLower.includes("ship"))) {
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

        // ─── Structured Knowledge Base Context ───
        let knowledgeBaseContext = "";
        if (db) {
          try {
            const cacheKey = "ai_knowledge";
            const cachedKb = await cacheGet<string>(cacheKey);
            if (cachedKb !== null) {
              knowledgeBaseContext = cachedKb ? `\n\n**Store Knowledge Base (CRITICAL FACTS):**\n${cachedKb}` : "";
            } else {
              const kb = await getSetting("ai_knowledge");
              knowledgeBaseContext = kb ? `\n\n**Store Knowledge Base (CRITICAL FACTS):**\n${kb}` : "";
              await cacheSet(cacheKey, kb || "", 3600);
            }
          } catch(e) {}
        }

        let baseRules = `⚠️ CRITICAL RULES & RESPONSE FORMAT - FOLLOW STRICTLY:

🔒 INVENTORY CONTROL (NON-NEGOTIABLE):
1. ONLY recommend products from the list provided in "We have these matching products available"
2. NEVER mention products outside our database
3. NEVER invent product names, specs, or prices
4. NEVER direct users to external websites or search elsewhere
5. If a requested product is unavailable, respond:
   "I don't have that exact model in stock, but I can recommend some great alternatives from our inventory."

🧠 CONVERSATION FLOW (SMART ASSISTANT BEHAVIOR):
6. ALWAYS understand intent before recommending:
   - If user asks for a recommendation but DOES NOT specify a price/budget → ASK for their budget first
   - ⚠️ CRITICAL: If you are asking for their budget, DO NOT list any products in that same response. STOP and wait for their reply!
   - Example: "I'd love to help you find something great 😊 What budget range are you working with?"

7. GUIDE THE USER (DON’T JUST ANSWER):
   - If user is unsure → suggest ranges (e.g., low / mid / premium)
   - If user gives a budget → optimize for BEST VALUE within that range

8. RECOMMENDATION DEPTH:
   - When you DO recommend products, ALWAYS provide 2–4 options (not just 1)
   - Mix: best value + best performance + balanced option
   - Help user COMPARE naturally

💬 TONE & PERSONALITY:
9. Be warm, natural, and helpful — like a knowledgeable store assistant
   - Use conversational phrasing (not robotic)
   - Example: "Nice choice!", "You're in a great range for solid performance", etc.
   - Avoid labels like "Short Intro:" or "Conclusion:"

10. Keep responses:
   - Clear
   - Friendly
   - Easy to scan

📦 RESPONSE FORMAT (STRICT):
11. DO NOT use markdown tables

12. ALWAYS structure product recommendations like this:

   1. Product Name — KES [Price]

      **Key Specs:**
      - [2–4 important specs only]

      **Why it's a great pick:**
      - [Short, natural explanation tailored to user's need]

13. After listing products:
   - Add a short guiding sentence like:
     "If you tell me what matters most (battery, performance, display, etc.), I can narrow it down for you 👍"

🚀 INTELLIGENCE BOOST:
14. Prioritize relevance over quantity:
   - Match products to user's use-case (gaming, office work, student, etc.)
   - Avoid listing random items just to fill space

15. If only 1 product fits:
   - Still recommend it confidently
   - Explain clearly why it's the best available option

🧠 MEMORY & ADAPTABILITY:
16. MEMORY (WITHIN CONVERSATION):
   - Remember user's previous preferences (budget, brand, use-case)
   - Do NOT ask the same question twice

17. ADAPTIVE RESPONSES:
   - If user refines request → update recommendations instead of restarting

🛒 CART ACTIONS:
18. ${input.userId ? `If the user explicitly asks to add a product to their cart, you MUST append this EXACT tag to your response: ||ADD_TO_CART: [product_id]|| (Replace [product_id] with the numeric ID of the product).` : `If the user asks to add a product to their cart, politely tell them that as a guest, they should click the "Add to Cart" button directly on the product card.`}

IMPORTANT: You MUST format the product name as a clickable markdown link pointing to its exact URL slug!`;

        let customDirective = "";
        if (aiSettings?.systemPrompt) {
          try {
            const generalSettings = await getSetting("general");
            const sName = generalSettings?.storeName || "our store";
            customDirective = `**Core AI Directive:**\n${aiSettings.systemPrompt.replace(/\bNexus\b/gi, sName)}\n\n`;
          } catch(e) {}
        }

        const systemPrompt = `${customDirective}You are an expert AI sales assistant for a tech store specializing in laptops and accessories. Your role is to:
1. Help customers find the perfect laptop or accessory from our catalog
2. Answer technical questions clearly and accurately
3. Provide honest recommendations based on budget and needs
4. Help track orders and deliveries
5. Help admins upload and manage bulk products (detect when user says "upload", "bulk add", "add products")
6. Reference specific products when relevant
7. Be concise, friendly, and professional

${baseRules}

For product uploads: When asked to help add products, ask for CSV data or descriptions and help structure the data.
Keep responses under 3 sentences unless asked for more detail.
AT THE VERY END of your response, you MUST append exactly 3 relevant follow-up questions formatted exactly like this: ||SUGGESTIONS: Question 1 | Question 2 | Question 3||${cartInfo}${personalizationContext}${storeContext}${productContext}${demandContext}${pricingContext}${orderContext}${knowledgeBaseContext}`;

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

        let rawReply = response.choices[0].message.content || "I couldn't process that right now. Please try again.";
        
        // ─── Validate AI response ───
        const validation = validateAIResponse(rawReply);
        if (!validation.valid) {
          return { reply: validation.message };
        }
        let reply = validation.message;
        let suggestions: string[] = [];

        // Pluck the ADD_TO_CART safely out of the response
        const addToCartMatch = reply.match(/\|\|ADD_TO_CART:\s*(\d+)\s*\|\|/i);
        let addedProductId: number | null = null;
        if (addToCartMatch) {
          addedProductId = parseInt(addToCartMatch[1], 10);
          reply = reply.replace(addToCartMatch[0], '').trim();
        }

        // Pluck the suggestions safely out of the response  
        const suggestionMatch = reply.match(/\|\|SUGGESTIONS:(.*?)\|\|/gi);
        if (suggestionMatch && suggestionMatch.length > 0) {
          suggestions = suggestionMatch[0].replace(/\|\|SUGGESTIONS:/gi, '').replace(/\|\|/g, '').split('|').map(s => s.trim()).filter(Boolean);
          reply = reply.replace(suggestionMatch[0], '').trim();
        }
        
        
        // ─── Log conversation & Execute Actions ───
        if (db) {
          try {
            // Execute Add to Cart action if requested
            if (addedProductId && input.userId) {
               const currentCart = await getCartItems(input.userId);
               const existingItem = currentCart.find(i => i.productId === addedProductId);
               const newQty = existingItem ? existingItem.quantity + 1 : 1;
               await upsertCartItem(input.userId, addedProductId, newQty);
            }

            await logAIConversation(input.userId || null, input.userEmail || null, "user", input.message, messageType);
            await logAIConversation(input.userId || null, input.userEmail || null, "assistant", reply, messageType);
            
            // Update user preferences (track interactions)
            if (input.userId) {
              const userPrefs = await getUserPreferences(input.userId);
              if (userPrefs) {
                await updateUserPreferences(input.userId, {
                  purchaseCount: (userPrefs.purchaseCount || 0) + 1,
                });
              } else {
                await updateUserPreferences(input.userId, {
                  purchaseCount: 1,
                });
              }
            }
          } catch (e) {
            // Silent fail - don't break the chat if logging fails
          }
        }

        return { 
          reply: reply,
          products: finalRecommendedProducts.length > 0 ? finalRecommendedProducts : undefined,
          suggestions: suggestions.length > 0 ? suggestions : undefined
        };
      }),

    // ─── Driver Chat for Dashboard ───
    driverChat: publicProcedure
      .input(z.object({
        message: z.string().min(1),
        history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).default([]),
        agentId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const aiSettings = db ? await getSetting("ai") : null;
        
        if (aiSettings?.enabled === false) {
          return { reply: "The Delivery Assistant is currently disabled.", suggestions: [] };
        }

        if (!process.env.GROQ_API_KEY) {
          return { reply: "I'm offline right now! Please contact the administrator." };
        }
        
        const groq = new OpenAI({ 
          apiKey: process.env.GROQ_API_KEY,
          baseURL: "https://api.groq.com/openai/v1"
        });

        let driverContext = "";
        if (db && input.agentId) {
          try {
            const activeDeliveries = await db.select().from(orders).where(
              and(eq(orders.deliveryAgentId, input.agentId), eq(orders.status, "out_for_delivery"))
            );
            
            driverContext = `\n\n**Driver Context:**\nYou have ${activeDeliveries.length} active deliveries assigned to you right now.`;
            if (activeDeliveries.length > 0) {
              driverContext += `\nActive Orders:\n${activeDeliveries.map(d => `- Order #${d.orderNumber}: Deliver to ${d.shippingFullName} at ${d.shippingAddress}, ${d.shippingCity}. Phone: ${d.shippingPhone}. OTP required: Yes.`).join("\n")}`;
            }
          } catch(e) {}
        }

        let knowledgeBaseContext = "";
        try {
          if (db) {
            const cacheKey = "ai_knowledge";
            const cachedKb = await cacheGet<string>(cacheKey);
            if (cachedKb !== null) {
              knowledgeBaseContext = cachedKb ? `\n\n**Store Knowledge Base (CRITICAL FACTS):**\n${cachedKb}` : "";
            } else {
              const kb = await getSetting("ai_knowledge");
              knowledgeBaseContext = kb ? `\n\n**Store Knowledge Base (CRITICAL FACTS):**\n${kb}` : "";
              await cacheSet(cacheKey, kb || "", 3600);
            }
          }
        } catch(e) {}

        let customDirective = "";
        if (aiSettings?.systemPrompt) {
          try {
            const generalSettings = await getSetting("general");
            const sName = generalSettings?.storeName || "our store";
            customDirective = `**Core AI Directive:**\n${aiSettings.systemPrompt.replace(/\bNexus\b/gi, sName)}\n\n`;
          } catch(e) {}
        }

        const systemPrompt = `${customDirective}You are an intelligent Delivery Assistant for store drivers. Your role is to:
1. Help the driver manage their active deliveries and routes.
2. Provide details about their assigned orders based on the context provided.
3. Answer general questions about the delivery process, confirming OTPs, and requesting payouts.
4. Be concise, direct, and helpful.
AT THE VERY END of your response, append exactly 3 relevant follow-up questions formatted exactly like this: ||SUGGESTIONS: Question 1 | Question 2 | Question 3||

⚠️ CRITICAL RULES:
- ONLY reference the active deliveries provided in your context.
- If the driver asks about earnings or payouts, instruct them to switch to the "Earnings" tab on their dashboard to view details or request a payout.
- Do not make up order details.${driverContext}${knowledgeBaseContext}`;

        let messages: any[] = [{ role: "system", content: systemPrompt }, ...input.history, { role: "user", content: input.message }];
        const response = await groq.chat.completions.create({ model: "llama-3.3-70b-versatile", messages, temperature: 0.7, max_tokens: 1024 });
        let rawReply = response.choices[0].message.content || "I couldn't process that right now. Please try again.";
        
        const validation = validateAIResponse(rawReply);
        if (!validation.valid) {
          return { reply: validation.message, suggestions: [] };
        }
        let reply = validation.message;
        
        let suggestions: string[] = [];
        const suggestionMatch = reply.match(/\|\|SUGGESTIONS:(.*?)\|\|/gi);
        if (suggestionMatch?.length) {
          const match = suggestionMatch[0];
          const contentMatch = match.match(/\|\|SUGGESTIONS:(.*)\|\|/i);
          if (contentMatch) {
            suggestions = contentMatch[1].split('|').map(s => s.trim()).filter(Boolean);
            reply = reply.replace(match, '').trim();
          }
        }
        return { reply, suggestions };
      }),

    // ─── Admin Chat for Dashboard ───
    adminChat: managerProcedure
      .input(z.object({
        message: z.string().min(1),
        history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).default([]),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const aiSettings = db ? await getSetting("ai") : null;
        
        if (aiSettings?.enabled === false) {
          return { reply: "The AI Assistant is currently disabled globally.", commands: [] };
        }

        if (!process.env.GROQ_API_KEY) {
          return { reply: "Admin AI is offline. Please configure GROQ_API_KEY.", commands: [] };
        }
        
        const groq = new OpenAI({ 
          apiKey: process.env.GROQ_API_KEY,
          baseURL: "https://api.groq.com/openai/v1"
        });

        // ─── Admin Context: Sales Stats ───
        let statsContext = "";
        if (aiSettings?.allowAdminStats !== false) {
          try {
            if (db) {
            const cacheKey = "ai_admin_stats";
            const cachedStats = await cacheGet<string>(cacheKey);
            if (cachedStats) statsContext = cachedStats;
            else {
              let conditions = [];
              if (ctx.user.role === "manager" && ctx.user.warehouseId) {
                conditions.push(eq(orders.originWarehouseId, ctx.user.warehouseId));
              }
              const totalOrdersResult = await db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(conditions.length > 0 ? and(...conditions) : undefined);
              const totalOrders = totalOrdersResult[0]?.count || 0;
              const revConditions = [eq(orders.status, 'delivered')];
              if (ctx.user.role === "manager" && ctx.user.warehouseId) revConditions.push(eq(orders.originWarehouseId, ctx.user.warehouseId));
              const totalRevenueResult = await db.select({ sum: sql<number>`SUM(CAST(${orders.total} AS DECIMAL(10,2)))` }).from(orders).where(and(...revConditions));
              const totalRevenue = totalRevenueResult[0]?.sum || 0;
              const topProductsResult = await db.select({ name: products.name, count: sql<number>`COUNT(*)` }).from(orderItems).leftJoin(products, eq(orderItems.productId, products.id)).groupBy(orderItems.productId).orderBy(desc(sql<number>`COUNT(*)`)).limit(3);
              statsContext = `\n\n**Store Analytics:**\nTotal Orders: ${totalOrders}\nTotal Revenue: KES ${parseFloat(totalRevenue as any).toLocaleString()}\nTop Products: ${topProductsResult.map(p => p.name).join(", ")}`;
              await cacheSet(cacheKey, statsContext, 60);
            }
            }
          } catch (e) {
            // Silent fail
          }
        }

        // ─── Admin Context: Store Catalog ───
        let storeContext = "";
        try {
          if (db) {
            const cacheKey = "ai_store_context";
            const cachedContext = await cacheGet<string>(cacheKey);
            if (cachedContext) storeContext = cachedContext;
            else {
              const allCats = await getCategories();
              const catNames = allCats.filter(c => c.active !== false).map(c => c.name).join(", ");
              const brandsSetting = await getSetting("brands");
              const brandNames = Array.isArray(brandsSetting) ? brandsSetting.join(", ") : "Samsung, Dell, HP, Lenovo, Asus, Apple, Acer";
              storeContext = `\n\n**Store Catalog Info:**\nCategories: ${catNames}\nBrands: ${brandNames}`;
              await cacheSet(cacheKey, storeContext, 3600);
            }
          }
        } catch (e) {}

        // ─── Admin Context: Recent Orders ───
        let recentOrdersContext = "";
        try {
          if (db) {
            const recentOrders = await db.select({ 
              orderNumber: orders.orderNumber, 
              status: orders.status, 
              total: orders.total,
              customerName: orders.shippingFullName
            })
              .from(orders)
              .where(ctx.user.role === "manager" && ctx.user.warehouseId ? eq(orders.originWarehouseId, ctx.user.warehouseId) : undefined)
              .orderBy(desc(orders.createdAt))
              .limit(5);
            
            if (recentOrders.length > 0) {
              recentOrdersContext = `\n\n**Recent Orders:**\n${recentOrders.map(o => 
                `${o.orderNumber}: ${o.customerName} - KES ${parseFloat(o.total as any).toLocaleString()} (${o.status})`
              ).join("\n")}`;
            }
          }
        } catch (e) {
          // Silent fail
        }

        // ─── Admin Context: Inventory & Alerts ───
        let alertContext = "";
        try {
          if (db) {
            const lowStockProducts = await db.select({ name: products.name, stock: products.stock }).from(products).where(lt(products.stock, 5)).limit(5);
            const pendingPayouts = await db.select({ count: sql<number>`COUNT(*)` }).from(deliveryPayouts).where(eq(deliveryPayouts.status, 'pending'));
            const pendingPayoutsCount = pendingPayouts[0]?.count || 0;

            if (lowStockProducts.length > 0 || pendingPayoutsCount > 0) {
              alertContext = `\n\n**Actionable Alerts:**\n`;
              if (lowStockProducts.length > 0) {
                alertContext += `- Low Stock Items: ${lowStockProducts.map(p => `${p.name} (${p.stock} left)`).join(", ")}\n`;
              }
              if (pendingPayoutsCount > 0) {
                alertContext += `- Pending Driver Payouts: ${pendingPayoutsCount} requests waiting for approval.\n`;
              }
            }
          }
        } catch (e) {}

        let knowledgeBaseContext = "";
        try {
          if (db) {
            const cacheKey = "ai_knowledge";
            const cachedKb = await cacheGet<string>(cacheKey);
            if (cachedKb !== null) {
              knowledgeBaseContext = cachedKb ? `\n\n**Store Knowledge Base (CRITICAL FACTS):**\n${cachedKb}` : "";
            } else {
              const kb = await getSetting("ai_knowledge");
              knowledgeBaseContext = kb ? `\n\n**Store Knowledge Base (CRITICAL FACTS):**\n${kb}` : "";
              await cacheSet(cacheKey, kb || "", 3600);
            }
          }
        } catch(e) {}

        let customDirective = "";
        if (aiSettings?.systemPrompt) {
          try {
            const generalSettings = await getSetting("general");
            const sName = generalSettings?.storeName || "our store";
            customDirective = `**Core AI Directive:**\n${aiSettings.systemPrompt.replace(/\bNexus\b/gi, sName)}\n\n`;
          } catch(e) {}
        }

        const systemPrompt = `${customDirective}You are an advanced AI ERP/Store Management Assistant for the admin panel. Your role is to act as a highly capable system administrator and data analyst.
Your capabilities:
1. Analyze store analytics, revenue, and customer behavior.
2. Monitor inventory levels and alert on low stock.
3. Manage delivery logistics and driver payout requests.
4. Execute commands to navigate the admin panel or click on elements.

**Response Format:**
Your response MUST be a valid JSON object with three keys: "reply" (a string for the chat message), "commands" (an array of actions to execute), and "suggestions" (an array of 3 relevant follow-up questions).

**Available Commands:**
- Navigate: \`{"type": "navigate", "payload": {"path": "/admin/products"}, "description": "Navigating to products page"}\`
- Click: \`{"type": "click", "payload": {"selector": "#add-product-btn"}, "description": "Clicking the add product button"}\`

**Admin Panel Navigation Paths:**
- Dashboard: /admin
- Analytics: /admin/analytics
- Products: /admin/products
- Brands: /admin/brands
- Categories: /admin/categories
- Orders: /admin/orders
- Payments: /admin/payments
- Customers: /admin/customers
- Drivers: /admin/drivers
- Content: /admin/content
- AI Settings: /admin/ai
- Settings: /admin/settings

**Example Interaction:**
User: "Show me the products page"
AI Response (JSON):
{
  "reply": "Navigating you to the products page now.",
  "commands": [
    {"type": "navigate", "payload": {"path": "/admin/products"}, "description": "Navigating to products page"}
  ]
}

⚠️ CRITICAL: 
- ALWAYS respond with a valid JSON object containing 'reply' and 'commands'. The 'commands' array can be empty if no action is required.
- ONLY reference data provided in your context.
- Be highly professional, analytical, and actionable. Provide insights based on the data.${statsContext}${storeContext}${recentOrdersContext}${alertContext}${knowledgeBaseContext}`;

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
          response_format: { type: "json_object" },
        });

        const rawReply = response.choices[0].message.content || '{"reply": "I couldn\'t process that right now. Please try again.", "commands": [], "suggestions": []}';
        
        const validation = validateAIResponse(rawReply);
        if (!validation.valid) {
            return { reply: validation.message, commands: [], suggestions: [] };
        }

        try {
            const parsedReply = JSON.parse(validation.message);
            if (typeof parsedReply.reply === 'string' && Array.isArray(parsedReply.commands)) return parsedReply;
            return { reply: "I had trouble formatting my response. Please try again.", commands: [] };
        } catch (e) {
            console.error("Failed to parse AI JSON response:", rawReply);
            return { reply: "I had trouble formatting my response. Please try again.", commands: [] };
        }
      }),
  }),

  // ─── Staff Chat (Admin <-> Manager) ─────────────────────────────────────────
  staffChat: router({
    getUnreadCount: managerProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return 0;
      
      const result = await db
        .select({ count: count() })
        .from(staffMessages)
        .where(
          and(
            eq(staffMessages.receiverId, ctx.user.id),
            eq(staffMessages.isRead, false)
          )
        );
      return result[0]?.count || 0;
    }),
    markAsRead: managerProcedure
      .input(z.object({ contactId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return;
        await db.update(staffMessages).set({ isRead: true }).where(and(eq(staffMessages.receiverId, ctx.user.id), eq(staffMessages.senderId, input.contactId), eq(staffMessages.isRead, false)));
      }),
    getContacts: managerProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      if (ctx.user.role === "admin") {
        return await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.role, "manager"));
      } else if (ctx.user.role === "manager") {
        return await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.role, "admin"));
      }
      return [];
    }),
    getMessages: managerProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        return await db.select().from(staffMessages).where(
          or(
            and(eq(staffMessages.senderId, ctx.user.id), eq(staffMessages.receiverId, input.contactId)),
            and(eq(staffMessages.senderId, input.contactId), eq(staffMessages.receiverId, ctx.user.id))
          )
        ).orderBy(staffMessages.createdAt);
      }),
    sendMessage: managerProcedure
      .input(z.object({ receiverId: z.number(), content: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [newMessage] = await db.insert(staffMessages).values({ senderId: ctx.user.id, receiverId: input.receiverId, content: input.content }).returning();
        return newMessage;
      }),
  }),

  // ─── Public Store Stats ──────────────────────────────────────────────────────
  store: router({
    stats: publicProcedure.query(async () => {
      const cached = await cacheGet("storeStats");
      if (cached) return cached;
      const data = await getStoreStats();
      await cacheSet("storeStats", data, 60); // Cache stats for 1 minute
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
      .output(z.any())
      .query(async ({ input }) => {
        const cacheKey = `settings-${input.keys.sort().join(",")}`;
        const cached = await cacheGet<Record<string, any>>(cacheKey);
        if (cached) return cached;

        // Only allow public-facing settings to be queried unauthenticated
        const allowed = ["general", "appearance", "social", "payment_methods", "brands", "shipping", "ai"];
        const result: Record<string, any> = {};
        for (const k of input.keys) {
          if (allowed.includes(k)) {
            result[k] = await getSetting(k);
          }
        }
        await cacheSet(cacheKey, result, 86400); // Cache for 24 hours (cleared automatically on admin update)
        return result;
      }),
  }),

  content: router({
    banners: publicProcedure.query(async () => {
      const cached = await cacheGet("banners-active");
      if (cached) return cached;
      const data = await getBanners({ activeOnly: true });
      await cacheSet("banners-active", data, 86400); // Cache for 24 hours
      return data;
    }),
    promotions: publicProcedure.query(async () => {
      const cached = await cacheGet("promotions-active");
      if (cached) return cached;
      const data = await getPromotions({ activeOnly: true });
      await cacheSet("promotions-active", data, 86400); // Cache for 24 hours
      return data;
    }),
    announcements: publicProcedure.query(async () => {
      const cached = await cacheGet("announcements-active");
      if (cached) return cached;
      const data = await getAnnouncements({ activeOnly: true });
      await cacheSet("announcements-active", data, 86400); // Cache for 24 hours
      return data;
    }),
  }),

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user || null),
    logout: publicProcedure.mutation(({ ctx }) => {
      const isSecure = ctx.req.protocol === "https" || ctx.req.headers["x-forwarded-proto"] === "https";
      const cookieOpts = {
        httpOnly: true, path: "/", secure: isSecure, sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
      };
      if (typeof (ctx.res as any).clearCookie === "function") {
        (ctx.res as any).clearCookie(COOKIE_NAME, cookieOpts);
      } else {
        const sameSiteStr = cookieOpts.sameSite === "none" ? "None" : "Lax";
        (ctx.res as any).setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=${sameSiteStr}${isSecure ? "; Secure" : ""}`);
      }
      return { success: true } as const;
    }),

    saveUserPushSubscription: protectedProcedure
      .input(z.object({ 
        subscription: z.object({
          endpoint: z.string().url(),
          keys: z.object({
            auth: z.string(),
            p256dh: z.string()
          })
        })
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        try {
          // Validate subscription structure before saving
          if (!input.subscription.endpoint || !input.subscription.keys?.auth || !input.subscription.keys?.p256dh) {
            throw new Error("Invalid subscription structure: missing endpoint or keys");
          }
          
          await db.update(users).set({ pushSubscription: input.subscription }).where(eq(users.id, ctx.user.id));
          console.log(`✅ Push subscription saved for customer ${ctx.user.id}`);
          return { success: true, message: "Push subscription saved successfully" };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`❌ Failed to save push subscription for customer ${ctx.user.id}:`, errorMsg);
          throw new TRPCError({ code: "BAD_REQUEST", message: errorMsg });
        }
      }),

    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(2),
          email: z.string().email(),
          phone: z.string().optional(),
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
          const existingUsers = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, input.email));
          const roleExists = existingUsers.find(u => u.role === "user");
          if (roleExists) throw new TRPCError({ code: "CONFLICT", message: "Email already in use by another customer" });

          if (input.phone) {
            const existingPhone = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.phone, input.phone));
            if (existingPhone.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Phone number already in use by another account" });
          }

          const openId = `local-${nanoid()}`;
          const hashedPassword = await hashPassword(input.password);
          
          await db.insert(users).values({
            openId,
            name: input.name,
            email: input.email,
            phone: input.phone || undefined,
            password: hashedPassword,
            loginMethod: "email",
            role: "user",
            lastSignedIn: new Date()
          });
        } catch (err: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `DB Error: ${err.message}` });
        }

        const accounts = await db.select().from(users).where(eq(users.email, input.email));
        const user = accounts.find(a => a.role === "user");
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
            name: input.name, otp,
            emailBackgroundColor: emailSettings?.emailBackgroundColor,
            theme: emailSettings?.theme,
            customTemplate: emailSettings?.customTemplates?.verification
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
          email: z.string().trim().toLowerCase().min(1, "Email or phone number is required"), 
          password: z.string().min(1, "Password is required"),
          isAdminLogin: z.boolean().optional()
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed. Please check your DATABASE_URL variable." });

        const accounts = await db.select().from(users).where(
          or(
            eq(users.email, input.email),
            eq(users.phone, input.email)
          )
        );
        if (accounts.length === 0) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }

        let user;
        if (input.isAdminLogin) {
          user = accounts.find(a => a.role === "admin" || a.role === "manager");
          if (!user) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to access the admin panel." });
          }
        } else {
          user = accounts.find(a => a.role === "admin" || a.role === "manager") || accounts.find(a => a.role === "user") || accounts[0];
        }

        if (!user || !user.password) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }

        const [salt, hash] = user.password.split(':');
        const isValid = await verifyPassword(input.password, hash, salt);
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }

        // Enforce email verification for standard users.
        // Managers and Admins are created directly by the system admin, so we implicitly trust their emails and auto-verify them.
        if (user.emailVerified === false) {
          if (user.role === "admin" || user.role === "manager") {
            if (db) await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
            user.emailVerified = true;
          } else {
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
        }

        if (user.suspended) {
          const dismissal = await getSetting(`dismissal_manager_${user.id}`);
          if (dismissal) {
            throw new TRPCError({ code: "FORBIDDEN", message: `Access denied due to violation of company rules: ${dismissal.reason}` });
          }
          throw new TRPCError({ code: "FORBIDDEN", message: "Your account is suspended." });
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

        return { success: true, requiresPasswordChange: user.requiresPasswordChange };
      }),
    resetPasswordRequest: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const accounts = await db.select().from(users).where(eq(users.email, input.email));
        const user = accounts[0];
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const token = await new SignJWT({ email: user.email, name: user.name, purpose: "reset", otp })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("30m")
          .sign(JWT_SECRET);

        const host = ctx.req.headers.host || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        
        let portalName = "Store";
        let resetPath = "/auth?mode=reset";
        
        if (user.role === "admin") {
          portalName = "Admin Panel";
          resetPath = "/admin";
        } else if (user.role === "manager") {
          portalName = "Manager Portal";
          resetPath = "/manager";
        }
        
        const sep = resetPath.includes("?") ? "&" : "?";
        const resetLink = `${protocol}://${host}${resetPath}${sep}email=${encodeURIComponent(user.email)}&token=${token}`;

        try {
          const emailSettings = await getSetting("email");
          const appearance = await getSetting("appearance");
          const general = await getSetting("general");
          
          const storeName = general?.storeName || "Store";
          const logoUrl = appearance?.logoUrl;
          const primaryColor = emailSettings?.emailButtonColor || appearance?.primaryColor || "#3b82f6";
          const storePhone = general?.phone || "";
          const contactEmail = general?.contactEmail || "support@example.com";
          
          const emailHtml = getResetPasswordEmailHtml({
            storeName, logoUrl, primaryColor, contactEmail, storePhone,
            name: user.name || 'there', otp,
            resetLink,
            portalName,
            emailBackgroundColor: emailSettings?.emailBackgroundColor,
            theme: emailSettings?.theme,
            customTemplate: emailSettings?.customTemplates?.resetPassword
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
             if (user.email) {
               await transporter.sendMail({
                 from: `"${storeName}" <${emailSettings.smtpUser}>`, to: user.email, subject: `Password Reset Request - ${storeName}`,
                 html: emailHtml
               });
             }
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
          const db = await getDb();
          if (!db) throw new Error();
          const accounts = await db.select().from(users).where(eq(users.email, payload.email as string));
          if (accounts.length === 0) throw new Error();
          const hashedPassword = await hashPassword(input.newPassword);
          await db.update(users).set({ password: hashedPassword }).where(eq(users.email, payload.email as string));
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
          
          const db = await getDb();
          if (!db) throw new Error();
          const accounts = await db.select().from(users).where(eq(users.email, payload.email as string));
          if (accounts.length === 0) throw new Error();
          
          await db.update(users).set({ emailVerified: true }).where(eq(users.email, payload.email as string));
          
          return { success: true };
        } catch (err: any) { 
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired verification token" }); 
        }
      }),
    resendVerification: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const accounts = await db.select().from(users).where(eq(users.email, input.email));
        const user = accounts[0];
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
            name: user.name || 'there', otp, isResend: true,
            emailBackgroundColor: emailSettings?.emailBackgroundColor,
            theme: emailSettings?.theme,
            customTemplate: emailSettings?.customTemplates?.verification
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
          // Rollback user creation if email fails so they can try registering again
          if (db) await db.delete(users).where(eq(users.email, input.email));
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
        const [salt, hash] = user.password.split(':');
        const isValid = await verifyPassword(input.currentPassword, hash, salt);
        if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect current password" });
        const updateData: any = { name: input.name, email: input.email };
        if (input.newPassword) updateData.password = await hashPassword(input.newPassword);
        await db.update(users).set(updateData).where(eq(users.email, user.email));
        return { success: true };
      }),

    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1),
          newPassword: z.string()
            .min(8, "Password must be at least 8 characters")
            .regex(/[A-Z]/, "Password must contain an uppercase letter")
            .regex(/[a-z]/, "Password must contain a lowercase letter")
            .regex(/[0-9]/, "Password must contain a number")
            .regex(/[^A-Za-z0-9]/, "Password must contain a symbol"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (!user || !user.password) throw new TRPCError({ code: "BAD_REQUEST", message: "Account does not have a password set" });
        const [salt, hash] = user.password.split(':');
        const isValid = await verifyPassword(input.currentPassword, hash, salt);
        if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect current password" });
        const newHashed = await hashPassword(input.newPassword);
        await db.update(users).set({ password: newHashed, requiresPasswordChange: false }).where(eq(users.email, user.email));
        return { success: true };
      }),

    updateProfilePhoto: protectedProcedure
      .input(z.object({ photoId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(users).set({ photoId: input.photoId }).where(eq(users.id, ctx.user.id));
        return { success: true };
      }),
  }),

  // ─── Categories ────────────────────────────────────────────────────────────
  categories: router({
    list: publicProcedure.query(async () => {
      const cached = await cacheGet("categories");
      if (cached) return cached;
      const data = await getCategories();
      await cacheSet("categories", data, 86400); // Cache for 24 hours
      return data;
    }),
    bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(({ input }) =>
      getCategoryBySlug(input.slug)
    ),
  }),

  // ─── Products ──────────────────────────────────────────────────────────────
  products: router({
    logView: publicProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await logProductView(ctx.user?.id || null, input.productId);
        return { success: true };
      }),

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
          lat: z.number().optional(),
          lng: z.number().optional(),
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

        let finalNearestWarehouseId: number | undefined = undefined;
        if (input?.lat !== undefined && input?.lng !== undefined) {
          const { lat, lng } = input;
          const db = await getDb();
          if (db) {
            const allWarehouses = await db.select().from(warehouses).where(eq(warehouses.active, true));
            if (allWarehouses.length > 0) {
              let nearest = allWarehouses[0];
              let minDistance = Infinity;
              const toRad = (val: number) => (val * Math.PI) / 180;
              allWarehouses.forEach(w => {
                const R = 6371; 
                const wLat = parseFloat(w.lat as any);
                const wLng = parseFloat(w.lng as any);
                const dLat = toRad(wLat - lat);
                const dLon = toRad(wLng - lng);
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat)) * Math.cos(toRad(wLat)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
                const d = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
                if (d < minDistance) { minDistance = d; nearest = w; }
              });
              finalNearestWarehouseId = nearest.id;
            }
          }
        }

        let products = await getProducts({ ...(input ?? {}), search: finalSearch, categoryId: finalCategoryId, featured: finalFeatured, nearestWarehouseId: finalNearestWarehouseId });
        
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

    estimateDelivery: publicProcedure
      .input(z.object({ productId: z.number(), warehouseId: z.number() }))
      .query(async ({ input }) => {
        const days = await estimateDeliveryDays(input.productId, input.warehouseId);
        const estimatedDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        return { days, estimatedDate };
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
          lat: z.number().optional(),
          lng: z.number().optional(),
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
        
        let finalNearestWarehouseId: number | undefined = undefined;
        if (input?.lat !== undefined && input?.lng !== undefined) {
          const { lat, lng } = input;
          const db = await getDb();
          if (db) {
            const allWarehouses = await db.select().from(warehouses).where(eq(warehouses.active, true));
            if (allWarehouses.length > 0) {
              let nearest = allWarehouses[0];
              let minDistance = Infinity;
              const toRad = (val: number) => (val * Math.PI) / 180;
              allWarehouses.forEach(w => {
                const R = 6371; 
                const wLat = parseFloat(w.lat as any);
                const wLng = parseFloat(w.lng as any);
                const dLat = toRad(wLat - lat);
                const dLon = toRad(wLng - lng);
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat)) * Math.cos(toRad(wLat)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
                const d = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
                if (d < minDistance) { minDistance = d; nearest = w; }
              });
              finalNearestWarehouseId = nearest.id;
            }
          }
        }

        let products = await getProducts({ ...input, search: finalSearch, categoryId: finalCategoryId, featured: finalFeatured, nearestWarehouseId: finalNearestWarehouseId, limit: 1000, offset: 0 }); // Allow ample room for Node filtering
        
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

    generateComparison: publicProcedure
      .input(z.object({
        products: z.array(z.object({
          id: z.number(),
          name: z.string(),
          price: z.union([z.string(), z.number()]).transform((val) => {
            if (typeof val === "number") return val;
            const parsed = parseFloat(val.replace(/[^0-9.-]+/g, ""));
            return isNaN(parsed) ? 0 : parsed;
          }),
          brand: z.string().optional(),
          specifications: z.record(z.string(), z.any()).optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        if (!process.env.GROQ_API_KEY && !process.env.BUILT_IN_FORGE_API_KEY) {
          return {
            analysis: { recommendation: "AI Analysis is currently offline. Please configure the AI API keys in your environment variables." },
          };
        }

        try {
          const { invokeLLM } = await import("./_core/llm");
          
          // Limit to max 4 products to prevent exceeding token limits
          const productsToCompare = input.products.slice(0, 4);
          const productsDescription = productsToCompare.map((p, i) => {
            const specs = p.specifications ? Object.entries(p.specifications)
              // Truncate specs to prevent massive token payloads
              .map(([k, v]) => `${k}: ${String(v).substring(0, 150)}`)
              .slice(0, 15)
              .join("\n") : "No specifications";
            return `
Product ID: ${p.id}
Name: ${p.name}
Brand: ${p.brand || "Unknown"}
Price: KES ${p.price.toLocaleString()}
Specs:
${specs}`;
          }).join("\n---\n");

          const result = await invokeLLM({
            messages: [{
              role: "system",
              content: `You are an elite tech product reviewer and buying guide expert. Analyze and compare the provided products.
Your response MUST be a strict, valid JSON object with exactly this structure:
{
  "quickVerdict": "A 2-3 sentence punchy verdict summarizing the comparison.",
  "winner": "Name of the best overall product.",
  "valueForMoney": "Name of the product that offers the best bang for the buck.",
  "productDetails": [
    {
      "id": <product_id_from_prompt>,
      "badge": "Short award badge (e.g., 'Best for Creators', 'Best Value', 'Ultra Fast')",
      "scores": { "performance": <number 1-10>, "value": <number 1-10>, "features": <number 1-10> },
      "targetAudience": "Who is this best for? (e.g., 'Gamers, Developers')"
    }
  ],
  "keyDifferences": "A brief explanation of the main differences.",
  "recommendation": "Your final buying advice."
}`
            }, {
              role: "user",
              content: `Compare these ${productsToCompare.length} products:\n\n${productsDescription}`
            }],
            maxTokens: 1000,
            response_format: { type: "json_object" }
          });

          const rawContent = result.choices[0]?.message?.content || "{}";
          let analysis;
          try {
            analysis = JSON.parse(rawContent as string);
          } catch (e) {
            analysis = { recommendation: rawContent };
          }

          // Normalize the response to ensure all text fields are strings
          if (analysis && typeof analysis === 'object') {
            const textFields = ['recommendation', 'quickVerdict', 'keyDifferences', 'winner', 'valueForMoney'];
            for (const field of textFields) {
              if (field in analysis && typeof analysis[field] !== 'string') {
                analysis[field] = typeof analysis[field] === 'object' 
                  ? JSON.stringify(analysis[field])
                  : String(analysis[field] || "");
              }
            }
          }

          return {
            analysis,
          };
        } catch (error) {
          console.error("Error generating comparison:", error);
          return {
            analysis: { recommendation: "Unable to generate AI comparison at this time. Please try again later." },
          };
        }
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
    calculateShipping: publicProcedure
      .input(z.object({ lat: z.number(), lng: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const allWarehouses = await db.select().from(warehouses).where(eq(warehouses.active, true));
        
        // If no warehouses are configured yet, fallback to the standard static fee
        if (allWarehouses.length === 0) return { distance: 0, cost: null, nearestWarehouseId: null };
        
        // Find closest warehouse by straight-line distance (haversine)
        let nearest = allWarehouses[0];
        let minDistance = Infinity;
        
        const toRad = (val: number) => (val * Math.PI) / 180;
        allWarehouses.forEach(w => {
          const R = 6371; // Earth radius in km
          const wLat = parseFloat(w.lat as any);
          const wLng = parseFloat(w.lng as any);
          const dLat = toRad(wLat - input.lat);
          const dLon = toRad(wLng - input.lng);
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(input.lat)) * Math.cos(toRad(wLat)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
          const d = R * c;
          if (d < minDistance) { minDistance = d; nearest = w; }
        });
        
        // Dynamic fee: Base 100 KES + 20 KES per kilometer
        const dynamicCost = 100 + (minDistance * 20);
        return { distance: minDistance, cost: Math.ceil(dynamicCost), nearestWarehouseId: nearest.id, warehouseName: nearest.name };
      }),

    placeOrder: publicProcedure
      .input(
        z.object({
          shippingFullName: z.string().min(1, "Full name is required").transform(s => s.trim()),
          shippingEmail: z.string().email().optional(),
          shippingPhone: z.string().regex(/^\+?[0-9\s\-\(\)]{7,20}$/, "Please enter a valid phone number").transform(s => s.trim()),
          shippingAddress: z.string().min(1, "Address is required").transform(s => s.trim()),
          shippingCity: z.string().min(1, "City is required").transform(s => s.trim()),
          shippingCounty: z.string().optional().transform(s => s?.trim()),
          shippingPostalCode: z.string().regex(/^(?:[A-Za-z0-9\s\-]{3,12})?$/, "Please enter a valid postal code").optional().transform(s => s?.trim()),
          shippingCountry: z.string().min(1, "Country is required").transform(s => s.trim()),
          paymentMethod: z.enum(["mpesa", "paypal", "stripe", "card", "cod"]),
          saveAddress: z.boolean().optional(),
          isExpress: z.boolean().optional(),
          discountCode: z.string().optional(),
          notes: z.string().optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
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
        
        // --- DYNAMIC SHIPPING CALCULATION & WAREHOUSE ROUTING ---
        let baseShipping = standardFee;
        let originWarehouseId: number | undefined = undefined;
        
        const db = await getDb();
        if (db) {
          const allWarehouses = await db.select().from(warehouses).where(eq(warehouses.active, true));
          if (allWarehouses.length > 0) {
            if (input.lat !== undefined && input.lng !== undefined) {
              let nearest = allWarehouses[0];
              let minDistance = Infinity;
              const toRad = (val: number) => (val * Math.PI) / 180;
              allWarehouses.forEach(w => {
                const R = 6371; const wLat = parseFloat(w.lat as any); const wLng = parseFloat(w.lng as any);
                const dLat = toRad(wLat - input.lat!); const dLon = toRad(wLng - input.lng!);
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(input.lat!)) * Math.cos(toRad(wLat)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
                const d = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
                if (d < minDistance) { minDistance = d; nearest = w; }
              });
              baseShipping = 100 + (minDistance * 20); // 100 Base + 20 per km
              originWarehouseId = nearest.id;
            } else {
              // Fallback: Match by city if no map coordinates are provided
              const cityMatch = allWarehouses.find(w => w.city.toLowerCase() === input.shippingCity.toLowerCase());
              if (cityMatch) {
                originWarehouseId = cityMatch.id;
              } else {
                // Ultimate fallback: assign to the first active warehouse
                originWarehouseId = allWarehouses[0].id;
              }
            }
          }
        }
        
        baseShipping = subtotal >= freeThreshold ? 0 : Math.ceil(baseShipping);
        const shippingCost = input.isExpress ? expressFee : baseShipping;
        
        let discountAmount = 0;
        if (input.discountCode) {
           const promoSettings = await getSetting("promotions");
           if (promoSettings && promoSettings[input.discountCode]) {
               const discountPercent = parseFloat(promoSettings[input.discountCode]);
               discountAmount = subtotal * (discountPercent / 100);
           }
        }

        const total = Math.max(0, subtotal + shippingCost - discountAmount);

        const orderNumber = `ORD-${Date.now()}-${nanoid(6).toUpperCase()}`;
        
        // ✅ Sanitize all address fields to prevent null/undefined/invalid values
        const sanitizedOrderData = sanitizeOrderAddress({
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
          originWarehouseId,
        });
        
        // Validate critical address fields after sanitization
        if (!sanitizedOrderData.shippingFullName) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Shipping full name is required" });
        }
        if (!sanitizedOrderData.shippingAddress) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Shipping address is required" });
        }
        if (!sanitizedOrderData.shippingCity) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Shipping city is required" });
        }
        if (!sanitizedOrderData.shippingCountry) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Shipping country is required" });
        }
        
        const orderId = await createOrder(sanitizedOrderData);

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
        await cacheDelPattern("ai_admin_stats");

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
        const baseUrlStr = process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/+$/, "") : `${protocol}://${host}`;
        const callbackUrl = `${baseUrlStr}/api/webhooks/mpesa`;

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
        
        let data;
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("M-Pesa Init Invalid JSON:", text.substring(0, 200));
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid response from M-Pesa server. Please try again." });
        }
        
        if (!response.ok || String(data.ResponseCode) !== "0") {
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
        await cacheDelPattern("ai_admin_stats");

        let data;
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("M-Pesa Verify Invalid JSON:", text.substring(0, 200));
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid response from M-Pesa server. Please try again." });
        }

        if (!response.ok) {
            if (data.errorMessage && data.errorMessage.toLowerCase().includes("being processed")) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Payment is still being processed on your phone. Please enter your PIN and wait a few seconds before verifying." });
            }
            throw new TRPCError({ code: "BAD_REQUEST", message: data.errorMessage || data.ResultDesc || "Error checking payment status." });
        }

        if (String(data.ResultCode) === "0") {
          const transactionId = data.CheckoutRequestID;
          await updatePaymentStatus(input.orderId, "paid", transactionId, { provider: "mpesa", raw: data });
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
                storeUrl: fullHost,
                productImageWidth: emailSettings.productImageWidth,
                emailBackgroundColor: emailSettings.emailBackgroundColor,
                theme: emailSettings.theme,
                customTemplate: emailSettings.customTemplates?.orderConfirmation
              });
              const transporter = nodemailer.createTransport({ host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort), secure: Number(emailSettings.smtpPort) === 465, auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword } });
              let customerEmail = order.shippingEmail;
              if (!customerEmail && order.userId) {
                const db = await getDb();
                if (db) {
                  const [customer] = await db.select({ email: users.email }).from(users).where(eq(users.id, order.userId)).limit(1);
                  customerEmail = customer?.email || null;
                }
              }
              if (customerEmail) await transporter.sendMail({ from: `"${storeName}" <${emailSettings.smtpUser}>`, to: customerEmail, subject: `Order Confirmation #${order.orderNumber}`, html: emailHtml });
            }
          }
        } catch (error) {
          console.error("Failed to send order confirmation email:", error);
        }
        const order = await getOrderById(input.orderId);
        if (order && order.userId) {
          const items = await getOrderItems(order.id);
          for (const item of items) { await updateProductStock(item.productId, -item.quantity); }
          await clearCart(order.userId);
        }
        return { success: true, transactionId };
        } else {
          let msg = data.ResultDesc || "Payment not completed.";
          if (String(data.ResultCode) === "1032") msg = "Payment was cancelled. Please try again.";
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
          await updatePaymentStatus(input.orderId, "paid", transactionId, { provider: "paypal", raw: data });
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
                  storeUrl: fullHost,
                  productImageWidth: emailSettings.productImageWidth,
                  emailBackgroundColor: emailSettings.emailBackgroundColor,
                  theme: emailSettings.theme,
                  customTemplate: emailSettings.customTemplates?.orderConfirmation
                });
                const transporter = nodemailer.createTransport({ host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort), secure: Number(emailSettings.smtpPort) === 465, auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword } });
                let customerEmail = order.shippingEmail;
                if (!customerEmail && order.userId) {
                  const db = await getDb();
                  if (db) {
                    const [customer] = await db.select({ email: users.email }).from(users).where(eq(users.id, order.userId)).limit(1);
                    customerEmail = customer?.email || null;
                  }
                }
                if (customerEmail) await transporter.sendMail({ from: `"${storeName}" <${emailSettings.smtpUser}>`, to: customerEmail, subject: `Order Confirmation #${order.orderNumber}`, html: emailHtml });
              }
            }
          } catch (error) {
            console.error("Failed to send order confirmation email:", error);
          }
          const order = await getOrderById(input.orderId);
          if (order && order.userId) {
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
            await updatePaymentStatus(input.orderId, "paid", intent.id, { provider: "stripe" });
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
                    orderLink: `${fullHost}/dashboard/orders/${order.orderNumber}`,
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
                    storeUrl: fullHost,
                    productImageWidth: emailSettings.productImageWidth,
                    emailBackgroundColor: emailSettings.emailBackgroundColor,
                    theme: emailSettings.theme,
                    customTemplate: emailSettings.customTemplates?.orderConfirmation
                  });
                  const transporter = nodemailer.createTransport({ host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort), secure: Number(emailSettings.smtpPort) === 465, auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword } });
                  let customerEmail = order.shippingEmail;
                  if (!customerEmail && order.userId) {
                    const db = await getDb();
                    if (db) {
                      const [customer] = await db.select({ email: users.email }).from(users).where(eq(users.id, order.userId)).limit(1);
                      customerEmail = customer?.email || null;
                    }
                  }
                  if (customerEmail) await transporter.sendMail({ from: `"${storeName}" <${emailSettings.smtpUser}>`, to: customerEmail, subject: `Order Confirmation #${order.orderNumber}`, html: emailHtml });
                }
              }
            } catch (error) {
              console.error("Failed to send order confirmation email:", error);
            }
            const items = await getOrderItems(order.id);
            for (const item of items) { await updateProductStock(item.productId, -item.quantity, order.id); }
            if (order.userId) await clearCart(order.userId);
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
            [agent] = await db.select().from(drivers).where(eq(drivers.id, order.deliveryAgentId)).limit(1);
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
        if (order.userId && (!ctx.user || (order.userId !== ctx.user.id && ctx.user.role !== "admin"))) {
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
        if (order.userId && (!ctx.user || (order.userId !== ctx.user.id && ctx.user.role !== "admin"))) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (!["pending", "payment_confirmed", "processing"].includes(order.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order cannot be cancelled at this stage." });
        }

        // Prevent cancellation if the order is older than 24 hours (admins are exempt)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (ctx.user?.role !== "admin" && ctx.user?.role !== "manager" && new Date(order.createdAt) < twentyFourHoursAgo) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Orders cannot be cancelled after 24 hours." });
        }
        
        const cancelNote = input.reason 
          ? `Cancelled via tracking page. Reason: ${input.reason}`
          : "Cancelled by customer via tracking page";
          
        await updateOrderStatus(order.id, "cancelled", cancelNote);
        
        if (order.paymentStatus === "paid" || order.status !== "pending") {
          const items = await getOrderItems(order.id);
          for (const item of items) { await updateProductStock(item.productId, item.quantity, order.id); }
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
            const emailHtml = getAdminOrderCancelledEmailHtml({
              storeName: generalSettings.storeName || "Store System",
              logoUrl: (await getSetting("appearance"))?.logoUrl,
              primaryColor: "#ef4444",
              contactEmail: generalSettings.contactEmail,
              orderNumber: order.orderNumber,
              shippingFullName: order.shippingFullName,
              shippingEmail: order.shippingEmail,
              total: order.total,
              paymentStatus: order.paymentStatus,
              reason: input.reason,
              storeCurrency: currency,
              emailBackgroundColor: emailSettings?.emailBackgroundColor,
              theme: emailSettings?.theme,
              customTemplate: emailSettings?.customTemplates?.adminOrderCancelled
            });

            await transporter.sendMail({
              from: `"${generalSettings.storeName || 'Store System'}" <${emailSettings.smtpUser}>`,
              to: generalSettings.contactEmail,
              subject: `🚨 Order Cancelled - #${order.orderNumber}`,
              html: emailHtml,
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
          let customerEmail = order.shippingEmail;
          if (!customerEmail && order.userId) {
            const db = await getDb();
            if (db) {
              const [customer] = await db.select({ email: users.email }).from(users).where(eq(users.id, order.userId)).limit(1);
              customerEmail = customer?.email || null;
            }
          }

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
              emailBackgroundColor: emailSettings?.emailBackgroundColor,
              theme: emailSettings?.theme,
              customTemplate: emailSettings?.customTemplates?.orderCancelled
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

    updateShippingAddress: protectedProcedure
      .input(
        z.object({
          orderId: z.number(),
          shippingAddress: z.string().min(1),
          shippingCity: z.string().min(1),
          shippingCounty: z.string().optional(),
          shippingPostalCode: z.string().optional(),
          shippingCountry: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        
        if (order.userId !== ctx.user.id && ctx.user.role !== "admin" && ctx.user.role !== "manager") {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to modify this order." });
        }
        
        if (["shipped", "out_for_delivery", "delivered", "cancelled", "refunded"].includes(order.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change address after the order has been processed for shipping." });
        }
        
        await db.update(orders).set({ shippingAddress: input.shippingAddress, shippingCity: input.shippingCity, shippingCounty: input.shippingCounty || null, shippingPostalCode: input.shippingPostalCode || null, shippingCountry: input.shippingCountry }).where(eq(orders.id, input.orderId));
        await updateOrderStatus(input.orderId, order.status, "Customer updated shipping address");
        
        return { success: true };
      }),
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────────
  admin: router({
    stats: managerProcedure
      .input(z.object({ timeRange: z.string().optional(), warehouseId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const warehouseId = ctx.user.role === "manager" ? ctx.user.warehouseId : input?.warehouseId;
        const cacheKey = `admin_stats_${input?.timeRange || "30d"}_${warehouseId || "global"}`;
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;

        const baseStats = await getAdminStats(input?.timeRange, warehouseId);
        if (!baseStats) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to load stats" });
        
        // Calculate AI-attributed revenue overlay
        const aiRevenueData = (baseStats.revenueData || []).map((day: any) => ({
          date: day.date, aiRevenue: day.aiRevenue || 0, organicRevenue: day.organicRevenue || 0, total: day.revenue || 0
        }));
        const totalAIRevenue = aiRevenueData.reduce((sum, d) => sum + d.aiRevenue, 0);
        
        const result = { ...baseStats, aiRevenueData, totalAIRevenue };
        
        // Cache for exactly 5 seconds to match the frontend polling interval (Request Coalescing)
        await cacheSet(cacheKey, result, 5);
        
        return result;
      }),

    notifications: managerProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const notifications = [];

      const inventorySettings = await getSetting("inventory");
      const lowStockThreshold = inventorySettings?.lowStockThreshold !== undefined ? parseInt(inventorySettings.lowStockThreshold, 10) : 5;

      // 1. Low Stock Alerts
      const lowStock = await db.select().from(products).where(lte(products.stock, lowStockThreshold)).limit(5);
      for (const p of lowStock) {
        notifications.push({
          id: `stock-${p.id}`,
          type: "alert",
          title: "Low Stock Warning",
          message: `${p.name} is down to ${p.stock} units in stock. Please restock soon.`,
          actionLink: `/admin/products?search=${encodeURIComponent(p.name)}`,
          actionText: "Manage Inventory",
          icon: "Package",
          color: "text-orange-500",
          bgColor: "bg-orange-500/10",
        });
      }

      // 2. Pending Payouts
      const pendingPayouts = await db.select().from(deliveryPayouts).where(eq(deliveryPayouts.status, 'pending'));
      if (pendingPayouts.length > 0) {
        const totalAmount = pendingPayouts.reduce((sum, p) => sum + parseFloat(p.amount as any), 0);
        notifications.push({
          id: `payouts-pending`,
          type: "driver",
          title: "Driver Payout Requests",
          message: `There are ${pendingPayouts.length} pending payout requests totaling KES ${totalAmount.toLocaleString()}.`,
          actionLink: "/admin/payments",
          actionText: "Review Payouts",
          icon: "Truck",
          color: "text-blue-500",
          bgColor: "bg-blue-500/10",
        });
      }

      // 3. New Orders
      const recentPendingOrders = await db.select().from(orders).where(eq(orders.status, 'pending')).orderBy(desc(orders.createdAt)).limit(3);
      for (const o of recentPendingOrders) {
        notifications.push({
          id: `order-${o.id}`,
          type: "order",
          title: "New Order Pending",
          message: `Order #${o.orderNumber} for KES ${parseFloat(o.total as any).toLocaleString()} is awaiting processing.`,
          actionLink: `/admin/orders`,
          actionText: "View Order",
          icon: "ShoppingCart",
          color: "text-green-500",
          bgColor: "bg-green-500/10",
        });
      }

      // 4. Automated Emails (e.g. Abandoned Carts)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentEmails = await db.select({ count: sql<number>`COUNT(*)` })
        .from(orders)
        .where(and(
          eq(orders.abandonedEmailSent, true),
          sql`${orders.updatedAt} >= ${twentyFourHoursAgo.toISOString()}`
        ));
      const emailCount = recentEmails[0]?.count || 0;
      if (emailCount > 0) {
        notifications.push({
          id: `emails-abandoned`,
          type: "system",
          title: "Automated Emails Sent",
          message: `The system has successfully dispatched ${emailCount} abandoned cart reminder emails in the last 24 hours.`,
          actionLink: "/admin/orders",
          actionText: "View Orders",
          icon: "Mail",
          color: "text-purple-500",
          bgColor: "bg-purple-500/10",
        });
      }

      // 5. Pending Deletion Requests (Admins only)
      if (ctx.user.role === "admin") {
        const pendingDeletions = await db.select({ count: sql<number>`COUNT(*)` }).from(deletionRequests).where(eq(deletionRequests.status, "pending"));
        const deletionCount = pendingDeletions[0]?.count || 0;
        if (deletionCount > 0) {
          notifications.push({
            id: `deletions-pending`,
            type: "system",
            title: "Pending Deletion Requests",
            message: `There are ${deletionCount} pending deletion requests from managers awaiting your approval.`,
            actionLink: "/admin/notifications",
            actionText: "Review Requests",
            icon: "AlertCircle",
            color: "text-red-500",
            bgColor: "bg-red-500/10",
          });
        }
      }

      return notifications;
    }),

    broadcastTrendingProducts: managerProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const emailSettings = await getSetting("email");
      if (!emailSettings?.smtpHost || !emailSettings?.smtpUser) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "SMTP is not configured" });
      }

      const trending = await getDemandPrediction(7);
      if (!trending || trending.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No trending products found to broadcast." });
      }

      const topProducts = trending.slice(0, 3);
      const generalSettings = await getSetting("general");
      const storeName = generalSettings?.storeName || "Store";
      
      const usersList = await db.select().from(users).limit(100);
      const appearance = await getSetting("appearance");

      const transporter = nodemailer.createTransport({
        host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
        secure: Number(emailSettings.smtpPort) === 465,
        auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
      });

      const productListHtml = topProducts.map((p: any) => 
        `<li style="margin-bottom: 8px;"><strong>${p.productName}</strong> - 🔥 Selling fast! (${p.salesCount} sold recently)</li>`
      ).join("");

      const promoSettings = (await getSetting("promotions")) || {};

      let sentCount = 0;
      const emailPromises = [];
      
      for (const u of usersList) {
        if (!u.email) continue;
        
        const bgColor = emailSettings?.emailBackgroundColor || "#f9fafb";
        const btnColor = emailSettings?.emailButtonColor || "#3b82f6";
        
        const uniqueCode = `HOT15-${nanoid(5).toUpperCase()}`;
        promoSettings[uniqueCode] = "15"; // Set 15% discount for this unique code

        const emailHtml = getBroadcastEmailHtml({
          storeName, logoUrl: appearance?.logoUrl,
          primaryColor: btnColor, contactEmail: generalSettings?.contactEmail || "support@example.com",
          storePhone: generalSettings?.phone || "", userName: u.name || 'there',
          uniqueCode, productListHtml, emailBackgroundColor: bgColor,
          theme: emailSettings?.theme,
          customTemplate: emailSettings?.customTemplates?.broadcast
        });

        await transporter.sendMail({
          from: `"${storeName}" <${emailSettings.smtpUser}>`,
          to: u.email,
          subject: `🔥 Trending Now at ${storeName} - Don't Miss Out!`,
          html: emailHtml
        }).catch(console.error);
        sentCount++;
      }
      return { success: true, sentCount };
    }),

    triggerAIMarketing: managerProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!process.env.GROQ_API_KEY) throw new TRPCError({ code: "BAD_REQUEST", message: "AI API Key missing" });
      
      const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
      const emailSettings = await getSetting("email");
      if (!emailSettings?.smtpHost) throw new TRPCError({ code: "BAD_REQUEST", message: "SMTP is not configured" });

      const generalSettings = await getSetting("general");
      const storeName = generalSettings?.storeName || "our store";
      const promoPrefix = (generalSettings?.storeName || "STORE").replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6);
      const appearance = await getSetting("appearance");

      // Target top 5 users (in a production environment, this would filter by users with recent wishlist activity)
      const usersList = await db.select().from(users).limit(5);

      const transporter = nodemailer.createTransport({
        host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
        secure: Number(emailSettings.smtpPort) === 465,
        auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
      });

      let sentCount = 0;
      for (const u of usersList) {
        if (!u.email) continue;
        const prompt = `Write a short, engaging, highly personalized 2-sentence marketing email for a customer named ${u.name || 'there'} offering them a special 15% discount code (${promoPrefix}15) on their next laptop purchase based on their recent interest in ${storeName}. Do not include a subject line or greetings/sign-offs, just the body text.`;
        const bgColor = emailSettings?.emailBackgroundColor || "#f9fafb";
        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }]
        });
        const emailHtml = getAIMarketingEmailHtml({
          storeName, logoUrl: appearance?.logoUrl,
          primaryColor: emailSettings?.emailButtonColor || appearance?.primaryColor || "#3b82f6",
          contactEmail: generalSettings?.contactEmail || "support@example.com", storePhone: generalSettings?.phone || "",
          userName: u.name || 'You', aiContent: response.choices[0].message.content || "",
          emailBackgroundColor: bgColor, theme: emailSettings?.theme,
          customTemplate: emailSettings?.customTemplates?.aiMarketing
        });

        await transporter.sendMail({
          from: `"AI Assistant" <${emailSettings.smtpUser}>`,
          to: u.email,
          subject: `A personalized offer just for you, ${u.name || 'there'}!`,
          html: emailHtml
        }).catch(console.error);
        sentCount++;
      }
      return { success: true, sentCount };
    }),

    triggerAutoRestock: managerProcedure.mutation(async () => {
      await processAutoRestock();
      return { success: true };
    }),

    globalSearch: managerProcedure
      .input(z.object({ query: z.string(), cursor: z.number().nullish(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        if (!input.query) {
          return { products: [], orders: [], customers: [], categories: [], nextCursor: null };
        }
        
        const limit = input.limit ?? 10;
        const offset = input.cursor ?? 0;
        const results = await adminGlobalSearch(input.query, limit, offset) || { products: [], orders: [], customers: [], categories: [] };
        
        const hasMore = 
          (results.products?.length || 0) === limit || 
          (results.orders?.length || 0) === limit || 
          (results.customers?.length || 0) === limit || 
          (results.categories?.length || 0) === limit;
          
        return { ...results, nextCursor: hasMore ? offset + limit : null };
      }),

    orders: managerProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional(), search: z.string().optional(), status: z.string().optional(), warehouseId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        let orders = await getAllOrders({
          ...input,
          warehouseId: ctx.user.role === "manager" ? ctx.user.warehouseId : input?.warehouseId
        });
        if (input?.search) {
          const s = input.search.toLowerCase();
          orders = orders.filter((o: any) => o.orderNumber.toLowerCase().includes(s) || (o.customerName || "").toLowerCase().includes(s));
        }
        if (input?.status) orders = orders.filter((o: any) => o.status === input.status);
        return orders;
      }),

    orderDetail: managerProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input, ctx }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });

        // Tenant Isolation: Prevent manager from viewing orders from other warehouses
        if (ctx.user.role === "manager" && ctx.user.warehouseId && order.originWarehouseId !== ctx.user.warehouseId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to view orders outside your assigned warehouse." });
        }

        const items = await getOrderItems(input.orderId);
        const history = await getOrderStatusHistory(input.orderId);
        const payment = await getPaymentByOrder(input.orderId);
        const db = await getDb();
        let customer = null;
        if (db && order.userId) {
          const result = await db.select().from(users).where(eq(users.id, order.userId)).limit(1);
          customer = result[0] ?? null;
        }
        return { order, items, history, payment, customer };
      }),

    updateOrderStatus: managerProcedure
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

        await logAuditAction(ctx.user.id, "UPDATE_ORDER_STATUS", input.orderId, `Status changed to ${input.status}`);

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
                    shippingAddress: `${order.shippingAddress}\n${order.shippingCity}, ${order.shippingPostalCode || ''}\n${order.shippingCountry}`,
                    emailBackgroundColor: emailSettings?.emailBackgroundColor,
                    theme: emailSettings?.theme,
                    customTemplate: emailSettings?.customTemplates?.shipping
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

    auditLogs: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(20),
        offset: z.number().optional().default(0),
        search: z.string().optional(),
        action: z.string().optional()
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        let conditions = [];
        if (input?.search) {
          const s = `%${input.search.toLowerCase()}%`;
          conditions.push(or(like(sql`lower(${auditLogs.details})`, s), like(sql`lower(cast(${auditLogs.resourceId} as text))`, s)));
        }
        if (input?.action && input.action !== "all") {
          conditions.push(eq(auditLogs.action, input.action));
        }
        
        const logsResult = await db.select().from(auditLogs).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(auditLogs.createdAt)).limit(input?.limit ?? 20).offset(input?.offset ?? 0);
          
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(conditions.length > 0 ? and(...conditions) : undefined);
          
        return { logs: logsResult, total: countResult[0]?.count || 0 };
      }),

    checkUpdates: managerProcedure
      .input(z.object({
        lastCheck: z.coerce.number().describe("Timestamp of last check in ms"),
        previousOrderCount: z.coerce.number().optional(),
        previousUserCount: z.coerce.number().optional(),
        previousManagerCount: z.coerce.number().optional(),
        previousProductCount: z.coerce.number().optional(),
        previousPageViewCount: z.coerce.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { hasUpdates: false, updates: {} };

        const lastCheckTime = input?.lastCheck ? new Date(input.lastCheck) : new Date(Date.now() - 60000);

        // Fetch counts in parallel, split into batches to avoid DB connection pool exhaustion
        const [[{ orderCount }], [{ userCount }], [{ managerCount }], [{ productCount }], [{ pageViewCount }]] = await Promise.all([
          db.select({ orderCount: sql<number>`COUNT(*)` }).from(orders),
          db.select({ userCount: sql<number>`COUNT(*)` }).from(users).where(eq(users.role, "user")),
          db.select({ managerCount: sql<number>`COUNT(*)` }).from(users).where(eq(users.role, "manager")),
          db.select({ productCount: sql<number>`COUNT(*)` }).from(products).where(and(eq(products.active, true), gt(products.stock, 0))),
          db.select({ pageViewCount: sql<number>`COUNT(*)` }).from(pageViews),
        ]);

        const [recentOrders, recentUsers, recentManagers] = await Promise.all([
          db.select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            total: orders.total,
            createdAt: orders.createdAt,
            customerName: users.name,
            status: orders.status,
          }).from(orders).leftJoin(users, eq(orders.userId, users.id)).where(gt(orders.createdAt, lastCheckTime)).orderBy(desc(orders.createdAt)).limit(3),
          db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
          }).from(users).where(gt(users.createdAt, lastCheckTime)).orderBy(desc(users.createdAt)).limit(3),
          db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
          }).from(users).where(and(eq(users.role, "manager"), gt(users.createdAt, lastCheckTime))).orderBy(desc(users.createdAt)).limit(3),
        ]);

        const updates: any = {};
        let hasUpdates = false;

        // Check for new orders
        if ((input?.previousOrderCount ?? 0) < (orderCount ?? 0)) {
          updates.newOrders = {
            count: (orderCount ?? 0) - (input?.previousOrderCount ?? 0),
            orders: recentOrders || [],
          };
          hasUpdates = true;
        }

        // Check for new users (customers)
        if ((input?.previousUserCount ?? 0) < (userCount ?? 0)) {
          updates.newUsers = {
            count: (userCount ?? 0) - (input?.previousUserCount ?? 0),
            users: (recentUsers || []).filter((u: any) => u.role === "user"),
          };
          hasUpdates = true;
        }

        // Check for new managers
        if ((input?.previousManagerCount ?? 0) < (managerCount ?? 0)) {
          updates.newManagers = {
            count: (managerCount ?? 0) - (input?.previousManagerCount ?? 0),
            managers: recentManagers || [],
          };
          hasUpdates = true;
        }

        // Check for new/updated products
        if ((input?.previousProductCount ?? 0) !== (productCount ?? 0)) {
          updates.productCountChanged = {
            newCount: productCount ?? 0,
            previousCount: input?.previousProductCount ?? 0,
            difference: (productCount ?? 0) - (input?.previousProductCount ?? 0),
          };
          hasUpdates = true;
        }

        // Check for new visitors/page views
        if ((input?.previousPageViewCount ?? 0) < (pageViewCount ?? 0)) {
          updates.newVisitors = {
            count: (pageViewCount ?? 0) - (input?.previousPageViewCount ?? 0),
            totalPageViews: pageViewCount ?? 0,
          };
          hasUpdates = true;
        }

        return {
          hasUpdates,
          updates,
          currentCounts: {
            orders: orderCount ?? 0,
            users: userCount ?? 0,
            managers: managerCount ?? 0,
            products: productCount ?? 0,
            pageViews: pageViewCount ?? 0,
          },
          timestamp: Date.now(),
        };
      }),

    payments: managerProcedure.query(() => getAllPayments()),

    customers: managerProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        let allUsers = await getAllUsers();
        if (input?.search) {
          const s = input.search.toLowerCase();
          allUsers = allUsers.filter((u: any) => (u.name || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s));
        }
        return allUsers;
      }),

    users: managerProcedure
      .input(z.object({ search: z.string().optional(), role: z.string().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        let conditions = [];
        if (input?.search) {
          const s = `%${input.search.toLowerCase()}%`;
          conditions.push(or(like(sql`lower(${users.name})`, s), like(sql`lower(${users.email})`, s)));
        }
        if (input?.role) {
          conditions.push(eq(users.role, input.role as any));
        }
        
        // Tenant Isolation: Managers only see users/staff from their own warehouse
        if (ctx.user.role === "manager" && ctx.user.warehouseId) {
          conditions.push(eq(users.warehouseId, ctx.user.warehouseId));
        }
        
        return db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
          photoId: users.photoId,
          warehouseId: users.warehouseId,
          warehouseName: warehouses.name
        })
        .from(users)
        .leftJoin(warehouses, eq(users.warehouseId, warehouses.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(users.createdAt));
      }),

    upsertUser: adminProcedure
      .input(z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        role: z.enum(["user", "manager", "admin"]),
        password: z.string().optional(),
        photoId: z.string().optional(),
        warehouseId: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Auto-upgrade existing users if email exists
        const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
        let targetId = input.id;
        if (existingUser.length > 0) {
          if (input.id && existingUser[0].id !== input.id) throw new TRPCError({ code: "CONFLICT", message: "Email is already taken by another account." });
          if (!input.id) targetId = existingUser[0].id;
        }

        if (input.phone) {
          const existingPhone = await db.select({ id: users.id }).from(users).where(eq(users.phone, input.phone)).limit(1);
          if (existingPhone.length > 0 && existingPhone[0].id !== targetId) {
             throw new TRPCError({ code: "CONFLICT", message: "Phone number is already taken by another account." });
          }
        }

        const updateData: any = {
          name: input.name,
          email: input.email,
          phone: input.phone || null,
          role: input.role,
          photoId: input.photoId || null,
          warehouseId: input.warehouseId || null,
        };

        let generatedPassword = null;
        let isNewManager = false;

        if (input.password) {
          updateData.password = await hashPassword(input.password);
          updateData.requiresPasswordChange = false;
        } else if (!input.id && (input.role === "manager" || input.role === "admin")) {
          generatedPassword = Math.random().toString(36).substring(2, 10).toUpperCase();
          updateData.password = await hashPassword(generatedPassword);
          updateData.requiresPasswordChange = true;
          isNewManager = true;
        } else if (!input.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Password is required for new users" });
        }

        if (targetId) {
          await db.update(users).set(updateData).where(eq(users.id, targetId));
        } else {
          updateData.openId = `local-${nanoid()}`;
          updateData.loginMethod = "email";
          updateData.emailVerified = true; // Auto-verify staff accounts created by admin
          await db.insert(users).values(updateData);
        }

        // Dispatch Email if new manager
        if (isNewManager && generatedPassword) {
          try {
            const emailSettings = await getSetting("email");
            const generalSettings = await getSetting("general");
            const appearanceSettings = await getSetting("appearance");
            if (emailSettings?.smtpHost && emailSettings?.smtpUser) {
              const transporter = nodemailer.createTransport({
                host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
                secure: Number(emailSettings.smtpPort) === 465,
                auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
              });
              const host = ctx.req.headers.host || "localhost:3000";
              const protocol = host.includes("localhost") ? "http" : "https";
              const portalUrl = `${protocol}://${host}/${input.role === "manager" ? "manager" : "admin"}`;
              const portalName = input.role === "manager" ? "Manager Portal" : "Admin Panel";
              const emailHtml = getManagerWelcomeEmailHtml({
                storeName: generalSettings?.storeName || "Store Dashboard", logoUrl: appearanceSettings?.logoUrl, primaryColor: emailSettings?.emailButtonColor || appearanceSettings?.primaryColor || "#3b82f6", contactEmail: generalSettings?.contactEmail || "support@example.com",
                name: input.name, email: input.email, temporaryPassword: generatedPassword, portalUrl, portalName, emailBackgroundColor: emailSettings?.emailBackgroundColor, theme: emailSettings?.theme
              });
              await transporter.sendMail({ from: `"${generalSettings?.storeName || 'Store Admin'}" <${emailSettings.smtpUser}>`, to: input.email, subject: `Welcome to the ${portalName}`, html: emailHtml });
            }
          } catch (err) {
            console.error("Failed to send manager welcome email:", err);
          }
        }
        return { success: true };
      }),

    toggleUserSuspension: adminProcedure
      .input(z.object({ userId: z.number(), suspended: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(users).set({ suspended: input.suspended }).where(eq(users.id, input.userId));
        return { success: true };
      }),

    deleteUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(users).where(eq(users.id, input.id));
        return { success: true };
      }),

    verifyPayment: managerProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        const transactionId = `MANUAL-${Date.now()}`;
        await updatePaymentStatus(input.orderId, "paid", transactionId, { provider: "manual" });
        await updateOrderStatus(input.orderId, "payment_confirmed", "Payment manually verified by admin", {
          paymentStatus: "paid",
          paymentReference: transactionId,
        });
        await cacheDelPattern("ai_admin_stats");
        const order = await getOrderById(input.orderId);
        if (order) {
          const items = await getOrderItems(order.id);
          for (const item of items) { await updateProductStock(item.productId, -item.quantity, order.id); }
        }
        return { success: true };
      }),

    createProduct: managerProcedure
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
          hasSerial: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await upsertProduct(input);
        await logAuditAction(ctx.user.id, "CREATE_PRODUCT", input.slug, input.name);
        return { success: true };
      }),

    updateProduct: managerProcedure
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
      .mutation(async ({ ctx, input }) => {
        const { productId, ...rest } = input;
        await upsertProduct({ id: productId, ...rest });
        await logAuditAction(ctx.user.id, "UPDATE_PRODUCT", productId, input.name);
        return { success: true };
      }),

    deleteProduct: adminProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteProduct(input.productId);
        await logAuditAction(ctx.user.id, "DELETE_PRODUCT", input.productId, "Product Soft Deleted");
        return { success: true };
      }),

    products: managerProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional(), search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        let products = await getProducts({ limit: input?.limit ?? 100, offset: input?.offset ?? 0 });
        if (input?.search) {
          const s = input.search.toLowerCase();
          products = products.filter((p: any) => p.name.toLowerCase().includes(s) || (p.brand || "").toLowerCase().includes(s));
        }
        return products;
      }),

    upsertProduct: managerProcedure
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
          hasSerial: z.boolean().optional(),
          warehouseId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await upsertProduct({ ...input, warehouseId: ctx.user.role === "manager" ? ctx.user.warehouseId : input.warehouseId });
        await logAuditAction(ctx.user.id, input.id ? "UPDATE_PRODUCT" : "CREATE_PRODUCT", input.id || input.slug, input.name);
        return { success: true };
      }),

    transferProduct: managerProcedure
      .input(z.object({ productId: z.number(), warehouseId: z.number().nullable() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(products).set({ warehouseId: input.warehouseId }).where(eq(products.id, input.productId));
        await logAuditAction(ctx.user.id, "TRANSFER_PRODUCT", input.productId, `Transferred to warehouse ${input.warehouseId || 'Global'}`);
        return { success: true };
      }),

    assignAllUnassignedProducts: adminProcedure
      .input(z.object({ warehouseId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const unassigned = await db.select().from(products).where(sql`${products.warehouseId} IS NULL`);
        
        if (unassigned.length > 0) {
          await db.update(products).set({ warehouseId: input.warehouseId }).where(sql`${products.warehouseId} IS NULL`);
          
          for (const p of unassigned) {
             const existing = await db.select().from(productInventory).where(and(eq(productInventory.productId, p.id), eq(productInventory.warehouseId, input.warehouseId)));
             if (existing.length === 0) {
                await db.insert(productInventory).values({
                   productId: p.id,
                   warehouseId: input.warehouseId,
                   stock: p.stock
                });
             } else {
                await db.update(productInventory).set({ stock: p.stock }).where(eq(productInventory.id, existing[0].id));
             }
          }
        }
        await logAuditAction(ctx.user.id, "ASSIGN_ALL_PRODUCTS", input.warehouseId, `Assigned all unassigned products to warehouse ${input.warehouseId}`);
        return { success: true };
      }),

    createDirectTransfer: adminProcedure
      .input(z.object({
        productId: z.number(),
        fromWarehouseId: z.number(),
        toWarehouseId: z.number(),
        quantity: z.number().min(1),
        notes: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Fetch source inventory to ensure enough stock
        const [sourceInv] = await db.select().from(productInventory).where(and(eq(productInventory.productId, input.productId), eq(productInventory.warehouseId, input.fromWarehouseId))).limit(1);
        
        if (!sourceInv || sourceInv.stock < input.quantity) {
           throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient stock in source warehouse. Available: ${sourceInv?.stock || 0}` });
        }

        const [transfer] = await db.insert(inventoryTransfers).values({
          productId: input.productId,
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          quantity: input.quantity,
          status: "pending_sender_fulfillment",
          approvedBy: ctx.user.id,
          notes: input.notes
        }).returning();
        
        const managersA = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "manager"), eq(users.warehouseId, input.fromWarehouseId)));
        for (const manager of managersA) {
           await db.insert(staffMessages).values({ senderId: ctx.user.id, receiverId: manager.id, content: `📦 TRANSFER INITIATED: You need to dispatch a transfer (ID: ${transfer.id}) from your warehouse.` });
        }
        
        return { success: true };
      }),

    getWarehouseInventory: managerProcedure
      .input(z.object({ warehouseId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        return db.select({
          id: productInventory.id,
          productId: productInventory.productId,
          warehouseId: productInventory.warehouseId,
          stock: productInventory.stock,
          productName: products.name,
          productBrand: products.brand,
          productPrice: products.price,
          productImages: products.images
        })
        .from(productInventory)
        .innerJoin(products, eq(productInventory.productId, products.id))
        .where(eq(productInventory.warehouseId, input.warehouseId));
      }),

    // ─── Inventory Transfers (Multi-Warehouse Workflow) ───
    getInventoryTransfers: managerProcedure
      .input(z.object({ warehouseId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        let conditions = [];
        if (ctx.user.role === "manager" && ctx.user.warehouseId) {
          conditions.push(or(
            eq(inventoryTransfers.fromWarehouseId, ctx.user.warehouseId),
            eq(inventoryTransfers.toWarehouseId, ctx.user.warehouseId)
          ));
        } else if (ctx.user.role === "admin" && input?.warehouseId) {
          conditions.push(or(
            eq(inventoryTransfers.fromWarehouseId, input.warehouseId),
            eq(inventoryTransfers.toWarehouseId, input.warehouseId)
          ));
        }

        const transfers = await db.select({
          id: inventoryTransfers.id,
          productId: inventoryTransfers.productId,
          productName: products.name,
          fromWarehouseId: inventoryTransfers.fromWarehouseId,
          toWarehouseId: inventoryTransfers.toWarehouseId,
          quantity: inventoryTransfers.quantity,
          status: inventoryTransfers.status,
          createdAt: inventoryTransfers.createdAt,
          driverName: drivers.name
        })
        .from(inventoryTransfers)
        .leftJoin(products, eq(inventoryTransfers.productId, products.id))
        .leftJoin(drivers, eq(inventoryTransfers.driverId, drivers.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(inventoryTransfers.createdAt));

        return transfers;
      }),

    requestInventoryTransfer: managerProcedure
      .input(z.object({ productId: z.number(), toWarehouseId: z.number(), quantity: z.number().min(1), notes: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(inventoryTransfers).values({ productId: input.productId, toWarehouseId: input.toWarehouseId, quantity: input.quantity, status: "pending_admin_approval", requestedBy: ctx.user.id, notes: input.notes });
        
        // Get the destination warehouse name
        const [toWarehouse] = await db.select({ name: warehouses.name }).from(warehouses).where(eq(warehouses.id, input.toWarehouseId)).limit(1);
        const warehouseName = toWarehouse?.name || `Warehouse ${input.toWarehouseId}`;
        
        const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
        for (const admin of admins) {
           await db.insert(staffMessages).values({ senderId: ctx.user.id, receiverId: admin.id, content: `🚨 TRANSFER REQUEST: ${warehouseName} requested ${input.quantity} units of Product ${input.productId}. Please approve and route.` });
        }
        return { success: true };
      }),

    approveInventoryTransfer: adminProcedure
      .input(z.object({ transferId: z.number(), fromWarehouseId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(inventoryTransfers).set({ fromWarehouseId: input.fromWarehouseId, status: "pending_sender_fulfillment", approvedBy: ctx.user.id, updatedAt: new Date() }).where(eq(inventoryTransfers.id, input.transferId));
        const managersA = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "manager"), eq(users.warehouseId, input.fromWarehouseId)));
        for (const manager of managersA) {
           await db.insert(staffMessages).values({ senderId: ctx.user.id, receiverId: manager.id, content: `📦 TRANSFER APPROVED: You need to dispatch a transfer (ID: ${input.transferId}) from your warehouse.` });
        }
        return { success: true };
      }),

    fulfillRestockExternally: adminProcedure
      .input(z.object({ transferId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const [transfer] = await db.select().from(inventoryTransfers).where(eq(inventoryTransfers.id, input.transferId)).limit(1);
        if (!transfer || transfer.status !== "pending_admin_approval") throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer is not in the correct state" });
        if (!transfer.toWarehouseId) throw new TRPCError({ code: "BAD_REQUEST", message: "Missing destination warehouse" });

        // Add to the specific warehouse inventory
        const [destInv] = await db.select().from(productInventory).where(and(eq(productInventory.productId, transfer.productId), eq(productInventory.warehouseId, transfer.toWarehouseId))).limit(1);
        if (destInv) {
          await db.update(productInventory).set({ stock: sql`stock + ${transfer.quantity}` }).where(eq(productInventory.id, destInv.id));
        } else {
          await db.insert(productInventory).values({ productId: transfer.productId, warehouseId: transfer.toWarehouseId, stock: transfer.quantity });
        }
        
        // Increase global stock 
        await db.update(products).set({ stock: sql`stock + ${transfer.quantity}` }).where(eq(products.id, transfer.productId));

        await db.update(inventoryTransfers).set({ status: "completed", notes: "Restocked externally (New Purchase)", completedAt: new Date(), updatedAt: new Date(), approvedBy: ctx.user.id }).where(eq(inventoryTransfers.id, input.transferId));
        
        const managersB = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "manager"), eq(users.warehouseId, transfer.toWarehouseId)));
        for (const manager of managersB) {
           await db.insert(staffMessages).values({ senderId: ctx.user.id, receiverId: manager.id, content: `✅ RESTOCK APPROVED: Ordered externally. ${transfer.quantity} units of Product ${transfer.productId} have been added to your inventory.` });
        }
        return { success: true };
      }),

    dispatchInventoryTransfer: managerProcedure
      .input(z.object({ transferId: z.number(), driverId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [transfer] = await db.select().from(inventoryTransfers).where(eq(inventoryTransfers.id, input.transferId)).limit(1);
        if (!transfer || transfer.status !== "pending_sender_fulfillment") throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer not ready for dispatch" });
        if (ctx.user.role === "manager" && ctx.user.warehouseId !== transfer.fromWarehouseId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only dispatch from your own warehouse." });
        }
        const [sourceInv] = await db.select().from(productInventory).where(and(eq(productInventory.productId, transfer.productId), eq(productInventory.warehouseId, transfer.fromWarehouseId!))).limit(1);
        if (!sourceInv || sourceInv.stock < transfer.quantity) {
           throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient stock in source warehouse." });
        }
        await db.update(productInventory).set({ stock: sql`stock - ${transfer.quantity}` }).where(eq(productInventory.id, sourceInv.id));
        await db.update(inventoryTransfers).set({ driverId: input.driverId, status: "in_transit", updatedAt: new Date() }).where(eq(inventoryTransfers.id, input.transferId));
        const managersB = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "manager"), eq(users.warehouseId, transfer.toWarehouseId)));
        for (const manager of managersB) {
           await db.insert(staffMessages).values({ senderId: ctx.user.id, receiverId: manager.id, content: `🚚 TRANSFER DISPATCHED: Transfer ID ${input.transferId} is on the way via Driver ID ${input.driverId}.` });
        }
        return { success: true };
      }),

    receiveInventoryTransfer: managerProcedure
      .input(z.object({ transferId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [transfer] = await db.select().from(inventoryTransfers).where(eq(inventoryTransfers.id, input.transferId)).limit(1);
        if (!transfer || transfer.status !== "in_transit") throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer is not in transit." });
        if (ctx.user.role === "manager" && ctx.user.warehouseId !== transfer.toWarehouseId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only receive transfers destined for your warehouse." });
        }
        const [destInv] = await db.select().from(productInventory).where(and(eq(productInventory.productId, transfer.productId), eq(productInventory.warehouseId, transfer.toWarehouseId))).limit(1);
        if (destInv) {
          await db.update(productInventory).set({ stock: sql`stock + ${transfer.quantity}` }).where(eq(productInventory.id, destInv.id));
        } else {
          await db.insert(productInventory).values({ productId: transfer.productId, warehouseId: transfer.toWarehouseId, stock: transfer.quantity });
        }
        await db.update(inventoryTransfers).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(eq(inventoryTransfers.id, input.transferId));
        
        // Get the destination warehouse name
        const [destWarehouse] = await db.select({ name: warehouses.name }).from(warehouses).where(eq(warehouses.id, transfer.toWarehouseId)).limit(1);
        const warehouseName = destWarehouse?.name || `Warehouse ${transfer.toWarehouseId}`;
        
        const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
        for (const admin of admins) {
           await db.insert(staffMessages).values({ senderId: ctx.user.id, receiverId: admin.id, content: `✅ TRANSFER COMPLETED: ${warehouseName} received ${transfer.quantity} units of Product ${transfer.productId}.` });
        }
        return { success: true };
      }),

    requestRestock: managerProcedure
      .input(z.object({ productId: z.number(), productName: z.string(), quantity: z.number().default(10) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Get warehouse name if warehouseId exists
        let warehouseName = 'Local';
        if (ctx.user.warehouseId) {
          const warehouse = await db.select({ name: warehouses.name }).from(warehouses).where(eq(warehouses.id, ctx.user.warehouseId)).limit(1);
          if (warehouse.length > 0) {
            warehouseName = warehouse[0].name;
          }
          
          await db.insert(inventoryTransfers).values({
             productId: input.productId,
             toWarehouseId: ctx.user.warehouseId,
             quantity: input.quantity,
             status: "pending_admin_approval",
             requestedBy: ctx.user.id,
             notes: "Manager requested restock"
          });
        }
        
        const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
        for (const admin of admins) {
           await db.insert(staffMessages).values({
             senderId: ctx.user.id,
             receiverId: admin.id,
             content: `🚨 RESTOCK REQUEST: ${warehouseName} needs more stock of "${input.productName}" (Product ID: ${input.productId}). Please arrange a transfer.`
           });
        }
        return { success: true };
      }),

    createProductUnits: managerProcedure
      .input(z.object({
        productId: z.number(),
        units: z.array(z.object({
          serialNumber: z.string().min(1),
          barcode: z.string().optional(),
          notes: z.string().optional(),
        })).min(1).max(100),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const serialNumbers = input.units.map(u => u.serialNumber);
        const existing = await db.select({ serialNumber: productUnits.serialNumber }).from(productUnits).where(inArray(productUnits.serialNumber, serialNumbers));
        if (existing.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: `Duplicate serials: ${existing.map(e => e.serialNumber).join(", ")}` });
        const newUnits = await db.insert(productUnits).values(input.units.map(u => ({ ...u, productId: input.productId, status: "IN_STOCK" }))).returning();
        await db.update(products).set({ hasSerial: true }).where(eq(products.id, input.productId));
        return { success: true, count: newUnits.length };
      }),

    scanProductUnit: managerProcedure
      .input(z.object({ code: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const unit = await db.select({ id: productUnits.id, serialNumber: productUnits.serialNumber, barcode: productUnits.barcode, status: productUnits.status, productId: productUnits.productId, productName: products.name }).from(productUnits).innerJoin(products, eq(productUnits.productId, products.id)).where(or(eq(productUnits.serialNumber, input.code), eq(productUnits.barcode, input.code))).limit(1);
        if (!unit.length) return { found: false, message: "No matching unit found" };
        return { found: true, unit: unit[0], available: unit[0].status === "IN_STOCK" };
      }),

    upsertCategory: managerProcedure
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
        await cacheDelPattern("categories");
        await cacheDelPattern("ai_store_context");
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
        await cacheDelPattern("categories");
        await cacheDelPattern("ai_store_context");
        return { success: true };
      }),

    reorderCategories: managerProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (db) {
          for (let i = 0; i < input.ids.length; i++) {
            await db.update(categoriesSchema).set({ order: i }).where(eq(categoriesSchema.id, input.ids[i]));
          }
        }
        await cacheDelPattern("categories");
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

    getPayoutRequests: managerProcedure.query(async () => {
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
        const [agent] = await db.select().from(drivers).where(eq(drivers.id, payoutRequest.agentId)).limit(1);
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

    createPresignedUrl: managerProcedure
      .input(z.object({ 
        filename: z.string().min(1).max(255), 
        contentType: z.string().regex(/^(image\/(jpeg|png|webp|gif|avif)|model\/gltf-binary|model\/gltf\+json|application\/octet-stream)?$/, "Only image or 3D model uploads are allowed") 
      }))
      .mutation(async ({ input }) => {
        // ────── SECURITY: Validate filename to prevent directory traversal ──
        if (input.filename.includes("..") || input.filename.includes("/") || input.filename.includes("\\")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid filename - directory traversal detected",
          });
        }

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
        
        // ────── SECURITY: Add file size restriction in PutObject metadata ──
        const command = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET || "",
          Key: key,
          ContentType: input.contentType,
          // Metadata for bucket policies to enforce max size
          Metadata: {
            "max-size": "52428800", // 50MB in bytes
          },
        });
        
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        const publicUrl = process.env.AWS_PUBLIC_URL ? `${process.env.AWS_PUBLIC_URL}/${key}` : `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
        
        return { uploadUrl, publicUrl };
      }),

    trainAiOnDocument: adminProcedure
      .input(z.object({ fileUrl: z.string(), fileName: z.string() }))
      .mutation(async ({ input }) => {
        if (!process.env.GROQ_API_KEY) throw new TRPCError({ code: "BAD_REQUEST", message: "GROQ_API_KEY is required" });
        const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });

        try {
          const fileRes = await fetch(input.fileUrl);
          const contentType = fileRes.headers.get("content-type") || "";
          
          if (contentType.includes("application/pdf") || input.fileName.endsWith(".pdf")) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "PDF parsing requires a dedicated server library. For now, please upload CSV or TXT files, or copy-paste your text directly into the memory box." });
          }

          let rawText = await fileRes.text();
          if (rawText.length > 20000) rawText = rawText.slice(0, 20000) + "\n...[truncated]";

          const analysis = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "Analyze and structure the following raw CSV/Text data into a highly compressed, structured markdown summary (bullet points or key-value pairs). Focus strictly on factual data, policies, or product info useful for a customer service AI. Do not include conversational filler." },
              { role: "user", content: `File Name: ${input.fileName}\n\nContent:\n${rawText}` }
            ]
          });

          const structuredKnowledge = analysis.choices[0].message.content || "";
          
          // Save it to database
          const existingKnowledge = (await getSetting("ai_knowledge")) || "";
          const newKnowledge = existingKnowledge + (existingKnowledge ? `\n\n` : "") + `### Source: ${input.fileName}\n${structuredKnowledge}`;
          
          await upsertSetting("ai_knowledge", newKnowledge);
          await cacheDelPattern("ai_knowledge");

          return { success: true, structuredKnowledge };
        } catch (e: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message || "Failed to process document" });
        }
      }),

    // --- Settings Management ---
    getSetting: managerProcedure
      .input(z.object({ key: z.string() }))
      .query(({ input }) => getSetting(input.key)),

    updateSetting: adminProcedure
      .input(z.object({ key: z.string(), value: z.any() }))
      .mutation(async ({ input }) => {
        await upsertSetting(input.key, input.value);
        await cacheDelPattern("settings");
        if (input.key === "brands") await cacheDelPattern("ai_store_context");
        return { success: true };
      }),

    sendTestEmail: adminProcedure
      .input(z.object({ email: z.string().email(), subject: z.string(), body: z.string() }))
      .mutation(async ({ input }) => {
        const emailSettings = await getSetting("email");
        const generalSettings = await getSetting("general");
        if (!emailSettings?.smtpHost || !emailSettings?.smtpUser) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "SMTP is not configured in Email Settings" });
        }
        const transporter = nodemailer.createTransport({
          host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
          secure: Number(emailSettings.smtpPort) === 465,
          auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
        });
        await transporter.sendMail({
          from: `"${generalSettings?.storeName || 'Store Admin'}" <${emailSettings.smtpUser}>`,
          to: input.email,
          subject: `[TEST] ${input.subject}`,
          html: input.body
        });
        return { success: true };
      }),

    // --- Content Management ---
    banners: managerProcedure.query(() => getBanners()),
    upsertBanner: managerProcedure
      .input(z.object({ id: z.number().optional(), title: z.string().min(1), description: z.string().nullable().optional(), image: z.string().min(1), active: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        await upsertBanner(input);
        await cacheDelPattern("banners");
        return { success: true };
      }),
    deleteBanner: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBanner(input.id);
        await cacheDelPattern("banners");
        return { success: true };
      }),

    reorderBanners: managerProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (db) {
          for (let i = 0; i < input.ids.length; i++) {
            await db.update(bannersSchema).set({ order: i }).where(eq(bannersSchema.id, input.ids[i]));
          }
        }
        await cacheDelPattern("banners");
        return { success: true };
      }),

    promotions: managerProcedure.query(() => getPromotions()),
    upsertPromotion: managerProcedure
      .input(z.object({ id: z.number().optional(), title: z.string().min(1), description: z.string().min(1), active: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        await upsertPromotion(input);
        await cacheDelPattern("promotions");
        return { success: true };
      }),
    deletePromotion: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deletePromotion(input.id);
        await cacheDelPattern("promotions");
        return { success: true };
      }),

    announcements: managerProcedure.query(() => getAnnouncements()),
    upsertAnnouncement: managerProcedure
      .input(z.object({ id: z.number().optional(), title: z.string().min(1), content: z.string().min(1), date: z.string().or(z.date()), image: z.string().optional(), linkUrl: z.string().optional(), active: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const date = new Date(input.date);
        await upsertAnnouncement({ ...input, date });
        await cacheDelPattern("announcements");
        return { success: true };
      }),
    deleteAnnouncement: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAnnouncement(input.id);
        await cacheDelPattern("announcements");
        return { success: true };
      }),

    // ─── Deletion Requests (Manager -> Admin workflow) ───
    requestDeletion: managerProcedure
      .input(z.object({
        itemType: z.enum(["product", "category", "banner", "promotion", "announcement", "driver", "vehicle", "brand"]),
        itemId: z.string().min(1),
        itemName: z.string().min(1),
        reason: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(deletionRequests).values({
          itemType: input.itemType,
          itemId: input.itemId,
          itemName: input.itemName,
          managerId: ctx.user.id,
          reason: input.reason,
          warehouseId: ctx.user.warehouseId,
          status: "pending"
        });
        return { success: true };
      }),

    getDeletionRequests: managerProcedure
      .input(z.object({ warehouseId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        let conditions = [];
        if (ctx.user.role === "manager" && ctx.user.warehouseId) conditions.push(eq(deletionRequests.warehouseId, ctx.user.warehouseId));
        else if (ctx.user.role === "admin" && input?.warehouseId) conditions.push(eq(deletionRequests.warehouseId, input.warehouseId));

        return db.select({
          id: deletionRequests.id,
          itemType: deletionRequests.itemType,
          itemId: deletionRequests.itemId,
          itemName: deletionRequests.itemName,
          reason: deletionRequests.reason,
          status: deletionRequests.status,
          createdAt: deletionRequests.createdAt,
          managerName: users.name
        })
        .from(deletionRequests)
        .leftJoin(users, eq(deletionRequests.managerId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(deletionRequests.createdAt));
      }),

    reviewDeletionRequest: adminProcedure
      .input(z.object({
        requestId: z.number(),
        action: z.enum(["approve", "reject"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [request] = await db.select().from(deletionRequests).where(eq(deletionRequests.id, input.requestId)).limit(1);
        if (!request || request.status !== "pending") {
           throw new TRPCError({ code: "BAD_REQUEST", message: "Request not found or already processed" });
        }

        if (input.action === "reject") {
           await db.update(deletionRequests).set({ status: "rejected", adminId: ctx.user.id, updatedAt: new Date() }).where(eq(deletionRequests.id, input.requestId));
           return { success: true, message: "Request rejected" };
        }

        if (input.action === "approve") {
           const idNum = parseInt(request.itemId, 10);
           try {
             switch (request.itemType) {
               case "product": await deleteProduct(idNum); break;
               case "category":
                 await db.update(categoriesSchema).set({ parentId: null }).where(eq(categoriesSchema.parentId, idNum));
                 await db.delete(categoriesSchema).where(eq(categoriesSchema.id, idNum));
                 break;
               case "banner": await deleteBanner(idNum); break;
               case "promotion": await deletePromotion(idNum); break;
               case "announcement": await deleteAnnouncement(idNum); break;
           case "driver": 
             const [driver] = await db.select().from(drivers).where(eq(drivers.id, idNum)).limit(1);
             if (driver) {
               await db.update(drivers).set({ status: "inactive" }).where(eq(drivers.id, idNum));
               
               const dismissalData = {
                 type: 'driver',
                 id: idNum,
                 name: driver.name,
                 email: driver.email,
                 reason: request.reason,
                 firedAt: Date.now(),
                 appealStatus: 'none',
                 appealText: null
               };
               await upsertSetting(`dismissal_driver_${idNum}`, dismissalData);
               
               const token = await new SignJWT({ type: "driver", id: idNum, purpose: "appeal" })
                 .setProtectedHeader({ alg: "HS256" })
                 .setExpirationTime("3d")
                 .sign(JWT_SECRET);
                 
               if (driver.email) {
                 try {
                   const emailSettings = await getSetting("email");
                   const generalSettings = await getSetting("general");
                   const appearanceSettings = await getSetting("appearance");
                   
                   if (emailSettings?.smtpHost && emailSettings?.smtpUser) {
                     const transporter = nodemailer.createTransport({ host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort), secure: Number(emailSettings.smtpPort) === 465, auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword } });
                     const host = ctx.req.headers.host || "localhost:3000";
                     const protocol = host.includes("localhost") ? "http" : "https";
                     const appealLink = `${protocol}://${host}/appeal?token=${token}`;
                     const emailHtml = getDismissalEmailHtml({ storeName: generalSettings?.storeName || "Store", logoUrl: appearanceSettings?.logoUrl, primaryColor: emailSettings?.emailButtonColor || appearanceSettings?.primaryColor || "#ef4444", contactEmail: generalSettings?.contactEmail || "support@example.com", name: driver.name, role: "Driver", reason: request.reason, appealLink, emailBackgroundColor: emailSettings?.emailBackgroundColor, theme: emailSettings?.theme });
                     await transporter.sendMail({ from: `"${generalSettings?.storeName || 'Store Admin'}" <${emailSettings.smtpUser}>`, to: driver.email, subject: `Notice of Dismissal`, html: emailHtml });
                   }
                 } catch (err) { console.error(err); }
               }
             }
             break;
               case "vehicle": await db.delete(vehicles).where(eq(vehicles.id, idNum)); break;
             }
           } catch (e: any) {
             throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete item: " + e.message });
           }
           await db.update(deletionRequests).set({ status: "approved", adminId: ctx.user.id, updatedAt: new Date() }).where(eq(deletionRequests.id, input.requestId));
           return { success: true, message: "Request approved and item deleted" };
        }
      }),

    fireManager: adminProcedure
      .input(z.object({ managerId: z.number(), reason: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const [manager] = await db.select().from(users).where(and(eq(users.id, input.managerId), eq(users.role, "manager"))).limit(1);
        if (!manager) throw new TRPCError({ code: "NOT_FOUND", message: "Manager not found" });
        
        await db.update(users).set({ suspended: true }).where(eq(users.id, input.managerId));
        
        const dismissalData = {
          type: 'manager',
          id: input.managerId,
          name: manager.name,
          email: manager.email,
          reason: input.reason,
          firedAt: Date.now(),
          appealStatus: 'none',
          appealText: null
        };
        await upsertSetting(`dismissal_manager_${input.managerId}`, dismissalData);
        
        const token = await new SignJWT({ type: "manager", id: input.managerId, purpose: "appeal" })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("3d")
          .sign(JWT_SECRET);
          
        if (manager.email) {
          try {
            const emailSettings = await getSetting("email");
            const generalSettings = await getSetting("general");
            const appearanceSettings = await getSetting("appearance");
            
            if (emailSettings?.smtpHost && emailSettings?.smtpUser) {
              const transporter = nodemailer.createTransport({ host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort), secure: Number(emailSettings.smtpPort) === 465, auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword } });
              const host = ctx.req.headers.host || "localhost:3000";
              const protocol = host.includes("localhost") ? "http" : "https";
              const appealLink = `${protocol}://${host}/appeal?token=${token}`;
              const emailHtml = getDismissalEmailHtml({ storeName: generalSettings?.storeName || "Store", logoUrl: appearanceSettings?.logoUrl, primaryColor: emailSettings?.emailButtonColor || appearanceSettings?.primaryColor || "#ef4444", contactEmail: generalSettings?.contactEmail || "support@example.com", name: manager.name, role: "Manager", reason: input.reason, appealLink, emailBackgroundColor: emailSettings?.emailBackgroundColor, theme: emailSettings?.theme });
              await transporter.sendMail({ from: `"${generalSettings?.storeName || 'Store Admin'}" <${emailSettings.smtpUser}>`, to: manager.email, subject: `Notice of Dismissal`, html: emailHtml });
            }
          } catch (err) { console.error(err); }
        }
        
        return { success: true };
      }),

    warehouses: managerProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      return db.select().from(warehouses);
    }),

    upsertWarehouse: adminProcedure
      .input(z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        type: z.string(),
        address: z.string().min(1),
        country: z.string().min(1),
        county: z.string().optional(),
        city: z.string().min(1),
        lat: z.number(),
        lng: z.number(),
        active: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        
        if (input.id) {
          // Update existing warehouse
          await db.update(warehouses).set({
            name: input.name,
            type: input.type,
            address: input.address,
            country: input.country,
            county: input.county || null,
            city: input.city,
            lat: input.lat,
            lng: input.lng,
            active: input.active,
            updatedAt: new Date(),
          }).where(eq(warehouses.id, input.id));
          return { success: true, id: input.id };
        } else {
          // Create new warehouse
          const result = await db.insert(warehouses).values({
            name: input.name,
            type: input.type,
            address: input.address,
            country: input.country,
            county: input.county || null,
            city: input.city,
            lat: input.lat,
            lng: input.lng,
            active: input.active,
          }).returning({ id: warehouses.id });
          return { success: true, id: result[0]?.id || 0 };
        }
      }),
  }),

  // ─── Inventory Analytics (Tier 1 & 2) ──────────────────────────────────────
  inventory: router({
    heatmap: managerProcedure
      .input(z.object({ threshold: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const cacheKey = `inv_heatmap_${input?.threshold || 20}`;
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;
        const data = await getStockHeatmapByWarehouse(input?.threshold);
        await cacheSet(cacheKey, data, 5);
        return data;
      }),
    velocityTrends: managerProcedure
      .input(z.object({ limit: z.number().optional(), timeRange: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const cacheKey = `inv_velocity_${input?.limit || 50}`;
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;
        const data = await getStockVelocityTrends(input?.limit);
        await cacheSet(cacheKey, data, 5);
        return data;
      }),
    imbalances: managerProcedure.query(async () => {
      const cached = await cacheGet("inv_imbalances");
      if (cached) return cached;
      const data = await getWarehouseImbalances();
      await cacheSet("inv_imbalances", data, 5);
      return data;
    }),
    forecasts: managerProcedure.query(async () => {
      const cached = await cacheGet("inv_forecasts");
      if (cached) return cached;
      const data = await getDemandForecasts();
      await cacheSet("inv_forecasts", data, 5);
      return data;
    }),
    aging: managerProcedure.query(async () => {
      const cached = await cacheGet("inv_aging");
      if (cached) return cached;
      const data = await getInventoryAging();
      await cacheSet("inv_aging", data, 5);
      return data;
    }),
  }),

  // ─── Fleet Management ──────────────────────────────────────────────────────
  fleet: router({
    getAgents: managerProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const agentsList = await db.select().from(drivers);
      
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

    getDrivers: managerProcedure
      .input(z.object({ warehouseId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      let conditions = [];
      if (ctx.user.role === "manager" && ctx.user.warehouseId) conditions.push(eq(drivers.warehouseId, ctx.user.warehouseId));
      else if (ctx.user.role === "admin" && input?.warehouseId) conditions.push(eq(drivers.warehouseId, input.warehouseId));
      
      const driversList = await db.select().from(drivers).where(conditions.length > 0 ? and(...conditions) : undefined);
      
      const activeOrders = await db.select({
        agentId: orders.deliveryAgentId,
        city: orders.shippingCity
      }).from(orders).where(eq(orders.status, "out_for_delivery"));

      return driversList.map(driver => {
        const agentOrders = activeOrders.filter(o => o.agentId === driver.id);
        const activeCity = agentOrders.length > 0 ? agentOrders[0].city : null;
        const { pin, ...rest } = driver;
        return { ...rest, activeCity };
      });
    }),

    getVehicles: managerProcedure
      .input(z.object({ warehouseId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      let conditions = [];
      if (ctx.user.role === "manager" && ctx.user.warehouseId) conditions.push(eq(vehicles.warehouseId, ctx.user.warehouseId));
      else if (ctx.user.role === "admin" && input?.warehouseId) conditions.push(eq(vehicles.warehouseId, input.warehouseId));
      
      return db.select().from(vehicles).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(vehicles.createdAt));
    }),

    upsertDriver: managerProcedure
      .input(z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional().nullable(),
        licenseNumber: z.string().optional().nullable(),
        status: z.enum(["active", "inactive"]).optional(),
        pin: z.string().optional(),
        generatePin: z.boolean().optional(),
        photoUrl: z.string().optional(),
        warehouseId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const dataToUpdate: any = {
          name: input.name,
          phone: input.phone,
          email: input.email || null,
          licenseNumber: input.licenseNumber || null,
          photoUrl: input.photoUrl || null,
          warehouseId: ctx.user.role === "manager" ? ctx.user.warehouseId : input.warehouseId,
        };
        if (input.status) dataToUpdate.status = input.status;
        
        let finalPin = input.pin;
        let generatedPin = false;
        if (input.generatePin || (!input.id && !finalPin)) {
          // Generate a secure 6-character alphanumeric PIN
          finalPin = Math.random().toString(36).substring(2, 8).toUpperCase(); 
          generatedPin = true;
        }
        if (finalPin) dataToUpdate.pin = await hashPassword(finalPin);

        if (input.id) {
          await db.update(drivers).set(dataToUpdate).where(eq(drivers.id, input.id));
        } else {
          await db.insert(drivers).values(dataToUpdate as any);
        }

        // Dispatch credentials email if a new PIN was generated and an email was provided
        if (generatedPin && input.email) {
          try {
            const emailSettings = await getSetting("email");
            const generalSettings = await getSetting("general");
            const appearanceSettings = await getSetting("appearance");
            
            if (emailSettings?.smtpHost && emailSettings?.smtpUser) {
              const transporter = nodemailer.createTransport({
                host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
                secure: Number(emailSettings.smtpPort) === 465,
                auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
              });

              const host = ctx.req.headers.host || "localhost:3000";
              const protocol = host.includes("localhost") ? "http" : "https";
              const systemUrl = `${protocol}://${host}/driver-portal`;

              const emailHtml = getDriverPinEmailHtml({
                storeName: generalSettings?.storeName || "Store Fleet", logoUrl: appearanceSettings?.logoUrl, primaryColor: emailSettings?.emailButtonColor || appearanceSettings?.primaryColor || "#10b981", contactEmail: generalSettings?.contactEmail || "support@example.com", storePhone: generalSettings?.phone || "",
                driverName: input.name, pin: finalPin, phone: input.phone, systemUrl,
                emailBackgroundColor: emailSettings?.emailBackgroundColor,
                theme: emailSettings?.theme,
                customTemplate: emailSettings?.customTemplates?.driverPin
              });

              await transporter.sendMail({ from: `"${generalSettings?.storeName || 'Store Fleet'}" <${emailSettings.smtpUser}>`, to: input.email, subject: `Welcome! Your Driver Access Credentials`, html: emailHtml });
            }
          } catch (err) {
            console.error("Failed to send driver credentials email:", err);
          }
        }

        return { success: true, defaultPinUsed: generatedPin, generatedPin: generatedPin ? finalPin : undefined };
      }),

    deleteDriver: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Soft Delete: Keep record for audit logs but mark inactive
        await db.update(drivers).set({ status: "inactive" }).where(eq(drivers.id, input.id));
        return { success: true };
      }),

    upsertVehicle: managerProcedure
      .input(z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        numberPlate: z.string().min(1),
        type: z.enum(["car", "motorcycle", "truck"]),
        status: z.enum(["available", "assigned", "maintenance"]).optional(),
        warehouseId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const warehouseId = ctx.user.role === "manager" ? ctx.user.warehouseId : input.warehouseId;
        const data = { ...input, warehouseId };
        if (input.id) {
          await db.update(vehicles).set(data).where(eq(vehicles.id, input.id));
        } else {
          await db.insert(vehicles).values(data as any);
        }
        return { success: true };
      }),

    deleteVehicle: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Soft Delete: Keep record for audit logs but mark as maintenance/inactive
        await db.update(vehicles).set({ status: "maintenance" }).where(eq(vehicles.id, input.id));
        return { success: true };
      }),

    getAssignments: managerProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select({
        id: assignments.id,
        driverId: assignments.driverId,
        vehicleId: assignments.vehicleId,
        assignedAt: assignments.assignedAt,
        returnedAt: assignments.returnedAt,
        status: assignments.status,
        driverName: drivers.name,
        vehicleName: vehicles.name,
        vehiclePlate: vehicles.numberPlate,
      })
      .from(assignments)
      .innerJoin(drivers, eq(assignments.driverId, drivers.id))
      .innerJoin(vehicles, eq(assignments.vehicleId, vehicles.id))
      .orderBy(desc(assignments.assignedAt));
    }),

    getMyAssignment: publicProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [assignment] = await db.select({
          id: assignments.id,
          status: assignments.status,
          vehicleName: vehicles.name,
          vehiclePlate: vehicles.numberPlate,
          vehicleType: vehicles.type
        })
        .from(assignments)
        .innerJoin(vehicles, eq(assignments.vehicleId, vehicles.id))
         .where(and(eq(assignments.driverId, input.agentId), or(eq(assignments.status, "active"), eq(assignments.status, "completed"))))
        .limit(1);
        return assignment || null;
      }),

    createAssignment: managerProcedure
      .input(z.object({ driverId: z.number(), vehicleId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, input.vehicleId)).limit(1);
        if (!vehicle || vehicle.status !== "available") throw new TRPCError({ code: "BAD_REQUEST", message: "Vehicle is not available" });

        const activeAssignments = await db.select().from(assignments).where(and(eq(assignments.driverId, input.driverId), eq(assignments.status, "active")));
        if (activeAssignments.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Driver already has an active vehicle assignment" });

        await db.insert(assignments).values({ driverId: input.driverId, vehicleId: input.vehicleId, status: "active" });
        await db.update(vehicles).set({ status: "assigned" }).where(eq(vehicles.id, input.vehicleId));
        return { success: true };
      }),

    requestVehicleReturn: publicProcedure
      .input(z.object({ assignmentId: z.number(), imageUrl: z.string().optional(), notes: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(assignments).set({ status: "pending_return" }).where(eq(assignments.id, input.assignmentId));
        
        if (input.imageUrl || input.notes) {
          await upsertSetting(`return_req_${input.assignmentId}`, { imageUrl: input.imageUrl, notes: input.notes });
        }
        
        return { success: true };
      }),

    getReturnRequestDetails: managerProcedure
      .input(z.object({ assignmentId: z.number() }))
      .query(async ({ input }) => {
        return await getSetting(`return_req_${input.assignmentId}`);
      }),
      
    createPresignedUrl: publicProcedure
      .input(z.object({ 
        filename: z.string().min(1).max(255), 
        contentType: z.string().regex(/^(image\/(jpeg|png|webp|gif|avif)|model\/gltf-binary|model\/gltf\+json|application\/octet-stream)?$/, "Only image or 3D model uploads are allowed") 
      }))
      .mutation(async ({ input }) => {
        if (input.filename.includes("..") || input.filename.includes("/") || input.filename.includes("\\")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid filename" });
        }
        const accessKey = process.env.AWS_ACCESS_KEY_ID;
        if (!accessKey || accessKey === "your_access_key") return { uploadUrl: null, publicUrl: null };

        const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
        const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

        const s3Client = new S3Client({
          region: process.env.AWS_REGION || "auto",
          endpoint: process.env.AWS_ENDPOINT || undefined,
          credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || "", secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "" },
        });
        
        const safeName = input.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
        const key = `uploads/driver-${Date.now()}-${safeName}`;
        
        const command = new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET || "", Key: key, ContentType: input.contentType, Metadata: { "max-size": "52428800" } });
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        const publicUrl = process.env.AWS_PUBLIC_URL ? `${process.env.AWS_PUBLIC_URL}/${key}` : `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
        
        return { uploadUrl, publicUrl };
      }),

    returnAssignment: managerProcedure
      .input(z.object({ assignmentId: z.number(), inspectionNotes: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [assignment] = await db.select().from(assignments).where(eq(assignments.id, input.assignmentId)).limit(1);
        if (!assignment || assignment.status === "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Assignment not found or already completed" });

        const updateData: any = { status: "completed", returnedAt: new Date() };
        await db.update(assignments).set(updateData).where(eq(assignments.id, input.assignmentId));
        await db.update(vehicles).set({ status: "available" }).where(eq(vehicles.id, assignment.vehicleId));
        
        if (input.inspectionNotes) {
          const existing = await getSetting(`return_req_${input.assignmentId}`) || {};
          await upsertSetting(`return_req_${input.assignmentId}`, { ...existing, adminNotes: input.inspectionNotes });
        }
        
        return { success: true };
      }),

    getVapidPublicKey: publicProcedure.query(() => {
      const key = process.env.VAPID_PUBLIC_KEY || null;
      if (!key) {
        console.warn("⚠️ VAPID_PUBLIC_KEY is not configured. Push notifications will not work.");
      }
      return key;
    }),

    debugPushSubscription: publicProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        try {
          const [driver] = await db.select().from(drivers).where(eq(drivers.id, input.agentId)).limit(1);
          if (!driver) throw new TRPCError({ code: "NOT_FOUND", message: "Driver not found" });
          
          return {
            driverId: driver.id,
            driverName: driver.name,
            driverEmail: driver.email,
            hasSubscription: !!driver.pushSubscription,
            subscriptionEndpoint: driver.pushSubscription ? (driver.pushSubscription as any).endpoint : null,
            hasVapidKeys: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
            vapidPublicKey: process.env.VAPID_PUBLIC_KEY ? "✅ Configured" : "❌ Missing",
            vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ? "✅ Configured" : "❌ Missing",
            status: driver.status
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error("Debug push subscription failed:", errorMsg);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errorMsg });
        }
      }),

    savePushSubscription: publicProcedure
      .input(z.object({ 
        agentId: z.number(),
        subscription: z.object({
          endpoint: z.string().url(),
          keys: z.object({
            auth: z.string(),
            p256dh: z.string()
          })
        })
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        try {
          // Validate subscription structure before saving
          if (!input.subscription.endpoint || !input.subscription.keys?.auth || !input.subscription.keys?.p256dh) {
            throw new Error("Invalid subscription structure: missing endpoint or keys");
          }
          
          await db.update(drivers).set({ pushSubscription: input.subscription }).where(eq(drivers.id, input.agentId));
          console.log(`✅ Push subscription saved for driver ${input.agentId}`);
          return { success: true, message: "Push subscription saved successfully" };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`❌ Failed to save push subscription for driver ${input.agentId}:`, errorMsg);
          throw new TRPCError({ code: "BAD_REQUEST", message: errorMsg });
        }
      }),

    getDriverProfile: publicProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [agent] = await db.select().from(drivers).where(eq(drivers.id, input.agentId)).limit(1);
        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Driver not found" });
        const { pin, ...rest } = agent;
        return rest;
      }),

    updateAvailability: publicProcedure
      .input(z.object({ agentId: z.number(), isAvailable: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(drivers).set({ status: input.isAvailable ? "active" : "inactive" }).where(eq(drivers.id, input.agentId));
        return { success: true };
      }),

    upsertAgent: managerProcedure
      .input(z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        phone: z.string().min(1),
        vehicleNumber: z.string().min(1),
        vehicleType: z.string().min(1),
        pin: z.string().optional(),
        isAvailable: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const dataToUpdate: any = {
          name: input.name,
          phone: input.phone,
          vehicleNumber: input.vehicleNumber,
          vehicleType: input.vehicleType,
        };
        if (input.isAvailable !== undefined) dataToUpdate.isAvailable = input.isAvailable;
        
        let finalPin = input.pin;
        let generatedPin = false;
        if (!input.id && !finalPin) {
          finalPin = Math.random().toString(36).substring(2, 8).toUpperCase();
          generatedPin = true;
        }
        if (finalPin) dataToUpdate.pin = await hashPassword(finalPin); // Hash the PIN before saving!

        if (input.id) {
          await db.update(drivers).set(dataToUpdate).where(eq(drivers.id, input.id));
        } else {
          await db.insert(drivers).values(dataToUpdate as any);
        }
        // Skipping email logic here as upsertAgent is legacy fallback. Email goes out on upsertDriver.
        return { success: true, defaultPinUsed: generatedPin, generatedPin: generatedPin ? finalPin : undefined };
      }),

    deleteAgent: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Soft Delete
        await db.update(drivers).set({ status: "inactive" }).where(eq(drivers.id, input.id));
        return { success: true };
    }),

    assignDelivery: managerProcedure
      .input(z.object({ orderId: z.number(), agentId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const [orderToAssign] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
        if (!orderToAssign) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

        const [agent] = await db.select().from(drivers).where(eq(drivers.id, input.agentId)).limit(1);
        if (!agent || agent.status !== "active") {
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

        // --- Send Email Notification to Driver ---
        if (agent.email) {
          try {
            const emailSettings = await getSetting("email");
            const generalSettings = await getSetting("general");
            
            if (emailSettings?.smtpHost && emailSettings?.smtpUser) {
              const transporter = nodemailer.createTransport({
                host: emailSettings.smtpHost,
                port: Number(emailSettings.smtpPort),
                secure: Number(emailSettings.smtpPort) === 465,
                auth: {
                  user: emailSettings.smtpUser,
                  pass: emailSettings.smtpPassword,
                },
              });

              const storeName = generalSettings?.storeName || "Store System";
              const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #3b82f6;">New Delivery Assigned 📦</h2>
                  <p>Hello ${agent.name},</p>
                  <p>You have been assigned a new delivery for Order <strong>#${orderToAssign.orderNumber}</strong>.</p>
                  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>Customer:</strong> ${orderToAssign.shippingFullName}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Address:</strong> ${orderToAssign.shippingAddress}, ${orderToAssign.shippingCity}</p>
                    <p style="margin: 0;"><strong>Phone:</strong> ${orderToAssign.shippingPhone}</p>
                  </div>
                  <p>Please log in to your Driver Portal to view the full details and access the delivery OTP.</p>
                  <p>Drive safely!</p>
                </div>
              `;

              await transporter.sendMail({
                from: `"${storeName}" <${emailSettings.smtpUser}>`,
                to: agent.email,
                subject: `New Delivery Assigned - Order #${orderToAssign.orderNumber}`,
                html: emailHtml,
              });
            }
          } catch (err) {
            console.error("Failed to send driver assignment email:", err);
          }
        }

        if (agent.pushSubscription && process.env.VAPID_PUBLIC_KEY) {
          try {
            // Validate subscription structure
            const sub = agent.pushSubscription as any;
            if (!sub.endpoint || !sub.keys?.auth || !sub.keys?.p256dh) {
              throw new Error(`Invalid subscription structure for driver ${agent.id}: missing required fields (endpoint or keys)`);
            }
            
            console.log(`📤 Sending push notification to driver ${agent.id} (${agent.email})...`);
            await webpush.sendNotification(
              sub,
              JSON.stringify({
                title: "New Delivery Assigned 📦",
                body: `Order #${orderToAssign.orderNumber} is ready for you.`,
                url: "/driver-portal"
              })
            );
            console.log(`✅ Push notification sent successfully to driver ${agent.id}`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Web push notification failed for driver ${agent.id}:`, errorMsg);
            console.error("Full error details:", error);
          }
        } else {
          if (!agent.pushSubscription) {
            console.warn(`⚠️ Driver ${agent.id} has no push subscription saved`);
          }
          if (!process.env.VAPID_PUBLIC_KEY) {
            console.warn("⚠️ VAPID_PUBLIC_KEY environment variable is not configured");
          }
        }

        return { success: true, message: "Delivery assigned successfully!" };
      }),

    myDeliveries: publicProcedure
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

    verifyOtpAndComplete: publicProcedure
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

    requestDriverPinReset: publicProcedure
      .input(z.object({ phone: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const isEmail = input.phone.includes('@');
        let agent;

        if (isEmail) {
          const result = await db.select().from(drivers).where(
            eq(drivers.email, input.phone.trim().toLowerCase())
          ).limit(1);
          agent = result[0];
        } else {
          let rawPhone = input.phone.replace(/\s+/g, '');
          let coreDigits = rawPhone;
          if (coreDigits.startsWith('+254')) coreDigits = coreDigits.slice(4);
          else if (coreDigits.startsWith('254')) coreDigits = coreDigits.slice(3);
          else if (coreDigits.startsWith('0')) coreDigits = coreDigits.slice(1);

          const possiblePhones = [
            rawPhone, `0${coreDigits}`, `+254${coreDigits}`, `254${coreDigits}`
          ].filter(p => p.length <= 20);

          const result = possiblePhones.length > 0 ? await db.select().from(drivers).where(inArray(drivers.phone, possiblePhones)).limit(1) : [];
          agent = result[0];
        }

        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Driver not found. Please check your phone number." });

        if (!agent.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No email associated with this account. Please contact your fleet manager to reset your PIN manually." });
        }

        const newPin = Math.random().toString(36).substring(2, 8).toUpperCase();
        const hashedPin = await hashPassword(newPin);
        await db.update(drivers).set({ pin: hashedPin }).where(eq(drivers.id, agent.id));

        try {
          const emailSettings = await getSetting("email");
          const generalSettings = await getSetting("general");
          const appearanceSettings = await getSetting("appearance");

          if (emailSettings?.smtpHost && emailSettings?.smtpUser) {
            const transporter = nodemailer.createTransport({
              host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
              secure: Number(emailSettings.smtpPort) === 465,
              auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
            });

            const host = ctx.req.headers.host || "localhost:3000";
            const protocol = host.includes("localhost") ? "http" : "https";
            const systemUrl = `${protocol}://${host}/driver-portal`;

            const emailHtml = getDriverPinEmailHtml({
              storeName: generalSettings?.storeName || "Store Fleet", logoUrl: appearanceSettings?.logoUrl, primaryColor: emailSettings?.emailButtonColor || appearanceSettings?.primaryColor || "#10b981", contactEmail: generalSettings?.contactEmail || "support@example.com", storePhone: generalSettings?.phone || "",
              driverName: agent.name, pin: newPin, phone: agent.phone, systemUrl,
              emailBackgroundColor: emailSettings?.emailBackgroundColor,
              theme: emailSettings?.theme,
              customTemplate: emailSettings?.customTemplates?.driverPin
            });

            await transporter.sendMail({ from: `"${generalSettings?.storeName || 'Store Fleet'}" <${emailSettings.smtpUser}>`, to: agent.email, subject: `Password Reset: Your New Driver Access PIN`, html: emailHtml });
          }
        } catch (err) {
          console.error("Failed to send PIN reset email:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send reset email. Please try again later." });
        }

        return { success: true, message: "A new PIN has been generated and sent to your email address." };
      }),

    requestDriverPinOtp: publicProcedure
      .input(z.object({ phone: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const isEmail = input.phone.includes('@');
        let agent;

        if (isEmail) {
          const result = await db.select().from(drivers).where(
            eq(drivers.email, input.phone.trim().toLowerCase())
          ).limit(1);
          agent = result[0];
        } else {
          let rawPhone = input.phone.replace(/\s+/g, '');
          let coreDigits = rawPhone;
          if (coreDigits.startsWith('+254')) coreDigits = coreDigits.slice(4);
          else if (coreDigits.startsWith('254')) coreDigits = coreDigits.slice(3);
          else if (coreDigits.startsWith('0')) coreDigits = coreDigits.slice(1);

          const possiblePhones = [
            rawPhone, `0${coreDigits}`, `+254${coreDigits}`, `254${coreDigits}`
          ].filter(p => p.length <= 20);

          const result = possiblePhones.length > 0 ? await db.select().from(drivers).where(inArray(drivers.phone, possiblePhones)).limit(1) : [];
          agent = result[0];
        }

        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Driver not found. Please check your phone number." });

        if (!agent.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No email associated with this account. Please contact your fleet manager." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const token = await new SignJWT({ email: agent.email, purpose: "driver_pin_reset", otp })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("30m")
          .sign(JWT_SECRET);

        const host = ctx.req.headers.host || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        const resetLink = `${protocol}://${host}/driver-portal?email=${encodeURIComponent(agent.email)}&token=${token}`;

        try {
          const emailSettings = await getSetting("email");
          const generalSettings = await getSetting("general");
          const appearanceSettings = await getSetting("appearance");

          if (emailSettings?.smtpHost && emailSettings?.smtpUser) {
            const transporter = nodemailer.createTransport({
              host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
              secure: Number(emailSettings.smtpPort) === 465,
              auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
            });

            const storeName = generalSettings?.storeName || "Store Fleet";
            const emailHtml = getResetPasswordEmailHtml({
              storeName, logoUrl: appearanceSettings?.logoUrl, primaryColor: emailSettings?.emailButtonColor || appearanceSettings?.primaryColor || "#10b981", contactEmail: generalSettings?.contactEmail || "support@example.com", storePhone: generalSettings?.phone || "",
              name: agent.name, otp,
              resetLink,
              portalName: "Driver Portal",
              emailBackgroundColor: emailSettings?.emailBackgroundColor,
              theme: emailSettings?.theme,
              customTemplate: emailSettings?.customTemplates?.resetPassword
            });

            await transporter.sendMail({ from: `"${storeName}" <${emailSettings.smtpUser}>`, to: agent.email, subject: `Driver PIN Reset Code`, html: emailHtml });
          }
        } catch (err) {
          console.error("Failed to send PIN reset OTP email:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send reset email. Please try again later." });
        }

        return { success: true, token, email: agent.email };
      }),

    verifyDriverPinOtpAndReset: publicProcedure
      .input(z.object({ token: z.string(), code: z.string() }))
      .mutation(async ({ input, ctx }) => {
        let payload;
        try {
          const verified = await jwtVerify(input.token, JWT_SECRET);
          payload = verified.payload;
        } catch (e) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset token" });
        }

        if (payload.purpose !== "driver_pin_reset" || !payload.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid token" });
        }
        if (payload.otp !== input.code) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Incorrect reset code" });
        }

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [agent] = await db.select().from(drivers).where(eq(drivers.email, payload.email as string)).limit(1);
        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Driver not found" });

        const newPin = Math.random().toString(36).substring(2, 8).toUpperCase();
        const hashedPin = await hashPassword(newPin);
        await db.update(drivers).set({ pin: hashedPin }).where(eq(drivers.id, agent.id));

        try {
          const emailSettings = await getSetting("email");
          const generalSettings = await getSetting("general");
          const appearanceSettings = await getSetting("appearance");

          if (emailSettings?.smtpHost && emailSettings?.smtpUser) {
            const transporter = nodemailer.createTransport({
              host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
              secure: Number(emailSettings.smtpPort) === 465,
              auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
            });

            const host = ctx.req.headers.host || "localhost:3000";
            const protocol = host.includes("localhost") ? "http" : "https";
            const systemUrl = `${protocol}://${host}/driver-portal`;

            const emailHtml = getDriverPinEmailHtml({
              storeName: generalSettings?.storeName || "Store Fleet", logoUrl: appearanceSettings?.logoUrl, primaryColor: emailSettings?.emailButtonColor || appearanceSettings?.primaryColor || "#10b981", contactEmail: generalSettings?.contactEmail || "support@example.com", storePhone: generalSettings?.phone || "",
              driverName: agent.name, pin: newPin, phone: agent.phone, systemUrl,
              emailBackgroundColor: emailSettings?.emailBackgroundColor,
              theme: emailSettings?.theme,
              customTemplate: emailSettings?.customTemplates?.driverPin
            });

            await transporter.sendMail({ from: `"${generalSettings?.storeName || 'Store Fleet'}" <${emailSettings.smtpUser}>`, to: agent.email, subject: `Your New Driver Access PIN`, html: emailHtml });
          }
        } catch (err) {
          console.error("Failed to send new PIN email:", err);
        }

        return { success: true, message: "A new PIN has been generated and sent to your email address." };
      }),

    verifyDriverPin: publicProcedure
      .input(z.object({ phone: z.string(), pin: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const exactPin = input.pin.trim();
        const upperPin = exactPin.toUpperCase();

        const isEmail = input.phone.includes('@');
        let agent;

        if (isEmail) {
          const result = await db.select().from(drivers).where(
            eq(drivers.email, input.phone.trim().toLowerCase())
          ).limit(1);
          agent = result[0];
        } else {
          // Robust Phone Parsing (Removes spaces, and builds an array of all possible formats)
          let rawPhone = input.phone.replace(/\s+/g, '');
          let coreDigits = rawPhone;
          if (coreDigits.startsWith('+254')) coreDigits = coreDigits.slice(4);
          else if (coreDigits.startsWith('254')) coreDigits = coreDigits.slice(3);
          else if (coreDigits.startsWith('0')) coreDigits = coreDigits.slice(1);

          const possiblePhones = [
            rawPhone, `0${coreDigits}`, `+254${coreDigits}`, `254${coreDigits}`
          ].filter(p => p.length <= 20);

          const result = possiblePhones.length > 0 ? await db.select().from(drivers).where(inArray(drivers.phone, possiblePhones)).limit(1) : [];
          agent = result[0];
        }
        
        if (!agent) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid Phone Number or PIN" });

        const isHashed = agent.pin.includes(":");
        let isValid = false;
        if (isHashed) {
          const [salt, hash] = agent.pin.split(':');
          isValid = await verifyPassword(exactPin, hash, salt);
          if (!isValid && exactPin !== upperPin) isValid = await verifyPassword(upperPin, hash, salt);
        } else {
          isValid = agent.pin === exactPin || agent.pin.toUpperCase() === upperPin;
        }

        if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid Phone Number or PIN" });

        if (agent.status === "inactive") {
          const dismissal = await getSetting(`dismissal_driver_${agent.id}`);
          if (dismissal) {
            throw new TRPCError({ code: "FORBIDDEN", message: `Access denied due to violation of company rules: ${dismissal.reason}` });
          }
        }

        // Auto-upgrade unhashed PINs for better security dynamically
        if (!isHashed) {
          const hashedPin = await hashPassword(upperPin);
          await db.update(drivers).set({ pin: hashedPin }).where(eq(drivers.id, agent.id));
        }

        return { success: true, agentId: agent.id, agentName: agent.name };
      }),

    getEarnings: publicProcedure
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

    requestPayout: publicProcedure
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

            const [agent] = await db.select({ name: drivers.name }).from(drivers).where(eq(drivers.id, input.agentId)).limit(1);
            
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

    getPayoutHistory: publicProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return await db.select().from(deliveryPayouts).where(eq(deliveryPayouts.agentId, input.agentId)).orderBy(desc(deliveryPayouts.requestedAt));
      }),

    // ─── Delivery Messages (Driver-Customer Chat) ───
    getDeliveryMessages: publicProcedure
      .input(z.object({ orderId: z.number(), agentId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Fetch the order to verify access permissions
        const order = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
        if (!order || order.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }

        const foundOrder = order[0];

        // Check authorization: Either customer (logged in) or assigned driver
        const isCustomer = ctx.user && foundOrder.userId === ctx.user.id;
        const isDriver = input.agentId && foundOrder.deliveryAgentId === input.agentId;

        if (!isCustomer && !isDriver) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You are not authorized to view messages for this order." });
        }

        return await db.select().from(deliveryMessages).where(eq(deliveryMessages.orderId, input.orderId)).orderBy(deliveryMessages.createdAt);
      }),

    sendDeliveryMessage: publicProcedure
      .input(z.object({ orderId: z.number(), content: z.string().min(1).max(1000), senderType: z.enum(["customer", "driver"]), agentId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Fetch the order to verify access permissions
        const order = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
        if (!order || order.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }

        const foundOrder = order[0];

        // CRITICAL: Validate sender identity matches the order
        if (input.senderType === "customer") {
          // Customer must be logged in and own the order
          if (!ctx.user || foundOrder.userId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Only the order owner can send messages as customer." });
          }
        } else if (input.senderType === "driver") {
          // Driver identity MUST match the assigned driver and be specified
          if (!input.agentId || foundOrder.deliveryAgentId !== input.agentId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Only the assigned driver can send messages for this order." });
          }
        }

        // Insert message
        await db.insert(deliveryMessages).values({
          orderId: input.orderId, senderType: input.senderType, content: input.content
        });

        // --- Push Notification Logic ---
        if (input.senderType === 'driver' && process.env.VAPID_PUBLIC_KEY) {
          try {
            if (foundOrder.userId && foundOrder.deliveryAgentId) {
              const [customer] = await db.select({ pushSubscription: users.pushSubscription }).from(users).where(eq(users.id, foundOrder.userId)).limit(1);
              const [driver] = await db.select({ name: drivers.name }).from(drivers).where(eq(drivers.id, foundOrder.deliveryAgentId)).limit(1);

              if (customer?.pushSubscription && driver?.name) {
                // Validate subscription structure
                const sub = customer.pushSubscription as any;
                if (!sub.endpoint || !sub.keys?.auth || !sub.keys?.p256dh) {
                  throw new Error(`Invalid customer subscription structure: missing required fields`);
                }
                
                console.log(`📤 Sending driver message notification to customer for order #${input.orderId}...`);
                await webpush.sendNotification(
                  sub,
                  JSON.stringify({
                    title: `Message from your driver (${driver.name})`,
                    body: input.content,
                    url: `/dashboard/orders/${input.orderId}`
                  })
                );
                console.log(`✅ Driver message notification sent successfully`);
              } else {
                if (!customer?.pushSubscription) {
                  console.warn(`⚠️ Customer ${foundOrder.userId} has no push subscription saved`);
                }
              }
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Failed to send customer push notification:`, errorMsg);
            console.error("Full error details:", error);
          }
        }
        return { success: true };
      }),

    // ─── Real-Time Driver Location Tracking ───
    updateDriverLocation: publicProcedure
      .input(z.object({ 
        agentId: z.number(), 
        orderId: z.number(),
        lat: z.number(),
        lng: z.number()
      }))
      .mutation(async ({ input }) => {
        // Store driver location in cache (expires in 10 minutes)
        // Updated every 5 seconds from driver, so 10 min TTL ensures data persists through polling
        const cacheKey = `driver_location_${input.orderId}_${input.agentId}`;
        await cacheSet(cacheKey, { 
          lat: input.lat, 
          lng: input.lng,
          timestamp: Date.now()
        }, 600); // 10 minutes TTL
        
        console.log(`✓ Driver location updated: Order #${input.orderId}, Agent #${input.agentId}, Lat: ${input.lat}, Lng: ${input.lng}`);
        return { success: true };
      }),

    getDriverLocation: publicProcedure
      .input(z.object({ orderId: z.number(), agentId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Fetch order to verify authorization
        const order = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
        if (!order || order.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }

        const foundOrder = order[0];

        // Get driver location from cache
        if (foundOrder.deliveryAgentId) {
          const cacheKey = `driver_location_${input.orderId}_${foundOrder.deliveryAgentId}`;
          const location = await cacheGet<{ lat: number; lng: number; timestamp?: number }>(cacheKey);
          
          if (location) {
            console.log(`✓ Driver location found for Order #${input.orderId}: ${location.lat}, ${location.lng}`);
            return { 
              driverLocation: { lat: location.lat, lng: location.lng },
              agentId: foundOrder.deliveryAgentId,
              agentName: (await db.select({ name: drivers.name }).from(drivers).where(eq(drivers.id, foundOrder.deliveryAgentId)).limit(1))?.[0]?.name,
              cached: true
            };
          } else {
            console.log(`⚠️ No driver location cached yet for Order #${input.orderId}`);
          }
        }

        return { driverLocation: null, agentId: foundOrder.deliveryAgentId, cached: false };
      }),

    getUnreadDeliveryMessagesCount: publicProcedure
      .input(z.object({ orderId: z.number().optional(), agentId: z.number().optional(), userType: z.enum(["customer", "driver"]) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return 0;

        if (input.userType === "driver" && input.agentId) {
          const activeOrders = await db.select({ id: orders.id }).from(orders).where(
            and(eq(orders.deliveryAgentId, input.agentId), eq(orders.status, "out_for_delivery"))
          );
          const orderIds = activeOrders.map(o => o.id);
          if (orderIds.length === 0) return 0;

          const result = await db.select({ count: count() }).from(deliveryMessages).where(
            and(
              inArray(deliveryMessages.orderId, orderIds),
              eq(deliveryMessages.senderType, "customer"),
              eq(deliveryMessages.isRead, false)
            )
          );
          return result[0]?.count || 0;
        }

        if (input.userType === "customer" && input.orderId) {
          const result = await db.select({ count: count() }).from(deliveryMessages).where(
            and(
              eq(deliveryMessages.orderId, input.orderId),
              eq(deliveryMessages.senderType, "driver"),
              eq(deliveryMessages.isRead, false)
            )
          );
          return result[0]?.count || 0;
        }

        return 0;
      }),

    markDeliveryMessagesAsRead: publicProcedure
      .input(z.object({ orderId: z.number(), userType: z.enum(["customer", "driver"]) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };

        const senderTypeToMark = input.userType === "driver" ? "customer" : "driver";
        
        await db.update(deliveryMessages)
          .set({ isRead: true })
          .where(
            and(
              eq(deliveryMessages.orderId, input.orderId),
              eq(deliveryMessages.senderType, senderTypeToMark),
              eq(deliveryMessages.isRead, false)
            )
          );
        return { success: true };
      }),
  }),

  // ─── Analytics ──────────────────────────────────────────────────────────────
  analytics: router({
    aiConversationStats: managerProcedure
      .input(z.object({ daysBack: z.number().default(7) }))
      .query(async ({ input }) => {
        const timeRange = `${input.daysBack}d`;
        const baseStats = await getAdminStats(timeRange);
        if (!baseStats) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to load stats" });
        
        // Calculate AI-attributed revenue overlay
        const aiRevenueData = (baseStats.revenueData || []).map((day: any) => ({
          date: day.date, aiRevenue: day.aiRevenue || 0, organicRevenue: day.organicRevenue || 0, total: day.revenue || 0
        }));
        const totalAIRevenue = aiRevenueData.reduce((sum, d) => sum + d.aiRevenue, 0);
        
        return { ...baseStats, aiRevenueData, totalAIRevenue };
      }),

    demandPrediction: managerProcedure
      .input(z.object({ daysBack: z.number().default(7) }))
      .query(async ({ input }) => {
        const predictions = await getDemandPrediction(input.daysBack);
        return predictions || [];
      }),

    pricingSuggestions: managerProcedure.query(async () => {
      const suggestions = await getPricingSuggestions();
      return suggestions || [];
    }),

    customerSegments: managerProcedure.query(async () => {
      const segments = await getUserSegments();
      if (!segments) return { budgetBuyers: 0, premiumBuyers: 0, frequentShoppers: 0 };
      return {
        budgetBuyers: segments.budget?.length || 0,
        premiumBuyers: segments.premium?.length || 0,
        frequentShoppers: segments.frequent?.length || 0,
      };
    }),

    productViews: managerProcedure
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

  // ─── Appeals & Dismissals ──────────────────────────────────────────────────
  appeals: router({
    submit: publicProcedure
      .input(z.object({ token: z.string(), appealText: z.string().min(1) }))
      .mutation(async ({ input }) => {
        let payload;
        try {
          const verified = await jwtVerify(input.token, JWT_SECRET);
          payload = verified.payload;
        } catch (e) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Appeal link has expired or is invalid. The 3-day appeal window may have closed." });
        }
        
        if (payload.purpose !== "appeal" || !payload.type || !payload.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid token" });
        }
        
        const settingKey = `dismissal_${payload.type}_${payload.id}`;
        const dismissal = await getSetting(settingKey);
        
        if (!dismissal) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Dismissal record not found. It may have been permanently deleted or already resolved." });
        }
        
        if (dismissal.appealStatus !== 'none') {
          throw new TRPCError({ code: "BAD_REQUEST", message: "An appeal has already been submitted or reviewed for this dismissal." });
        }
        
        dismissal.appealStatus = 'pending';
        dismissal.appealText = input.appealText;
        
        await upsertSetting(settingKey, dismissal);
        
        return { success: true };
      }),
      
    getPendingAppeals: adminProcedure.query(async () => {
        const db = await getDb();
        if (!db) return [];
        const results = await db.select().from(settings).where(like(settings.key, 'dismissal_%'));
        return results.map(r => r.value).filter((v: any) => v && v.appealStatus === 'pending');
    }),
    
    review: adminProcedure
      .input(z.object({ type: z.enum(["manager", "driver"]), id: z.number(), accept: z.boolean(), adminNotes: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
         const db = await getDb();
         if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
         
         const settingKey = `dismissal_${input.type}_${input.id}`;
         const dismissal = await getSetting(settingKey);
         
         if (!dismissal || dismissal.appealStatus !== 'pending') {
            throw new TRPCError({ code: "BAD_REQUEST", message: "No pending appeal found." });
         }
         
         if (input.accept) {
            if (input.type === 'manager') await db.update(users).set({ suspended: false }).where(eq(users.id, input.id));
            else await db.update(drivers).set({ status: 'active' }).where(eq(drivers.id, input.id));
            await db.delete(settings).where(eq(settings.key, settingKey));
         } else {
            if (input.type === 'manager') await db.delete(users).where(eq(users.id, input.id));
            else await db.delete(drivers).where(eq(drivers.id, input.id));
            await db.delete(settings).where(eq(settings.key, settingKey));
         }
         
         if (dismissal.email) {
            try {
                const emailSettings = await getSetting("email");
                const generalSettings = await getSetting("general");
                const appearanceSettings = await getSetting("appearance");
                
                if (emailSettings?.smtpHost && emailSettings?.smtpUser) {
                  const transporter = nodemailer.createTransport({ host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort), secure: Number(emailSettings.smtpPort) === 465, auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword } });
                  const emailHtml = getAppealResultEmailHtml({ storeName: generalSettings?.storeName || "Store", logoUrl: appearanceSettings?.logoUrl, primaryColor: emailSettings?.emailButtonColor || appearanceSettings?.primaryColor || "#3b82f6", contactEmail: generalSettings?.contactEmail || "support@example.com", name: dismissal.name, role: input.type === 'manager' ? "Manager" : "Driver", accepted: input.accept, adminNotes: input.adminNotes, emailBackgroundColor: emailSettings?.emailBackgroundColor, theme: emailSettings?.theme });
                  await transporter.sendMail({ from: `"${generalSettings?.storeName || 'Store Admin'}" <${emailSettings.smtpUser}>`, to: dismissal.email, subject: `Appeal Review Result`, html: emailHtml });
                }
            } catch (err) { console.error(err); }
         }
         
         return { success: true };
      })
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
    // Bound the lookback to 48 hours to prevent mass email spam for very old carts
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const abandonedOrders = await db.select().from(orders).where(
      and(
        eq(orders.paymentStatus, "pending"),
        eq(orders.status, "pending"),
        eq(orders.abandonedEmailSent, false),
        lt(orders.createdAt, twentyFourHoursAgo),
        gt(orders.createdAt, fortyEightHoursAgo)
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
        storeUrl: fullHost,
        productImageWidth: emailSettings.productImageWidth,
        emailBackgroundColor: emailSettings.emailBackgroundColor,
        theme: emailSettings.theme,
        customTemplate: emailSettings.customTemplates?.abandonedCart,
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

// ─── AI Predictive Purchasing (Auto-Restock) ──────────────────────────────────
export async function processAutoRestock() {
  try {
    const db = await getDb();
    if (!db) return;

    const emailSettings = await getSetting("email");
    const generalSettings = await getSetting("general");
    
    if (!emailSettings?.smtpHost || !emailSettings?.smtpUser || !generalSettings?.contactEmail) return;

    // Fetch inventory settings for dynamic threshold
    const inventorySettings = await getSetting("inventory");
    const lowStockThreshold = inventorySettings?.lowStockThreshold !== undefined ? parseInt(inventorySettings.lowStockThreshold, 10) : 5;

    // Find active products with low stock
    const lowStockProducts = await db.select().from(products).where(and(eq(products.active, true), lte(products.stock, lowStockThreshold)));
    
    if (lowStockProducts.length === 0) return;

    // Get AI Demand Predictions (Looking at last 14 days of sales)
    const predictions = await getDemandPrediction(14);
    
    const itemsToOrder = [];
    
    for (const product of lowStockProducts) {
      const prediction = predictions.find(p => p.productId === product.id);
      
      let suggestedOrderQty = 10; // Default restock baseline
      let recentSales = 0;
      
      if (prediction) {
         recentSales = prediction.salesCount;
         // AI suggests ordering enough to cover expected 30-day velocity
         suggestedOrderQty = Math.max(10, prediction.predictedSales * 2); 
      }
      
      itemsToOrder.push({ ...product, suggestedOrderQty, recentSales });
    }

    if (itemsToOrder.length === 0) return;

    const appearance = await getSetting("appearance");
    const storeName = generalSettings?.storeName || "Store";
    const host = process.env.PUBLIC_URL || "http://localhost:3000";
    const fullHost = host.startsWith('http') ? host : `https://${host}`;

    const transporter = nodemailer.createTransport({
      host: emailSettings.smtpHost, 
      port: Number(emailSettings.smtpPort),
      secure: Number(emailSettings.smtpPort) === 465,
      auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    // Group items by warehouseId
    const itemsByWarehouse = new Map<number | null, typeof itemsToOrder>();
    for (const item of itemsToOrder) {
      const wId = item.warehouseId || null;
      if (!itemsByWarehouse.has(wId)) itemsByWarehouse.set(wId, []);
      itemsByWarehouse.get(wId)!.push(item);
    }

    // Send a targeted email per warehouse group
    for (const [warehouseId, items] of itemsByWarehouse.entries()) {
      let managerConditions = [eq(users.role, "manager")];
      if (warehouseId !== null) {
        managerConditions.push(eq(users.warehouseId, warehouseId));
      } else {
        managerConditions.push(sql`${users.warehouseId} IS NULL`);
      }

      const managers = await db.select({ email: users.email }).from(users).where(and(...managerConditions));
      const recipients = new Set<string>();
      
      managers.forEach(m => {
        if (m.email) recipients.add(m.email);
      });

      if (recipients.size === 0) continue;

      const poHtml = getAutoRestockEmailHtml({
        storeName, logoUrl: appearance?.logoUrl, primaryColor: emailSettings?.emailButtonColor || appearance?.primaryColor || "#3b82f6",
        contactEmail: generalSettings?.contactEmail || "support@example.com", storePhone: generalSettings?.phone || "",
        itemsHtml: items.map(item => `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 16px 12px; width: 80px;">
              ${item.images && Array.isArray(item.images) && item.images[0] ? `<img src="${item.images[0]}" alt="${item.name.replace(/"/g, '&quot;')}" style="width: 64px; height: 64px; object-fit: cover; border-radius: 8px; border: 1px solid #f3f4f6; display: block;" />` : `<div style="width: 64px; height: 64px; background-color: #f3f4f6; border-radius: 8px; text-align: center; line-height: 64px; color: #9ca3af; font-size: 10px;">No Image</div>`}
            </td>
            <td style="padding: 16px 12px;">
              <div style="color: #111827; font-weight: 600; font-size: 15px; margin-bottom: 4px;">${item.name}</div>
              <div style="color: #6b7280; font-size: 13px;">SKU: ${item.sku || 'N/A'}</div>
            </td>
            <td style="padding: 16px 12px; text-align: center; color: #ef4444; font-weight: 700; font-size: 15px;">${item.stock}</td>
            <td style="padding: 16px 12px; text-align: center; color: #374151; font-weight: 500; font-size: 15px;">${item.recentSales}</td>
            <td style="padding: 16px 12px; text-align: center;">
              <span style="background-color: #d1fae5; color: #065f46; padding: 6px 12px; border-radius: 9999px; font-weight: 700; font-size: 14px;">${item.suggestedOrderQty}</span>
            </td>
          </tr>
        `).join(''),
        emailBackgroundColor: emailSettings?.emailBackgroundColor,
        theme: emailSettings?.theme,
        customTemplate: emailSettings?.customTemplates?.autoRestock,
        dashboardLink: `${fullHost}/admin/products`
      });

      await transporter.sendMail({
        from: `"${storeName}" <${emailSettings.smtpUser}>`,
        to: Array.from(recipients).join(', '),
        subject: `📦 Restock Alert: ${items.length} products need reordering${warehouseId ? ` (Warehouse ${warehouseId})` : ''}`,
        html: poHtml
      });

      console.log(`[AI] Auto-restock recommendation sent to ${Array.from(recipients).join(', ')} for ${items.length} items (Warehouse ${warehouseId || 'Global'}).`);
    }
  } catch (err) { 
    console.error("Error processing AI auto-restock", err); 
  }
}

// ─── Dismissal Processing (Cron) ──────────────────────────────────────────────
export async function processPendingDismissals() {
  try {
    const db = await getDb();
    if (!db) return;
    
    const dismissalSettings = await db.select().from(settings).where(like(settings.key, 'dismissal_%'));
    const now = Date.now();
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
    
    for (const s of dismissalSettings) {
      const data = s.value as any;
      if (data && data.firedAt && (now - data.firedAt > threeDaysInMs) && data.appealStatus !== 'pending') {
        if (data.type === 'manager') await db.delete(users).where(eq(users.id, data.id));
        else if (data.type === 'driver') await db.delete(drivers).where(eq(drivers.id, data.id));
        await db.delete(settings).where(eq(settings.key, s.key));
        console.log(`[Cron] Permanently deleted ${data.type} ${data.id} after 3-day dismissal period.`);
      }
    }
  } catch (err) {
    console.error("Error processing pending dismissals:", err);
  }
}

// ─── Automated Cron Jobs ──────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    console.log("[CRON] Executing daily background tasks...");
    processAbandonedCheckouts().catch(err => console.error("[CRON] Abandoned checkouts error:", err));
    processAutoRestock().catch(err => console.error("[CRON] Auto-restock error:", err));
    processPendingDismissals().catch(err => console.error("[CRON] Pending dismissals error:", err));
  }, 24 * 60 * 60 * 1000); // 24 hours
}