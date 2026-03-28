import { trpc } from "@/lib/trpc";
import { formatPrice, getOrderStatusColor, getOrderStatusLabel } from "@/lib/cart";
import {
  CheckCircle,
  ChevronRight,
  Download,
  Loader2,
  MapPin,
  Package,
  ShoppingBag,
  Truck,
  RefreshCw,
  CreditCard,
  UserPlus
} from "lucide-react";
import { Link, useParams } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function OrderConfirmation() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { data, isLoading, error } = trpc.orders.byNumber.useQuery({ orderNumber: orderNumber! });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center py-20">
          <div>
            <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <h2 className="font-display text-xl font-bold mb-2">Order Not Found</h2>
            <Link href="/dashboard/orders">
              <Button className="bg-[var(--brand)] text-white hover:opacity-90">View My Orders</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const { order, items, history, payment } = data;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="container py-10 flex-1 max-w-3xl mx-auto">
        {/* Success header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-9 h-9 text-green-500" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-1">Order Confirmed!</h1>
          <p className="text-muted-foreground">
            Thank you for your purchase. Your order has been placed successfully.
          </p>
        </div>

        {/* Order details card */}
        <div className="bg-card border border-border rounded-xl p-6 mb-5">
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Order Number</p>
              <p className="font-mono font-semibold text-sm">{order.orderNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Order Status</p>
              <Badge className={`text-xs ${getOrderStatusColor(order.status)}`}>
                {getOrderStatusLabel(order.status)}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Payment Status</p>
              <Badge className={`text-xs ${order.paymentStatus === "paid" ? "text-green-600 bg-green-50 border-green-200" : "text-yellow-600 bg-yellow-50 border-yellow-200"}`}>
                {order.paymentStatus === "paid" ? "✓ Paid" : "Pending"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Payment Method</p>
              <p className="text-sm font-medium capitalize">{order.paymentMethod ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Order Date</p>
              <p className="text-sm">{new Date(order.createdAt).toLocaleDateString()}</p>
            </div>
            {order.estimatedDelivery && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Estimated Delivery</p>
                <p className="text-sm font-medium text-green-600">{new Date(order.estimatedDelivery).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {/* Shipping address */}
          <div className="bg-muted/40 rounded-lg p-4 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-[var(--brand)]" />
              <p className="text-sm font-semibold">Shipping Address</p>
            </div>
            <p className="text-sm">{order.shippingFullName}</p>
            <p className="text-sm text-muted-foreground">{order.shippingAddress}, {order.shippingCity}{order.shippingPostalCode ? `, ${order.shippingPostalCode}` : ""}, {order.shippingCountry}</p>
            <p className="text-sm text-muted-foreground">{order.shippingPhone}</p>
          </div>

          {/* Items */}
          <div className="space-y-3 mb-5">
            <p className="text-sm font-semibold">Items Ordered</p>
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 items-center">
                {item.productImage && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                    <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {formatPrice(item.price)}</p>
                </div>
                <p className="text-sm font-semibold shrink-0">{formatPrice(item.subtotal)}</p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-border pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className={parseFloat(order.shippingCost) === 0 ? "text-green-600" : ""}>
                {parseFloat(order.shippingCost) === 0 ? "Free" : formatPrice(order.shippingCost)}
              </span>
            </div>
            <div className="flex justify-between font-display font-bold text-base pt-1 border-t border-border">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Guest Conversion Card */}
        {!order.userId && (
          <div className="bg-gradient-to-br from-[var(--brand)]/10 to-transparent border border-[var(--brand)]/20 rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="font-display font-bold text-lg mb-1 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[var(--brand)]" />
                Save your details for next time!
              </h2>
              <p className="text-sm text-muted-foreground">Create an account in 1-click to track your order and save your shipping address.</p>
            </div>
            <Button 
              onClick={() => window.location.href = `/auth?mode=register&email=${encodeURIComponent(order.shippingEmail || "")}&claimOrder=${order.orderNumber}`}
              className="shrink-0 bg-[var(--brand)] text-white hover:opacity-90 w-full sm:w-auto"
            >
              Create Account
            </Button>
          </div>
        )}

        {/* Order tracking preview */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-5 h-5 text-[var(--brand)]" />
            <h2 className="font-display font-semibold">Order Tracking</h2>
          </div>
          <div className="space-y-3">
            {history.map((h, i) => (
              <div key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full border-2 ${i === history.length - 1 ? "bg-[var(--brand)] border-[var(--brand)]" : "bg-green-500 border-green-500"}`} />
                  {i < history.length - 1 && <div className="w-0.5 h-6 bg-border mt-1" />}
                </div>
                <div className="pb-2">
                  <p className="text-sm font-medium">{getOrderStatusLabel(h.status)}</p>
                  {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {order.paymentStatus === "pending" ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/checkout" className="flex-1">
              <Button className="w-full bg-[var(--brand)] text-white hover:opacity-90 gap-2">
                <CreditCard className="w-4 h-4" /> Retry Payment
              </Button>
            </Link>
            <Link href="/checkout" className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <RefreshCw className="w-4 h-4" /> Change Payment Method
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={`/dashboard/orders/${order.id}`} className="flex-1">
              <Button className="w-full bg-[var(--brand)] text-white hover:opacity-90 gap-2">
                <Truck className="w-4 h-4" /> Track Order
              </Button>
            </Link>
            <Link href="/products" className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <ShoppingBag className="w-4 h-4" /> Continue Shopping
              </Button>
            </Link>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
