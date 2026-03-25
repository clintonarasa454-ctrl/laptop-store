import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  formatPrice,
  getGuestCart,
  removeFromGuestCart,
  updateGuestCartItem,
} from "@/lib/cart";
import {
  ArrowRight,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface GuestCartDisplayItem {
  productId: number;
  quantity: number;
  product?: {
    id: number;
    name: string;
    price: string;
    images: unknown;
    brand?: string | null;
    stock: number;
  };
}

export default function Cart() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Authenticated cart
  const { data: authCart, isLoading: authLoading } = trpc.cart.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const upsertCart = trpc.cart.upsert.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
    onError: () => toast.error("Failed to update cart"),
  });

  const removeItem = trpc.cart.remove.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      toast.success("Item removed");
    },
  });

  // Guest cart
  const [guestItems, setGuestItems] = useState<GuestCartDisplayItem[]>([]);
  const [guestLoading, setGuestLoading] = useState(false);

  const productIds = guestItems.map((i) => i.productId);
  // We load guest product details via individual queries
  const { data: guestProducts } = trpc.products.list.useQuery(
    { limit: 50 },
    { enabled: !isAuthenticated && guestItems.length > 0 }
  );
  const { data: settings } = trpc.settings.public.useQuery(
    { keys: ["shipping", "general"] },
    { staleTime: Infinity }
  );

  useEffect(() => {
    if (!isAuthenticated) {
      const raw = getGuestCart();
      setGuestItems(raw.map((i) => ({ ...i })));
    }
  }, [isAuthenticated]);

  const guestDisplayItems = guestItems.map((gi) => ({
    ...gi,
    product: guestProducts?.find((p) => p.id === gi.productId),
  }));

  const handleGuestQtyChange = (productId: number, qty: number) => {
    updateGuestCartItem(productId, qty);
    setGuestItems(getGuestCart());
    window.dispatchEvent(new Event("guestCartUpdated"));
  };

  const handleGuestRemove = (productId: number) => {
    removeFromGuestCart(productId);
    setGuestItems(getGuestCart());
    window.dispatchEvent(new Event("guestCartUpdated"));
    toast.success("Item removed");
  };

  const isLoading = isAuthenticated ? authLoading : false;

  // Compute totals
  const freeThreshold = settings?.shipping?.freeShippingThreshold ? parseFloat(settings.shipping.freeShippingThreshold) : 500;
  const standardFee = settings?.shipping?.standardFee ? parseFloat(settings.shipping.standardFee) : 15;

  const items = isAuthenticated
    ? (authCart ?? []).map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        product: i.product,
      }))
    : guestDisplayItems;

  const subtotal = items.reduce((sum, item) => {
    const price = item.product ? parseFloat(item.product.price) : 0;
    return sum + price * item.quantity;
  }, 0);
  const shippingCost = items.length > 0 && subtotal < freeThreshold ? standardFee : 0;
  const total = subtotal + shippingCost;

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate("/checkout/auth");
    } else {
      navigate("/checkout");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="container py-8 flex-1">
        <h1 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6" /> Shopping Cart
          {items.length > 0 && (
            <span className="text-base font-normal text-muted-foreground">({items.length} item{items.length !== 1 ? "s" : ""})</span>
          )}
        </h1>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl border border-border">
                <Skeleton className="w-20 h-20 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-8 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <h2 className="font-display text-xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Looks like you haven't added anything yet.</p>
            <Link href="/products">
              <Button className="bg-[var(--brand)] text-white hover:opacity-90 gap-2">
                <Package className="w-4 h-4" /> Browse Products
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart items */}
            <div className="lg:col-span-2 space-y-3">
              {items.map((item) => {
                const images = (item.product?.images as string[]) ?? [];
                const image = images[0] ?? "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&q=80";
                const price = item.product ? parseFloat(item.product.price) : 0;

                return (
                  <div key={item.productId} className="flex gap-4 p-4 rounded-xl border border-border bg-card hover:border-[var(--brand)]/20 transition-colors">
                    <Link href={`/products/${item.product ? (item.product as any).slug ?? "" : ""}`}>
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                        <img src={image} alt={item.product?.name} className="w-full h-full object-cover" />
                      </div>
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {item.product?.brand && (
                            <p className="text-xs text-[var(--brand)] font-medium uppercase tracking-wide">{item.product.brand}</p>
                          )}
                          <h3 className="font-display font-semibold text-sm leading-snug line-clamp-2">
                            {item.product?.name ?? `Product #${item.productId}`}
                          </h3>
                        </div>
                        <button
                          onClick={() =>
                            isAuthenticated
                              ? removeItem.mutate({ productId: item.productId })
                              : handleGuestRemove(item.productId)
                          }
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        {/* Quantity */}
                        <div className="flex items-center border border-input rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              const currentQty = Number(item.quantity);
                              const newQty = Math.max(1, currentQty - 1);
                              if (isAuthenticated) {
                                upsertCart.mutate({ productId: item.productId, quantity: newQty });
                              } else {
                                handleGuestQtyChange(item.productId, newQty);
                              }
                            }}
                            className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={Number(item.quantity) <= 1 || upsertCart.isPending}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const currentQty = Number(item.quantity);
                              const newQty = Math.min(Number(item.product?.stock || 99), currentQty + 1);
                              if (isAuthenticated) {
                                upsertCart.mutate({ productId: item.productId, quantity: newQty });
                              } else {
                                handleGuestQtyChange(item.productId, newQty);
                              }
                            }}
                            className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={(item.product && Number(item.quantity) >= Number(item.product.stock)) || upsertCart.isPending}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          <p className="font-display font-bold">{formatPrice(price * item.quantity)}</p>
                          <p className="text-xs text-muted-foreground">{formatPrice(price)} each</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-between pt-2">
                <Link href="/products">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Continue Shopping
                  </Button>
                </Link>
              </div>
            </div>

            {/* Order summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-xl border border-border bg-card p-5 space-y-4">
                <h2 className="font-display font-semibold text-base">Order Summary</h2>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal ({items.length} items)</span>
                    <span className="font-medium">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className={shippingCost === 0 ? "text-green-600 font-medium" : "font-medium"}>
                      {shippingCost === 0 ? "Free" : formatPrice(shippingCost)}
                    </span>
                  </div>
                  {subtotal < freeThreshold && subtotal > 0 && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                      Add {formatPrice(freeThreshold - subtotal)} more for free shipping!
                    </p>
                  )}
                  <div className="border-t border-border pt-2.5 flex justify-between font-display font-bold text-base">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>

                <Button
                  onClick={handleCheckout}
                  className="w-full bg-[var(--brand)] text-white hover:opacity-90 gap-2"
                  size="lg"
                >
                  Proceed to Checkout <ArrowRight className="w-4 h-4" />
                </Button>

                {!isAuthenticated && (
                  <p className="text-xs text-center text-muted-foreground">
                    You'll need to{" "}
                    <button
                      onClick={() => (window.location.href = getLoginUrl("/checkout"))}
                      className="text-[var(--brand)] hover:underline"
                    >
                      sign in
                    </button>{" "}
                    to complete your purchase.
                  </p>
                )}

                <div className="pt-2 space-y-1.5">
                  {(settings?.general?.features || [
                    { title: "Secure encrypted checkout" }, 
                    { title: settings?.shipping?.freeShippingThreshold ? `Free shipping over ${formatPrice(settings.shipping.freeShippingThreshold)}` : "Fast reliable delivery" }, 
                    { title: "2-year warranty on all products" }
                  ]).slice(0, 3).map((f: any, idx: number) => (
                    <p key={idx} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[var(--brand)] shrink-0" />
                      {f.title}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
