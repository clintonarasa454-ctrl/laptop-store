/**
 * Utility to invalidate admin cache when updates are made
 * This ensures real-time updates are reflected immediately
 */

// These keys should match what's invalidated in useRealtimeUpdates
export const CACHE_KEYS = {
  ADMIN_STATS: ["admin", "stats"],
  ADMIN_USERS: ["admin", "users"],
  ADMIN_PRODUCTS: ["admin", "products"],
  ADMIN_CATEGORIES: ["admin", "categories"],
  ADMIN_ORDERS: ["admin", "orders"],
  ADMIN_BANNERS: ["admin", "banners"],
  ADMIN_PROMOTIONS: ["admin", "promotions"],
  STORE_PAGEVIEWS: ["store", "pageViews"],
} as const;

/**
 * Call this after making admin updates to trigger real-time refreshes
 */
export async function notifyUpdates(
  type: "orders" | "users" | "products" | "categories" | "managers" | "banners" | "promotions" | "all",
  queryClient?: any
) {
  // If queryClient is provided, invalidate queries
  if (queryClient) {
    switch (type) {
      case "orders":
        await queryClient.invalidateQueries({ queryKey: CACHE_KEYS.ADMIN_STATS });
        break;
      case "users":
      case "managers":
        await queryClient.invalidateQueries({ queryKey: CACHE_KEYS.ADMIN_USERS });
        await queryClient.invalidateQueries({ queryKey: CACHE_KEYS.ADMIN_STATS });
        break;
      case "products":
        await queryClient.invalidateQueries({ queryKey: CACHE_KEYS.ADMIN_PRODUCTS });
        await queryClient.invalidateQueries({ queryKey: CACHE_KEYS.ADMIN_STATS });
        break;
      case "categories":
        await queryClient.invalidateQueries({ queryKey: CACHE_KEYS.ADMIN_CATEGORIES });
        await queryClient.invalidateQueries({ queryKey: CACHE_KEYS.ADMIN_PRODUCTS });
        break;
      case "banners":
        await queryClient.invalidateQueries({ queryKey: CACHE_KEYS.ADMIN_BANNERS });
        break;
      case "promotions":
        await queryClient.invalidateQueries({ queryKey: CACHE_KEYS.ADMIN_PROMOTIONS });
        break;
      case "all":
        await queryClient.invalidateQueries({ queryKey: ["admin"] });
        break;
    }
  }

  // Dispatch custom event that realtime updates hook can listen to
  window.dispatchEvent(
    new CustomEvent("admin_update", {
      detail: { type, timestamp: Date.now() },
    })
  );
}
