import { createContext, useContext, useState, ReactNode } from 'react';

interface CartSyncContextType {
  isSyncing: boolean;
  startSync: () => void;
  endSync: () => void;
}

const CartSyncContext = createContext<CartSyncContextType>({
  isSyncing: false,
  startSync: () => {},
  endSync: () => {},
});

export function useCartSync() {
  return useContext(CartSyncContext);
}

export function CartSyncProvider({ children }: { children: ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);

  const startSync = () => setIsSyncing(true);
  const endSync = () => setIsSyncing(false);

  const value = { isSyncing, startSync, endSync };

  return (
    <CartSyncContext.Provider value={value}>
      {children}
    </CartSyncContext.Provider>
  );
}