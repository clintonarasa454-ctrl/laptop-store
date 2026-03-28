import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { getGuestCart, clearGuestCart } from '@/lib/cart';
import { toast } from 'sonner';
import StoreLoader from '@/components/StoreLoader';
import { useCartSync } from '@/components/CartSyncContext';

interface AuthContextType {
  user: any | null;
  isAuthenticated: boolean;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const wasAuthenticated = useRef(false);
  const utils = trpc.useUtils();
  const { startSync, endSync } = useCartSync();

  const { data: currentUser, isLoading: isMeLoading, refetch } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const syncCart = trpc.cart.syncFromGuest.useMutation({
    onSuccess: (data: any) => {
      endSync();
      clearGuestCart();
      utils.cart.get.invalidate();
      window.dispatchEvent(new Event("guestCartUpdated"));

      if (data && data.conflicts && data.conflicts.length > 0) {
        toast.warning(`Your carts were merged, but ${data.conflicts.length} item(s) had issues (e.g., out of stock).`);
      } else if (data && data.mergedItems > 0) {
        toast.info(`${data.mergedItems} item(s) from your guest session were merged into your cart.`);
      }
    },
    onError: (error) => {
      endSync();
      toast.error(`Could not sync your cart: ${error.message}`);
    }
  });

  useEffect(() => {
    if (!isMeLoading) {
      const newUser = currentUser ?? null;
      setUser(newUser);
      setLoading(false);

      const isAuthenticatedNow = !!newUser;
      if (isAuthenticatedNow && !wasAuthenticated.current) {
        const guestItems = getGuestCart();
        if (guestItems.length > 0) {
          startSync();
          syncCart.mutate(guestItems.map(item => ({ productId: item.productId, quantity: item.quantity })));
        }
      }
      wasAuthenticated.current = isAuthenticatedNow;
    }
  }, [currentUser, isMeLoading, syncCart]);

  useEffect(() => {
    const handleAuthChange = () => refetch();
    window.addEventListener("userAuthChanged", handleAuthChange);
    return () => window.removeEventListener("userAuthChanged", handleAuthChange);
  }, [refetch]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      setUser(null);
      utils.invalidate();
      toast.success("Logged out successfully");
      window.dispatchEvent(new Event("userAuthChanged"));
    }
  });

  const value = { user, isAuthenticated: !!user, loading, logout: () => logoutMutation.mutate() };

  if (loading) return <StoreLoader fullScreen />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}