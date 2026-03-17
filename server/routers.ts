import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { serialize } from "cookie";
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
} from "./db";
import { eq, and, lt } from "drizzle-orm";
import { users, categories as categoriesSchema, banners as bannersSchema, orders, payments } from "../drizzle/schema";
import nodemailer from "nodemailer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import Stripe from "stripe";

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

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "default_jwt_secret_for_development_only");

async function getPaypalAccessToken(clientId: string, secret: string) {
  const PAYPAL_API_BASE = process.env.PAYPAL_ENV === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || "PayPal Auth failed");
  return data.access_token;
}

async function getMpesaAccessToken(consumerKey: string, consumerSecret: string, env: string = "sandbox") {
  const baseUrl = env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.errorMessage || "M-Pesa Auth failed");
  return data.access_token;
}

function getMpesaTimestamp() {
  const pad = (n: number) => (n < 10 ? '0' + n : n.toString());
  const date = new Date();
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function formatMpesaPhone(phone: string) {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "254" + cleaned.slice(1);
  else if (cleaned.startsWith("+254")) cleaned = cleaned.slice(1);
  else if (cleaned.length === 9) cleaned = "254" + cleaned;
  return cleaned;
}

export const appRouter = router({
  system: systemRouter,

  // ─── Public Store Stats ──────────────────────────────────────────────────────
  store: router({
    stats: publicProcedure.query(() => getStoreStats()),
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
        // Only allow public-facing settings to be queried unauthenticated
        const allowed = ["general", "appearance", "social", "payment_methods", "brands"];
        const result: Record<string, any> = {};
        for (const k of input.keys) {
          if (allowed.includes(k)) {
            result[k] = await getSetting(k);
          }
        }
        return result;
      }),
  }),

  content: router({
    banners: publicProcedure.query(() => getBanners({ activeOnly: true })),
    promotions: publicProcedure.query(() => getPromotions({ activeOnly: true })),
    announcements: publicProcedure.query(() => getAnnouncements({ activeOnly: true })),
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
        (ctx.res as any).setHeader("Set-Cookie", serialize(COOKIE_NAME, "", { ...cookieOpts, maxAge: -1 }));
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
          const primaryColor = appearance?.primaryColor || "#3b82f6";
          const storePhone = general?.phone || "";
          const contactEmail = general?.contactEmail || "support@example.com";
          
          const logoHtml = logoUrl 
            ? `<img src="${logoUrl}" alt="${storeName}" style="max-height: 50px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />` 
            : `<h2 style="margin-top: 0; color: #111; text-align: center;">${storeName}</h2>`;

          const emailHtml = `
            <div style="font-family: system-ui, -apple-system, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
                ${logoHtml}
                <h1 style="font-size: 24px; margin: 0; color: ${primaryColor};">Your Verification Code</h1>
              </div>
              <p style="font-size: 16px;">Hi <strong>${input.name}</strong>,</p>
              <p style="color: #4b5563;">Welcome to ${storeName}! Please enter the following 6-digit code to activate your account. This code will expire in 24 hours.</p>
              <div style="text-align: center; margin: 30px 0;">
                <span style="display: inline-block; padding: 16px 32px; background: #f3f4f6; color: #111; border-radius: 8px; font-weight: bold; font-size: 32px; letter-spacing: 8px;">${otp}</span>
              </div>
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                Need help? Contact us at <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none;">${contactEmail}</a>${storePhone ? ` or call ${storePhone}` : ''}.
              </p>
            </div>
          `;

          if (emailSettings?.smtpHost && emailSettings.smtpUser) {
             const transporter = nodemailer.createTransport({
               host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
               auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword }
             });
             await transporter.sendMail({
               from: `"${storeName}" <${emailSettings.smtpUser}>`, to: input.email, subject: `Verify your email - ${storeName}`, html: emailHtml
             });
          } else {
             console.log("No SMTP configured. Verification Code for", input.email, "is", otp);
          }
        } catch (err) { console.error("Failed to send verification email", err); }

        return { success: true, token, email: input.email };
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
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
          (ctx.res as any).setHeader("Set-Cookie", serialize(COOKIE_NAME, token, { ...cookieOpts, maxAge: 604800 }));
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
          const primaryColor = appearance?.primaryColor || "#3b82f6";
          const storePhone = general?.phone || "";
          const contactEmail = general?.contactEmail || "support@nexustech.com";
          
          const logoHtml = logoUrl 
            ? `<img src="${logoUrl}" alt="${storeName}" style="max-height: 50px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />` 
            : `<h2 style="margin-top: 0; color: #111; text-align: center;">${storeName}</h2>`;

          const emailHtml = `
            <div style="font-family: system-ui, -apple-system, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
                ${logoHtml}
                <h1 style="font-size: 24px; margin: 0; color: ${primaryColor};">Password Reset Code</h1>
              </div>
              <p style="font-size: 16px;">Hi <strong>${user.name || 'there'}</strong>,</p>
              <p style="color: #4b5563;">We received a request to reset your password for your ${storeName} account. Please enter the following 6-digit code to choose a new password. This code will expire in 15 minutes.</p>
              <div style="text-align: center; margin: 30px 0;">
                <span style="display: inline-block; padding: 16px 32px; background: #f3f4f6; color: #111; border-radius: 8px; font-weight: bold; font-size: 32px; letter-spacing: 8px;">${otp}</span>
              </div>
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                If you didn't make this request, you can safely ignore this email.<br/><br/>
                Need help? Contact us at <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none;">${contactEmail}</a>${storePhone ? ` or call ${storePhone}` : ''}.
              </p>
            </div>
          `;

          if (emailSettings?.smtpHost && emailSettings.smtpUser) {
             const transporter = nodemailer.createTransport({
               host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
               auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword }
             });
             await transporter.sendMail({
               from: `"${storeName}" <${emailSettings.smtpUser}>`, to: user.email, subject: `Password Reset Request - ${storeName}`,
               html: emailHtml
             });
          }
          else {
             console.log("No SMTP configured. Reset Code for", user.email, "is", otp);
          }
        } catch (err) { console.error("Failed to send reset email", err); }
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
          const primaryColor = appearance?.primaryColor || "#3b82f6";
          const storePhone = general?.phone || "";
          const contactEmail = general?.contactEmail || "support@example.com";
          
          const logoHtml = logoUrl 
            ? `<img src="${logoUrl}" alt="${storeName}" style="max-height: 50px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />` 
            : `<h2 style="margin-top: 0; color: #111; text-align: center;">${storeName}</h2>`;

          const emailHtml = `
            <div style="font-family: system-ui, -apple-system, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
                ${logoHtml}
                <h1 style="font-size: 24px; margin: 0; color: ${primaryColor};">Your Verification Code</h1>
              </div>
              <p style="font-size: 16px;">Hi <strong>${user.name}</strong>,</p>
              <p style="color: #4b5563;">You requested a new verification code for ${storeName}. Please enter the following 6-digit code to activate your account. This code will expire in 24 hours.</p>
              <div style="text-align: center; margin: 30px 0;">
                <span style="display: inline-block; padding: 16px 32px; background: #f3f4f6; color: #111; border-radius: 8px; font-weight: bold; font-size: 32px; letter-spacing: 8px;">${otp}</span>
              </div>
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                Need help? Contact us at <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none;">${contactEmail}</a>${storePhone ? ` or call ${storePhone}` : ''}.
              </p>
            </div>
          `;

          if (emailSettings?.smtpHost && emailSettings.smtpUser) {
             const transporter = nodemailer.createTransport({
               host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
               auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword }
             });
             await transporter.sendMail({
               from: `"${storeName}" <${emailSettings.smtpUser}>`, to: input.email, subject: `Verify your email - ${storeName}`, html: emailHtml
             });
          } else {
             console.log("No SMTP configured. Verification Code for", input.email, "is", otp);
          }
        } catch (err) { console.error("Failed to send verification email", err); }

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
    list: publicProcedure.query(() => getCategories()),
    bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(({ input }) =>
      getCategoryBySlug(input.slug)
    ),
  }),

  // ─── Products ──────────────────────────────────────────────────────────────
  products: router({
    list: publicProcedure
      .input(
        z.object({
          categoryId: z.union([z.number(), z.array(z.number())]).optional(),
          search: z.string().optional(),
          tag: z.string().optional(),
          featured: z.boolean().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        }).optional()
      )
      .query(({ input }) => getProducts(input ?? {})),

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
        return { success: true };
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
          phone: z.string().min(1),
          addressLine: z.string().min(1),
          city: z.string().min(1),
          postalCode: z.string().optional(),
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

  // ─── Checkout ──────────────────────────────────────────────────────────────
  checkout: router({
    placeOrder: protectedProcedure
      .input(
        z.object({
          shippingFullName: z.string().min(1),
          shippingPhone: z.string().min(1),
          shippingAddress: z.string().min(1),
          shippingCity: z.string().min(1),
          shippingPostalCode: z.string().optional(),
          shippingCountry: z.string().min(1),
          paymentMethod: z.enum(["mpesa", "paypal", "stripe", "card"]),
          saveAddress: z.boolean().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const cartData = await getCartItems(ctx.user.id);
        if (cartData.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Cart is empty" });

        const shippingSettings = await getSetting("shipping");
        const freeThreshold = shippingSettings?.freeShippingThreshold ? parseFloat(shippingSettings.freeShippingThreshold) : 500;
        const standardFee = shippingSettings?.standardFee ? parseFloat(shippingSettings.standardFee) : 15;

        const subtotal = cartData.reduce(
          (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
          0
        );
        const shippingCost = subtotal >= freeThreshold ? 0 : standardFee;
        const total = subtotal + shippingCost;

        const orderNumber = `ORD-${Date.now()}-${nanoid(6).toUpperCase()}`;
        const orderId = await createOrder({
          orderNumber,
          userId: ctx.user.id,
          shippingFullName: input.shippingFullName,
          shippingPhone: input.shippingPhone,
          shippingAddress: input.shippingAddress,
          shippingCity: input.shippingCity,
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
        if (input.saveAddress) {
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
        try {
          const emailSettings = await getSetting("email");
          // Only generate if the setting is enabled by the Admin
          if (emailSettings?.orderConfirmation) {
            const appearance = await getSetting("appearance");
            const general = await getSetting("general");
            
            const storeName = general?.storeName || "Store";
            const storeCurrency = general?.currency || "USD";
            const logoUrl = appearance?.logoUrl;
            const primaryColor = appearance?.primaryColor || "#3b82f6";
            const storePhone = general?.phone || "";
            const contactEmail = general?.contactEmail || "support@example.com";
            const formatEmailPrice = (p: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: storeCurrency }).format(typeof p === "string" ? parseFloat(p) : p);

            const logoHtml = logoUrl 
              ? `<img src="${logoUrl}" alt="${storeName}" style="max-height: 40px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;" />` 
              : `<h2 style="margin: 0 0 12px 0; color: #111; text-align: center; font-size: 20px;">${storeName}</h2>`;

            const itemsHtml = cartData.map(item => `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; color: #374151;">${item.product.name} <span style="color: #6b7280;">(x${item.quantity})</span></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-size: 13px; color: #374151;">${formatEmailPrice(parseFloat(item.product.price) * item.quantity)}</td>
              </tr>
            `).join('');

            const emailHtml = `
              <div style="font-family: system-ui, -apple-system, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px; margin-bottom: 15px;">
                  ${logoHtml}
                  <h1 style="font-size: 20px; margin: 0; color: #10b981;">Order Confirmed!</h1>
                </div>
                <p style="font-size: 14px; margin-top: 0;">Hi <strong>${input.shippingFullName}</strong>,</p>
                <p style="font-size: 14px; color: #4b5563; margin-bottom: 20px;">Thank you for your order. We are getting your items ready for shipment.</p>
                
                <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0;">
                  <h3 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Order Summary (#${orderNumber})</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    ${itemsHtml}
                    <tr>
                      <td style="padding: 8px 0; font-weight: 600; padding-top: 12px; font-size: 13px;">Subtotal</td>
                      <td style="padding: 8px 0; text-align: right; font-weight: 600; padding-top: 12px; font-size: 13px;">${formatEmailPrice(subtotal)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: 600; font-size: 13px;">Shipping</td>
                      <td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 13px;">${formatEmailPrice(shippingCost)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0 0 0; font-size: 16px; font-weight: 700; border-top: 2px solid #e5e7eb;">Total</td>
                      <td style="padding: 12px 0 0 0; font-size: 16px; font-weight: 700; text-align: right; border-top: 2px solid #e5e7eb;">${formatEmailPrice(total)}</td>
                    </tr>
                  </table>
                </div>
                
                <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
                  Track your order status by logging into your dashboard.<br/>
                  Need help? Contact us at <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none;">${contactEmail}</a>${storePhone ? ` or call ${storePhone}` : ''}.
                </p>
              </div>
            `;
            
            if (emailSettings?.smtpHost && emailSettings.smtpUser) {
              const transporter = nodemailer.createTransport({ host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort), auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword }});
              await transporter.sendMail({ from: `"${storeName}" <${emailSettings.smtpUser}>`, to: ctx.user.email || input.shippingFullName, subject: `Order Confirmation #${orderNumber}`, html: emailHtml });
              console.log(`[Email] Order confirmation sent to ${ctx.user.email || input.shippingFullName}`);
            } else {
              console.log("\n=== SIMULATED OUTBOUND EMAIL ===");
              console.log("To:", ctx.user.email || input.shippingFullName);
              console.log("Subject: Your Order #" + orderNumber + " is confirmed!");
              console.log("==================================\n");
            }
          }
        } catch (error) {
          console.error("Error generating confirmation email:", error);
        }

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

        let callbackUrl = "https://sandbox.safaricom.co.ke/dummy_callback"; // Mpesa requires a valid URL here even though we poll for results
        const host = ctx.req.headers.host;
        if (host && !host.includes("localhost")) callbackUrl = `https://${host}/api/mpesa/callback`;

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

        return {
          success: true,
          checkoutRequestId: data.CheckoutRequestID,
          message: "STK Push sent to your phone. Please enter your M-Pesa PIN to complete payment.",
        };
      }),

    verifyMpesa: protectedProcedure
      .input(z.object({ orderId: z.number(), checkoutRequestId: z.string() }))
      .mutation(async ({ input }) => {
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
      .mutation(async ({ input }) => {
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
      .mutation(async ({ input }) => {
        try {
          const paymentSettings = await getSetting("payment");
          if (!paymentSettings?.stripeSecret) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe is not configured by the administrator." });
          }

          const order = await getOrderById(input.orderId);
          if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

          const generalSettings = await getSetting("general");
          const currency = (generalSettings?.currency || "USD").toLowerCase();

          const stripe = new Stripe(paymentSettings.stripeSecret, { apiVersion: "2024-12-18.acacia" });
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
          });

          if (intent.status === "succeeded") {
            await updatePaymentStatus(input.orderId, "completed", intent.id, { provider: "stripe" });
            await updateOrderStatus(input.orderId, "payment_confirmed", "Card payment confirmed via Stripe", { paymentStatus: "paid", paymentReference: intent.id });
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
          paymentMethod: z.enum(["mpesa", "paypal", "stripe", "card"]),
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
        return { order, items, history, payment };
      }),

    byNumber: protectedProcedure
      .input(z.object({ orderNumber: z.string() }))
      .query(async ({ ctx, input }) => {
        const order = await getOrderByNumber(input.orderNumber);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const items = await getOrderItems(order.id);
        const history = await getOrderStatusHistory(order.id);
        const payment = await getPaymentByOrder(order.id);
        return { order, items, history, payment };
      }),
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────────
  admin: router({
    stats: adminProcedure.query(() => getAdminStats()),

    globalSearch: adminProcedure
      .input(z.object({ query: z.string() }))
      .query(({ input }) => {
        if (!input.query) {
          return { products: [], orders: [], customers: [], categories: [] };
        }
        return adminGlobalSearch(input.query);
      }),

    orders: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional())
      .query(({ input }) => getAllOrders(input ?? {})),

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
                if (db) {
                  const [customer] = await db.select().from(users).where(eq(users.id, order.userId)).limit(1);
                  customerEmail = customer?.email || "";
                }

                if (customerEmail) {
                  const appearance = await getSetting("appearance");
                  const general = await getSetting("general");
                  
                  const storeName = general?.storeName || "Store";
                  const storePhone = general?.phone || "";
                  const logoUrl = appearance?.logoUrl;
                  const contactEmail = general?.contactEmail || "support@example.com";
                  
                  const logoHtml = logoUrl 
                    ? `<img src="${logoUrl}" alt="${storeName}" style="max-height: 40px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;" />` 
                    : `<h2 style="margin: 0 0 12px 0; color: #111; text-align: center; font-size: 20px;">${storeName}</h2>`;

                  const trackingHtml = input.trackingNumber 
                    ? `<div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e7eb;">
                         <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Tracking Number</p>
                         <a href="https://parcelsapp.com/en/tracking/${encodeURIComponent(input.trackingNumber)}" target="_blank" style="font-size: 18px; font-family: monospace; font-weight: bold; color: #8b5cf6; text-decoration: none;">
                           ${input.trackingNumber}
                         </a>
                       </div>` 
                    : ``;

                  const host = ctx.req.headers.host || "localhost:3000";
                  const protocol = host.includes("localhost") ? "http" : "https";
                  const trackLink = `${protocol}://${host}/dashboard/orders/${order.id}`;

                  const emailHtml = `
                    <div style="font-family: system-ui, -apple-system, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                      <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
                        ${logoHtml}
                        <h1 style="font-size: 24px; margin: 0; color: #8b5cf6;">Your Order Has Shipped!</h1>
                      </div>
                      <p style="font-size: 16px;">Hi <strong>${order.shippingFullName}</strong>,</p>
                      <p style="color: #4b5563;">Great news! Your order <strong>#${order.orderNumber}</strong> has been shipped and is on its way to you.</p>
                      ${trackingHtml}
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${trackLink}" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Track Your Order</a>
                      </div>
                      <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                        Need help? Contact us at <a href="mailto:${contactEmail}" style="color: #3b82f6; text-decoration: none;">${contactEmail}</a>${storePhone ? ` or call ${storePhone}` : ''}.
                      </p>
                    </div>
                  `;

                  if (emailSettings?.smtpHost && emailSettings.smtpUser) {
                    const transporter = nodemailer.createTransport({
                      host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
                      auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword }
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

    customers: adminProcedure.query(() => getAllUsers()),

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
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional())
      .query(({ input }) => getProducts({ limit: input?.limit ?? 100, offset: input?.offset ?? 0 })),

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
          description: z.string().optional(),
          imageUrl: z.string().optional(),
          featured: z.boolean().optional(),
          active: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (db && input.id) {
          await db.update(categoriesSchema).set({ parentId: input.parentId ?? null, name: input.name, slug: input.slug, description: input.description, imageUrl: input.imageUrl, featured: input.featured ?? false, active: input.active ?? true }).where(eq(categoriesSchema.id, input.id));
        } else {
          await upsertCategory(input);
        }
        return { success: true };
      }),

    deleteCategory: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (db) await db.delete(categoriesSchema).where(eq(categoriesSchema.id, input.id));
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
        return { success: true };
      }),

    // --- Content Management ---
    banners: adminProcedure.query(() => getBanners()),
    upsertBanner: adminProcedure
      .input(z.object({ id: z.number().optional(), title: z.string().min(1), image: z.string().min(1), active: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        await upsertBanner(input);
        return { success: true };
      }),
    deleteBanner: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBanner(input.id);
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
        return { success: true };
      }),

    promotions: adminProcedure.query(() => getPromotions()),
    upsertPromotion: adminProcedure
      .input(z.object({ id: z.number().optional(), title: z.string().min(1), description: z.string().min(1), active: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        await upsertPromotion(input);
        return { success: true };
      }),
    deletePromotion: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deletePromotion(input.id);
        return { success: true };
      }),

    announcements: adminProcedure.query(() => getAnnouncements()),
    upsertAnnouncement: adminProcedure
      .input(z.object({ id: z.number().optional(), title: z.string().min(1), content: z.string().min(1), date: z.string().or(z.date()), image: z.string().optional(), linkUrl: z.string().optional(), active: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const date = new Date(input.date);
        await upsertAnnouncement({ ...input, date });
        return { success: true };
      }),
    deleteAnnouncement: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAnnouncement(input.id);
        return { success: true };
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
    const primaryColor = appearance?.primaryColor || "#3b82f6";
    const storePhone = general?.phone || "";
    const contactEmail = general?.contactEmail || "support@example.com";
    
    const formatEmailPrice = (p: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: storeCurrency }).format(typeof p === "string" ? parseFloat(p) : p);
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${storeName}" style="max-height: 40px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;" />` : `<h2 style="margin: 0 0 12px 0; color: #111; text-align: center; font-size: 20px;">${storeName}</h2>`;
    const transporter = nodemailer.createTransport({
      host: emailSettings.smtpHost, port: Number(emailSettings.smtpPort),
      auth: { user: emailSettings.smtpUser, pass: emailSettings.smtpPassword }
    });

    for (const order of abandonedOrders) {
      const [customer] = await db.select().from(users).where(eq(users.id, order.userId)).limit(1);
      if (!customer || !customer.email) continue;

      const host = process.env.PUBLIC_URL || "http://localhost:3000";
      const orderLink = `${host}/order-confirmation/${order.orderNumber}`;

      const emailHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px; margin-bottom: 15px;">${logoHtml}<h1 style="font-size: 20px; margin: 0; color: #f59e0b;">You left something behind!</h1></div>
          <p style="font-size: 14px; margin-top: 0;">Hi <strong>${order.shippingFullName}</strong>,</p>
          <p style="font-size: 14px; color: #4b5563; margin-bottom: 20px;">We noticed you started an order but haven't completed the payment yet. Your items are currently saved, but they might sell out soon!</p>
          <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; text-align: center;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #374151;">Order #${order.orderNumber}</h3>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Pending Amount: <strong>${formatEmailPrice(order.total)}</strong></p>
          </div>
          <div style="text-align: center; margin: 30px 0;"><a href="${orderLink}" style="display: inline-block; padding: 12px 24px; background: ${primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Complete Your Order</a></div>
          <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 15px;">Need help? Contact us at <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none;">${contactEmail}</a>${storePhone ? ` or call ${storePhone}` : ''}.</p>
        </div>
      `;
      await transporter.sendMail({ from: `"${storeName}" <${emailSettings.smtpUser}>`, to: customer.email, subject: `Did you forget something? Complete your order at ${storeName}`, html: emailHtml });
      await db.update(orders).set({ abandonedEmailSent: true }).where(eq(orders.id, order.id));
      console.log(`[Email] Abandoned checkout reminder sent to ${customer.email} for order ${order.orderNumber}`);
    }
  } catch (err) { console.error("Error processing abandoned checkouts", err); }
}
