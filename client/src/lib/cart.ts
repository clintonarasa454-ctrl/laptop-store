// Guest cart stored in localStorage
export const GUEST_CART_KEY = "nexus_guest_cart";

// New, richer interface for guest cart items
export interface GuestCartItem {
  productId: number;
  quantity: number;
  // Snapshot data for instant UI rendering
  name?: string;
  price?: string;
  image?: string;
  slug?: string;
  stock?: number;
}

export function getGuestCart(): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setGuestCart(items: GuestCartItem[]): void {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

export function clearGuestCart(): void {
  localStorage.removeItem(GUEST_CART_KEY);
}

// Modify addToGuestCart to accept the full product snapshot
export function addToGuestCart(product: any, quantity: number = 1): void {
  const cart = getGuestCart();
  const existing = cart.find((i) => i.productId === product.id);
  if (existing) {
    existing.quantity = Math.min(product.stock, existing.quantity + quantity);
  } else {
    cart.push({
      productId: product.id,
      quantity,
      name: product.name,
      price: product.price,
      image: (product.images as string[])?.[0],
      slug: product.slug,
      stock: product.stock,
    });
  }
  setGuestCart(cart);
}

export function updateGuestCartItem(productId: number, quantity: number): void {
  const cart = getGuestCart();
  if (quantity <= 0) {
    setGuestCart(cart.filter((i) => i.productId !== productId));
  } else {
    const item = cart.find((i) => i.productId === productId);
    if (item) item.quantity = quantity;
    setGuestCart(cart);
  }
}

export function removeFromGuestCart(productId: number): void {
  setGuestCart(getGuestCart().filter((i) => i.productId !== productId));
}

export function formatPrice(price: string | number): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "Ksh0.00";

  let currency = "KES";
  let rates: Record<string, number> | null = null;

  try {
    currency = localStorage.getItem("nexus_currency") || "KES";
    const ratesStr = localStorage.getItem("nexus_exchange_rates");
    if (ratesStr) rates = JSON.parse(ratesStr);
  } catch (e) {
    // ignore localStorage errors in strict environments
  }

  let finalPrice = num;
  if (rates && currency !== "KES" && rates[currency]) {
    finalPrice = num * rates[currency];
  }

  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(finalPrice);
}

export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    payment_confirmed: "Payment Confirmed",
    processing: "Processing",
    shipped: "Shipped",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };
  return labels[status] ?? status;
}

export function getOrderStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "text-yellow-600 bg-yellow-50 border-yellow-200",
    payment_confirmed: "text-blue-600 bg-blue-50 border-blue-200",
    processing: "text-purple-600 bg-purple-50 border-purple-200",
    shipped: "text-indigo-600 bg-indigo-50 border-indigo-200",
    out_for_delivery: "text-orange-600 bg-orange-50 border-orange-200",
    delivered: "text-green-600 bg-green-50 border-green-200",
    cancelled: "text-red-600 bg-red-50 border-red-200",
    refunded: "text-gray-600 bg-gray-50 border-gray-200",
  };
  return colors[status] ?? "text-gray-600 bg-gray-50 border-gray-200";
}
