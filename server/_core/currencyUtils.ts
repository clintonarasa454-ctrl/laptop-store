/**
 * Currency Conversion Utilities
 * Handles all currency conversions between store currency and payment processor currencies
 */

/**
 * Get exchange rate from one currency to another
 * Rates are stored as: if store is KES and we have rates {USD: 0.0077, EUR: 0.0085}
 * Then: 1 KES = 0.0077 USD, 1 KES = 0.0085 EUR
 * 
 * To convert from currency A to currency B, we need both exchange rates from base (KES)
 */
export function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  exchangeRates: Record<string, number>
): number | null {
  // If same currency, no conversion needed
  if (fromCurrency === toCurrency) return 1;

  // If store currency is the base (KES), rates are direct multipliers
  if (fromCurrency === "KES" && exchangeRates[toCurrency]) {
    return exchangeRates[toCurrency];
  }

  // If converting TO KES from store currency
  if (toCurrency === "KES") {
    if (exchangeRates[fromCurrency]) {
      return 1 / exchangeRates[fromCurrency];
    }
  }

  // If converting between two non-KES currencies, use KES as intermediate
  if (exchangeRates[fromCurrency] && exchangeRates[toCurrency]) {
    return exchangeRates[toCurrency] / exchangeRates[fromCurrency];
  }

  return null;
}

/**
 * Convert amount from one currency to another
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRates: Record<string, number> = {}
): number {
  const rate = getExchangeRate(fromCurrency, toCurrency, exchangeRates);
  if (rate === null) {
    console.warn(`No exchange rate found: ${fromCurrency} -> ${toCurrency}`);
    return amount; // Return unchanged if rate not found
  }
  return amount * rate;
}

/**
 * Convert amount to PayPal-supported currency
 * PayPal only supports certain currencies. If store uses unsupported currency,
 * convert to USD using exchange rates
 */
export function convertToPayPalCurrency(
  amount: number,
  storeCurrency: string,
  exchangeRates: Record<string, number> = {}
): { finalAmount: number; finalCurrency: string } {
  const PAYPAL_CURRENCIES = [
    "AUD", "BRL", "CAD", "CNY", "CZK", "DKK", "EUR", "HKD", "HUF", 
    "ILS", "JPY", "MYR", "MXN", "TWD", "NZD", "NOK", "PHP", "PLN", 
    "GBP", "RUB", "SGD", "SEK", "CHF", "THB", "USD"
  ];

  // If store currency is already supported, use it as-is
  if (PAYPAL_CURRENCIES.includes(storeCurrency)) {
    return { finalAmount: amount, finalCurrency: storeCurrency };
  }

  // Otherwise convert to USD
  const amountInUSD = convertCurrency(amount, storeCurrency, "USD", exchangeRates);
  return { finalAmount: amountInUSD, finalCurrency: "USD" };
}

/**
 * Convert amount to M-Pesa currency (KES)
 * M-Pesa only accepts KES amounts. Convert store currency to KES if needed.
 */
export function convertToMPesaCurrency(
  amount: number,
  storeCurrency: string,
  exchangeRates: Record<string, number> = {}
): { finalAmount: number; error?: string } {
  if (storeCurrency === "KES") {
    return { finalAmount: Math.ceil(amount) };
  }

  // Try to convert to KES
  const amountInKES = convertCurrency(amount, storeCurrency, "KES", exchangeRates);
  
  if (!exchangeRates[storeCurrency] && storeCurrency !== "KES") {
    return {
      finalAmount: 0,
      error: `Cannot process M-Pesa payment: Exchange rate for ${storeCurrency} to KES not available`
    };
  }

  return { finalAmount: Math.ceil(amountInKES) };
}

/**
 * Convert amount to Stripe-supported format
 * Stripe uses zero-decimal currencies (JPY, KRW, etc.) differently
 */
export function convertToStripeCurrency(
  amount: number,
  storeCurrency: string
): { finalAmount: number; finalCurrency: string } {
  const zeroDecimalCurrencies = [
    "jpy", "krw", "bif", "pyg", "vnd", "xaf", "xpf", 
    "clp", "djf", "gnf", "kmf", "mga", "rwf", "ugx", "vuv"
  ];

  const currencyLower = storeCurrency.toLowerCase();
  const isZeroDecimal = zeroDecimalCurrencies.includes(currencyLower);
  
  // Zero-decimal currencies are sent as-is, others are multiplied by 100
  const finalAmount = isZeroDecimal ? Math.round(amount) : Math.round(amount * 100);
  
  return { finalAmount, finalCurrency: currencyLower };
}

/**
 * Format currency display string
 */
export function formatCurrency(amount: number | string, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  
  const currencySymbols: Record<string, string> = {
    "KES": "Ksh",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "UGX": "USh",
    "TZS": "TSh",
    "ZAR": "R",
    "NGN": "₦",
    "JPY": "¥",
  };

  const symbol = currencySymbols[currency] || currency;
  return `${symbol} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
