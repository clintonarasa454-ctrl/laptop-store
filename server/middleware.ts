/**
 * Security Middleware for handling rate limiting and CSRF protection
 * ✅ FIX #6: Add rate limiting on payment endpoints
 * ✅ FIX #7: Add CSRF protection
 * ✅ FIX #25: Add security headers
 */

import { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";

// ─── Rate Limiting ─────────────────────────────────────────────────────────
interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number; // Time window in milliseconds
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    }
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const entry = this.store[identifier];

    if (!entry || entry.resetTime < now) {
      // Reset window
      this.store[identifier] = { count: 1, resetTime: now + this.windowMs };
      return true;
    }

    if (entry.count < this.maxRequests) {
      entry.count++;
      return true;
    }

    return false;
  }
}

// Create limiters for different endpoints
export const paymentRateLimiter = new RateLimiter(60000, 5); // 5 requests per minute per IP
export const authRateLimiter = new RateLimiter(60000, 10); // 10 requests per minute per IP
export const apiRateLimiter = new RateLimiter(60000, 200); // 200 requests per minute per IP to support 5s real-time dashboard polling

export function rateLimit(limiter: RateLimiter) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.socket.remoteAddress || "unknown";
    
    if (!limiter.isAllowed(identifier)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    
    next();
  };
}

// ─── CSRF Protection ──────────────────────────────────────────────────────
class CSRFProtection {
  private sessionTokens: Map<string, { token: string; createdAt: number }> = new Map();
  private tokenTTL = 3600000; // 1 hour

  generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  createSessionToken(sessionId: string): string {
    const token = this.generateToken();
    this.sessionTokens.set(sessionId, { token, createdAt: Date.now() });
    return token;
  }

  validateToken(sessionId: string, token: string): boolean {
    const stored = this.sessionTokens.get(sessionId);
    if (!stored) return false;
    
    const isExpired = Date.now() - stored.createdAt > this.tokenTTL;
    if (isExpired) {
      this.sessionTokens.delete(sessionId);
      return false;
    }

    // Valid token check
    return stored.token === token;
  }

  cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.sessionTokens.forEach((value, key) => {
      if (now - value.createdAt > this.tokenTTL) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.sessionTokens.delete(key));
  }
}

export const csrfProtection = new CSRFProtection();

// Run cleanup every 10 minutes
setInterval(() => csrfProtection.cleanup(), 600000);

// ─── Security Headers Middleware ──────────────────────────────────────────
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions policy
  res.setHeader("Permissions-Policy", "geolocation=(self), microphone=(self), camera=()");
  
  next();
}

// ─── HTTPS Enforcement ────────────────────────────────────────────────────
export function enforceHttps(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "production" && req.protocol !== "https" && req.headers["x-forwarded-proto"] !== "https") {
    return res.status(403).json({ error: "HTTPS required in production" });
  }
  next();
}

// ─── Input Sanitization ───────────────────────────────────────────────────
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  const sanitize = (obj: any): any => {
    if (typeof obj === "string") {
      // Remove null bytes and control characters
      return obj.replace(/\\u0000|[\\x00-\\x1F\\x7F]/g, "");
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj !== null && typeof obj === "object") {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  
  next();
}
