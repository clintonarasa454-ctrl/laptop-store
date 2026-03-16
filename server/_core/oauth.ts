import { Express } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { SignJWT } from "jose";
import { serialize } from "cookie";
import { eq } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { users } from "../../drizzle/schema";
import { getDb, getUserByEmail, getSetting } from "../db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default_jwt_secret_for_development_only"
);

export function registerOAuthRoutes(app: Express) {
  app.use(passport.initialize());

  const setupGoogleStrategy = async () => {
    const securitySettings = await getSetting("security");
    const clientId = securitySettings?.googleClientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = securitySettings?.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) return false;

    passport.use(
      new GoogleStrategy(
        {
          clientID: clientId,
          clientSecret: clientSecret,
          callbackURL: "/api/auth/google/callback",
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
    return true;
  };

  const setupFacebookStrategy = async () => {
    const securitySettings = await getSetting("security");
    const clientID = securitySettings?.facebookAppId || process.env.FACEBOOK_APP_ID;
    const clientSecret = securitySettings?.facebookAppSecret || process.env.FACEBOOK_APP_SECRET;

    if (!clientID || !clientSecret) return false;

    passport.use(
      new FacebookStrategy(
        {
          clientID,
          clientSecret,
          callbackURL: "/api/auth/facebook/callback",
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
    return true;
  };

  // 2. Define the Express Routes
  app.get("/api/auth/google", async (req, res, next) => {
    try {
      const configured = await setupGoogleStrategy();
      if (!configured) {
        return res.redirect("/auth?error=google_not_configured");
      }
      passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
    } catch (e) {
      next(e);
    }
  });

  app.get(
    "/api/auth/google/callback",
    async (req, res, next) => {
      try {
        const configured = await setupGoogleStrategy();
        if (!configured) {
          return res.redirect("/auth?error=google_not_configured");
        }
        passport.authenticate("google", { session: false, failureRedirect: "/auth" })(req, res, next);
      } catch (e) {
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
        passport.authenticate("facebook", { session: false, failureRedirect: "/auth" })(req, res, next);
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
}