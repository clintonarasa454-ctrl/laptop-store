import { Express } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { users } from "../../drizzle/schema";
import { getDb, getUserByEmail, getSetting } from "../db";

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

export function registerOAuthRoutes(app: Express) {
  app.use(passport.initialize());

  // Determine callback URL base once at startup
  const getDefaultCallbackBase = (): string => {
    if (process.env.OAUTH_CALLBACK_URL_BASE) {
      return process.env.OAUTH_CALLBACK_URL_BASE;
    }
    // Default to localhost for development
    return "http://localhost:3000";
  };

  const callbackUrlBase = getDefaultCallbackBase();

  // Track the current credentials so we don't recreate the strategies on every request
  let currentGoogleClientId = "";
  let currentGoogleClientSecret = "";
  let currentFacebookClientId = "";
  let currentFacebookClientSecret = "";

  const setupGoogleStrategy = async () => {
    const securitySettings = await getSetting("security");
    const clientId = securitySettings?.googleClientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = securitySettings?.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) return false;

    if (clientId === currentGoogleClientId && clientSecret === currentGoogleClientSecret) {
      return true; // Already configured with these credentials
    }

    const callbackURL = `${callbackUrlBase}/api/auth/google/callback`;
    console.log("📌 Google OAuth Strategy Configuration:");
    console.log(`   Callback URL: ${callbackURL}`);
    console.log(`   Callback URL Base: ${callbackUrlBase}`);
    console.log(`   Client ID: ${clientId.substring(0, 20)}...`);
    console.log(`   ✓ Verify this exact Callback URL exists in Google Console under:`);
    console.log(`     APIs & Services → Credentials → OAuth 2.0 Client IDs → Authorized redirect URIs`);

    passport.use(
      new GoogleStrategy(
        {
          clientID: clientId,
          clientSecret: clientSecret,
          callbackURL: callbackURL,
        },
        async (accessToken, refreshToken, profile, cb) => {
          try {
            const db = await getDb();
            if (!db) return cb(new Error("Database connection failed"));

            const email = profile.emails?.[0]?.value;
            if (!email) return cb(new Error("No email provided by Google"));

            let user = await getUserByEmail(email);

            if (user) {
              if (!user.emailVerified) {
                await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
                user.emailVerified = true;
              }
              return cb(null, user);
            }

            await db.insert(users).values({
              openId: profile.id,
              name: profile.displayName || "Google User",
              email: email,
              loginMethod: "google",
              emailVerified: true,
              role: "user",
              lastSignedIn: new Date(),
            });

            user = await getUserByEmail(email);
            return cb(null, user);
          } catch (error) {
            return cb(error as Error);
          }
        }
      )
    );
    // Update cached credentials so we don't recreate the strategy on every request
    currentGoogleClientId = clientId;
    currentGoogleClientSecret = clientSecret;
    console.log("✅ Google OAuth Strategy created and cached");
    return true;
  };

  const setupFacebookStrategy = async () => {
    const securitySettings = await getSetting("security");
    const clientID = securitySettings?.facebookAppId || process.env.FACEBOOK_APP_ID;
    const clientSecret = securitySettings?.facebookAppSecret || process.env.FACEBOOK_APP_SECRET;

    if (!clientID || !clientSecret) return false;

    if (clientID === currentFacebookClientId && clientSecret === currentFacebookClientSecret) {
      return true; // Already configured with these credentials
    }

    const callbackURL = `${callbackUrlBase}/api/auth/facebook/callback`;

    passport.use(
      new FacebookStrategy(
        {
          clientID,
          clientSecret,
          callbackURL: callbackURL,
          profileFields: ['id', 'displayName', 'emails'],
        },
        async (accessToken, refreshToken, profile, cb) => {
          try {
            const db = await getDb();
            if (!db) return cb(new Error("Database connection failed"));

            const email = profile.emails?.[0]?.value;
            if (!email) return cb(new Error("No email provided by Facebook."));

            let user = await getUserByEmail(email);

            if (user) {
              if (!user.emailVerified) {
                await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
                user.emailVerified = true;
              }
              return cb(null, user);
            }

            await db.insert(users).values({
              openId: profile.id,
              name: profile.displayName || "Facebook User",
              email: email,
              loginMethod: "facebook",
              emailVerified: true,
              role: "user",
              lastSignedIn: new Date(),
            });

            user = await getUserByEmail(email);
            return cb(null, user);
          } catch (error) {
            return cb(error as Error);
          }
        }
      )
    );
    currentFacebookClientId = clientID;
    currentFacebookClientSecret = clientSecret;
    return true;
  };

  // 2. Define the Express Routes
  app.get("/api/auth/google", async (req, res, next) => {
    try {
      console.log("🔵 Google OAuth Init: Checking configuration...");
      const configured = await setupGoogleStrategy();
      if (!configured) {
        console.warn("⚠️ Google OAuth not configured - Missing credentials in environment or database security settings");
        console.warn("   Required: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
        return res.redirect("/auth?error=google_not_configured&details=missing_env_credentials");
      }
      console.log("✅ Google OAuth Strategy ready, redirecting to Google...");
      passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
    } catch (e) {
      console.error("❌ Google Auth Route Error:", e);
      next(e);
    }
  });

  app.get(
    "/api/auth/google/callback",
    async (req, res, next) => {
      try {
        console.log("🔄 Google OAuth Callback received:");
        console.log(`   URL: ${req.url}`);
        console.log(`   Query params: ${JSON.stringify(req.query)}`);
        
        const configured = await setupGoogleStrategy();
        if (!configured) {
          console.warn("⚠️ Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
          return res.redirect("/auth?error=google_not_configured&details=missing_credentials");
        }
        
        // Using a custom callback cleanly intercepts TokenErrors and duplicate code errors
        passport.authenticate("google", { session: false }, (err: any, user: any) => {
          if (err) {
            console.error("❌ Google Auth Error:", {
              message: err.message || err,
              code: err.code,
              status: err.status,
              uri: err.uri
            });
            // Include error details in redirect for debugging
            const errorCode = err.code === "ETIMEDOUT" ? "timeout" : "auth_failed";
            return res.redirect(`/auth?error=google_${errorCode}&details=${encodeURIComponent(err.message || "Unknown error")}`);
          }
          if (!user) {
            console.error("❌ Google Auth: User not returned from strategy");
            return res.redirect("/auth?error=google_auth_failed&details=no_user_returned");
          }
          console.log(`✅ Google Auth Success for user: ${user.email}`);
          req.user = user;
          next();
        })(req, res, next);
      } catch (e) {
        console.error("❌ Google Callback Exception:", e);
        next(e);
      }
    },
    async (req, res) => {
      const user = req.user as any;
      if (!user) return res.redirect("/auth");

      // Generate the exact same JWT token as local login
      const token = await new SignJWT({ id: user.id, openId: user.openId, email: user.email, name: user.name, role: user.role })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(JWT_SECRET);

      const isSecure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
      const cookieOpts = { httpOnly: true, path: "/", secure: isSecure, sameSite: (isSecure ? "none" : "lax") as "none" | "lax" };
      
      res.cookie(COOKIE_NAME, token, { ...cookieOpts, maxAge: 604800000 });

      // Update last signed in
      const db = await getDb();
      if (db) await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      // Redirect back to frontend
      res.redirect("/dashboard");
    }
  );

  app.get("/api/auth/facebook", async (req, res, next) => {
    try {
      const configured = await setupFacebookStrategy();
      if (!configured) {
        return res.redirect("/auth?error=facebook_not_configured");
      }
      passport.authenticate("facebook", { scope: ["email"], session: false })(req, res, next);
    } catch (e) {
      next(e);
    }
  });

  app.get(
    "/api/auth/facebook/callback",
    async (req, res, next) => {
      try {
        const configured = await setupFacebookStrategy();
        if (!configured) {
          return res.redirect("/auth?error=facebook_not_configured");
        }
        passport.authenticate("facebook", { session: false }, (err: any, user: any) => {
          if (err) {
            console.error("Facebook Auth Error:", err.message || err);
            return res.redirect("/auth?error=facebook_auth_failed");
          }
          if (!user) {
            return res.redirect("/auth?error=facebook_auth_failed");
          }
          req.user = user;
          next();
        })(req, res, next);
      } catch (e) {
        next(e);
      }
    },
    async (req, res) => {
      const user = req.user as any;
      if (!user) return res.redirect("/auth");
      const token = await new SignJWT({ id: user.id, openId: user.openId, email: user.email, name: user.name, role: user.role }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(JWT_SECRET);
      const isSecure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
      res.cookie(COOKIE_NAME, token, { httpOnly: true, path: "/", secure: isSecure, sameSite: (isSecure ? "none" : "lax") as "none" | "lax", maxAge: 604800000 });
      const db = await getDb();
      if (db) await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
      res.redirect("/dashboard");
    }
  );

  // 3. Diagnostic Endpoint - Help debug OAuth issues
  app.get("/api/auth/oauth-config", async (req, res) => {
    try {
      const securitySettings = await getSetting("security");
      const googleClientId = securitySettings?.googleClientId || process.env.GOOGLE_CLIENT_ID;
      const facebookAppId = securitySettings?.facebookAppId || process.env.FACEBOOK_APP_ID;
      
      const callbackURL = `${callbackUrlBase}/api/auth/google/callback`;
      
      res.json({
        status: "OAuth Configuration",
        environment: process.env.NODE_ENV || "development",
        callbackUrlBase: callbackUrlBase,
        googleCallbackUrl: callbackURL,
        googleConfigured: !!googleClientId && !!process.env.GOOGLE_CLIENT_SECRET,
        facebookConfigured: !!facebookAppId && !!process.env.FACEBOOK_APP_SECRET,
        hint: "If Google OAuth fails with 'Malformed auth code', verify that this googleCallbackUrl matches EXACTLY what's in Google Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → Authorized redirect URIs (no trailing slashes, exact protocol and host)"
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}