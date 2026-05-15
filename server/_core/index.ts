import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import compression from "compression";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter, processAbandonedCheckouts, processAutoRestock } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { webhookRouter } from "../webhooks";
import { validateConfiguration, logConfigurationStatus } from "./configValidator";
import {
  securityHeaders,
  enforceHttps,
  sanitizeInput,
  rateLimit,
  authRateLimiter,
  apiRateLimiter,
  paymentRateLimiter,
} from "../middleware";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Validate configuration before starting
  const config = validateConfiguration();
  logConfigurationStatus(config);

  const app = express();
  const server = createServer(app);

  // ────── Security Middleware ──────────────────────────────────────────────
  app.use(enforceHttps); // Redirect to HTTPS in production
  app.use(securityHeaders); // Add security headers
  app.use(sanitizeInput); // Sanitize input to prevent injection attacks

  // Enable gzip compression for 70% smaller responses
  app.use(compression());

  // Webhooks MUST be mounted before express.json() to preserve the raw body
  app.use("/api/webhooks", webhookRouter);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ────── Apply Rate Limiting to specific routes ─────────────────────────
  app.use(
    "/api/trpc/auth.login",
    rateLimit(authRateLimiter) // Auth routes: 10 req/min per IP
  );
  app.use(
    "/api/trpc/auth.register",
    rateLimit(authRateLimiter)
  );
  app.use(
    "/api/trpc/payments",
    rateLimit(paymentRateLimiter) // Payment routes: 5 req/min per IP
  );
  
  // tRPC API with general rate limiting
  app.use(
    "/api/trpc",
    rateLimit(apiRateLimiter), // General API: 30 req/min per IP
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server, port);
  } else {
    serveStatic(app);
  }

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Start the abandoned checkout background worker (checks every hour safely)
    const runAbandonedCheckoutWorker = () => {
      processAbandonedCheckouts()
        .catch(console.error)
        .finally(() => {
          setTimeout(runAbandonedCheckoutWorker, 1000 * 60 * 60); // Schedule next run in 1 hour
        });
    };
    
    // Run it once on startup to catch up on any missed emails
    setTimeout(runAbandonedCheckoutWorker, 10000);

    // Start the AI Predictive Purchasing auto-restock worker (runs daily)
    const runAutoRestockWorker = () => {
      processAutoRestock()
        .catch(console.error)
        .finally(() => {
          setTimeout(runAutoRestockWorker, 1000 * 60 * 60 * 24); // Schedule next run in 24 hours
        });
    };
    setTimeout(runAutoRestockWorker, 1000 * 60 * 5); // Run first check 5 minutes after startup
  });
}

startServer().catch(console.error);
