import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCtx(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "email",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const cleared: string[] = [];
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string) => cleared.push(name),
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(cleared).toContain(COOKIE_NAME);
  });

  it("returns null user when not authenticated", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });

  it("returns user when authenticated", async () => {
    const caller = appRouter.createCaller(createCtx());
    const user = await caller.auth.me();
    expect(user).not.toBeNull();
    expect(user?.email).toBe("test@example.com");
  });
});

// ─── Cart ─────────────────────────────────────────────────────────────────────
describe("cart procedures", () => {
  it("cart.upsert is protected - throws UNAUTHORIZED for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.cart.upsert({ productId: 1, quantity: 2 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("cart.get is protected - throws UNAUTHORIZED for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.cart.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ─── Admin ────────────────────────────────────────────────────────────────────
describe("admin procedures", () => {
  it("admin.stats is forbidden for regular users", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(caller.admin.stats()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin.orders is forbidden for regular users", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(caller.admin.orders()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin.customers is forbidden for regular users", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(caller.admin.customers()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin.createProduct is forbidden for regular users", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(
      caller.admin.createProduct({
        categoryId: 1,
        name: "Test Product",
        slug: "test-product",
        price: "99.00",
        stock: 10,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin.deleteProduct is forbidden for regular users", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(
      caller.admin.deleteProduct({ productId: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── Orders ───────────────────────────────────────────────────────────────────
describe("orders procedures", () => {
  it("orders.myOrders is protected - throws UNAUTHORIZED for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.orders.myOrders()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ─── Addresses ────────────────────────────────────────────────────────────────
describe("addresses procedures", () => {
  it("addresses.list is protected - throws UNAUTHORIZED for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.addresses.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
