import { useEffect, useState } from 'react';

/**
 * Hook to track currency changes and trigger component re-renders
 * Listens to the 'currencyUpdated' event dispatched from App.tsx
 * This ensures components using formatPrice() see updated currency values
 */
export function useCurrency() {
  const [currency, setCurrency] = useState<string>(() => {
    try {
      return localStorage.getItem("store_currency") || "KES";
    } catch {
      return "KES";
    }
  });

  useEffect(() => {
    const handleCurrencyUpdate = () => {
      try {
        const newCurrency = localStorage.getItem("store_currency") || "KES";
        setCurrency(newCurrency);
      } catch {
        setCurrency("KES");
      }
    };

    // Listen for currency updates from admin panel
    window.addEventListener("currencyUpdated", handleCurrencyUpdate);
    
    return () => {
      window.removeEventListener("currencyUpdated", handleCurrencyUpdate);
    };
  }, []);

  return currency;
}
