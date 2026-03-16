// Guest cart stored in localStorage
export const GUEST_CART_KEY = "nexus_guest_cart";

export interface GuestCartItem {
  productId: number;
  quantity: number;
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

export function addToGuestCart(productId: number, quantity: number = 1): void {
  const cart = getGuestCart();
  const existing = cart.find((i) => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
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
  let currency = "USD";
  try {
    currency = localStorage.getItem("nexus_currency") || "USD";
  } catch (e) {
    // ignore localStorage errors in strict environments
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
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
