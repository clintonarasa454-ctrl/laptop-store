import { useEffect, useRef, useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";

export interface RealtimeUpdates {
  newOrders?: {
    count: number;
    orders: any[];
  };
  newUsers?: {
    count: number;
    users: any[];
  };
  newManagers?: {
    count: number;
    managers: any[];
  };
  productCountChanged?: {
    newCount: number;
    previousCount: number;
    difference: number;
  };
  newVisitors?: {
    count: number;
    totalPageViews: number;
  };
  settingsChanged?: boolean;
}

interface CurrentCounts {
  orders: number;
  users: number;
  managers: number;
  products: number;
  pageViews: number;
}

/**
 * Hook for real-time dashboard updates
 * Polls the admin.checkUpdates endpoint every 0.5 seconds
 * Updates are triggered when new data is detected
 */
export function useRealtimeUpdates(
  onUpdatesDetected?: (updates: RealtimeUpdates, counts: CurrentCounts) => void
) {
  const queryClient = useQueryClient();
  const lastCheckRef = useRef<number>(Date.now());
  const countsRef = useRef<CurrentCounts>({
    orders: 0,
    users: 0,
    managers: 0,
    products: 0,
    pageViews: 0,
  });
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const isFirstPollRef = useRef(true);

  const checkUpdates = trpc.admin.checkUpdates.useQuery(
    {
      lastCheck: lastCheckRef.current,
      previousOrderCount: countsRef.current.orders,
      previousUserCount: countsRef.current.users,
      previousManagerCount: countsRef.current.managers,
      previousProductCount: countsRef.current.products,
      previousPageViewCount: countsRef.current.pageViews,
    },
    {
      enabled: false, // Disable automatic fetching, we'll control it manually
    }
  );

  const pollForUpdates = useCallback(async () => {
    if (!isEnabled) return;

    try {
      // Update query data with current values before refetch
      const currentCounts = {
        lastCheck: lastCheckRef.current,
        previousOrderCount: countsRef.current.orders,
        previousUserCount: countsRef.current.users,
        previousManagerCount: countsRef.current.managers,
        previousProductCount: countsRef.current.products,
        previousPageViewCount: countsRef.current.pageViews,
      };
      
      // Refetch with fresh data using current query parameters
      const result = await queryClient.fetchQuery({
        queryKey: [["admin", "checkUpdates"], { input: currentCounts }] as any,
        queryFn: async () => (checkUpdates as any).query?.(currentCounts) || { hasUpdates: false },
      });
      
      if (result) {
        if (result.hasUpdates && !isFirstPollRef.current) {
          // Trigger callback if provided
          if (onUpdatesDetected) {
            onUpdatesDetected(result.updates, result.currentCounts);
          }

          // Invalidate relevant queries to trigger UI updates
          if (result.updates.newOrders) {
            await queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
          }
          if (result.updates.newUsers || result.updates.newManagers) {
            await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
          }
          if (result.updates.productCountChanged) {
            await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
          }
          if (result.updates.newVisitors) {
            await queryClient.invalidateQueries({ queryKey: ["store", "pageViews"] });
          }
        }
        
        // Update refs with latest counts
        if (result.currentCounts) countsRef.current = result.currentCounts;
        if (result.timestamp) lastCheckRef.current = result.timestamp;
        isFirstPollRef.current = false;
      }
    } catch (error) {
      console.warn("[RealtimeUpdates] Poll error:", error);
    }
  }, [queryClient, isEnabled, onUpdatesDetected]);

  // Listen to admin update events for instant invalidation
  useEffect(() => {
    const handleAdminUpdate = (event: CustomEvent) => {
      const { type } = event.detail;

      // Immediately invalidate relevant queries
      switch (type) {
        case "orders":
          queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
          break;
        case "users":
        case "managers":
          queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
          break;
        case "products":
          queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
          break;
        case "categories":
          queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
          break;
        case "banners":
          queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
          break;
        case "promotions":
          queryClient.invalidateQueries({ queryKey: ["admin", "promotions"] });
          break;
        case "all":
          queryClient.invalidateQueries({ queryKey: ["admin"] });
          break;
      }

      // Trigger a poll to get fresh counts
      pollForUpdates();
    };

    window.addEventListener("admin_update" as any, handleAdminUpdate);
    return () => window.removeEventListener("admin_update" as any, handleAdminUpdate);
  }, [queryClient, pollForUpdates]);

  // Set up polling interval on mount
  useEffect(() => {
    if (!isEnabled) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Initial check
    pollForUpdates();

    // Set up polling interval (500ms = 0.5 seconds)
    pollingIntervalRef.current = setInterval(pollForUpdates, 500);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isEnabled, pollForUpdates]);

  return {
    isEnabled,
    setIsEnabled,
    lastCheck: lastCheckRef.current,
    currentCounts: countsRef.current,
  };
}
