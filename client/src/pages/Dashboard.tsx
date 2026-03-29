import { useAuth } from "@/pages/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { formatPrice, getOrderStatusColor, getOrderStatusLabel } from "@/lib/cart";
import {
  CheckCircle,
  ChevronRight,
  CreditCard,
  Download,
  Loader2,
  LogOut,
  MapPin,
  Package,
  Plus,
  Printer,
  ShoppingBag,
  Star,
  Heart,
  Trash2,
  Truck,
  Phone,
  User,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ProductCard from "@/components/ProductCard";
import StoreLoader from "@/components/StoreLoader";
import { MapView } from "@/components/Map";

type Tab = "overview" | "orders" | "addresses" | "wishlist" | "account";

export default function Dashboard() {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ tab?: string; orderId?: string }>();
  const activeTab = (params.tab as Tab) ?? "overview";

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <StoreLoader />
        </div>
        <Footer />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center py-20">
          <div>
            <User className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <h2 className="font-display text-xl font-bold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-6">Please sign in to access your dashboard.</p>
            <Button
              className="bg-[var(--brand)] text-white hover:opacity-90"
              onClick={() => (window.location.href = getLoginUrl("/dashboard"))}
            >
              Sign In
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const navItems: { id: Tab; label: string; icon: React.ElementType; href: string }[] = [
    { id: "overview", label: "Overview", icon: ShoppingBag, href: "/dashboard" },
    { id: "orders", label: "My Orders", icon: Package, href: "/dashboard/orders" },
    { id: "addresses", label: "Addresses", icon: MapPin, href: "/dashboard/addresses" },
    { id: "wishlist", label: "Wishlist", icon: Heart, href: "/dashboard/wishlist" },
    { id: "account", label: "Account", icon: User, href: "/dashboard/account" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="container py-8 flex-1">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-card border border-border rounded-xl p-5 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--brand)]/10 flex items-center justify-center">
                  <span className="font-display font-bold text-[var(--brand)]">
                    {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{user?.name ?? "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <Link key={item.id} href={item.href}>
                    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      activeTab === item.id
                        ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}>
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </div>
                  </Link>
                ))}
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <div className="lg:col-span-3">
            {activeTab === "overview" && <DashboardOverview />}
            {activeTab === "orders" && (
              params.orderId ? <OrderDetail orderId={parseInt(params.orderId)} /> : <OrdersList />
            )}
            {activeTab === "addresses" && <AddressesTab />}
          {activeTab === "wishlist" && <WishlistTab />}
            {activeTab === "account" && <AccountTab user={user} />}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function DashboardOverview() {
  const { data: orders, isLoading } = trpc.orders.myOrders.useQuery(undefined, {
    refetchInterval: 10000, // Quietly check for updates every 10 seconds
  });

  const stats = {
    total: orders?.length ?? 0,
    pending: orders?.filter((o) => o.status === "pending" || o.status === "processing").length ?? 0,
    delivered: orders?.filter((o) => o.status === "delivered").length ?? 0,
    spent: orders?.reduce((s, o) => s + parseFloat(o.total), 0) ?? 0,
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold">Dashboard Overview</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: stats.total, icon: Package, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30" },
          { label: "Active Orders", value: stats.pending, icon: Truck, color: "text-orange-500 bg-orange-50 dark:bg-orange-950/30" },
          { label: "Delivered", value: stats.delivered, icon: CheckCircle, color: "text-green-500 bg-green-50 dark:bg-green-950/30" },
          { label: "Total Spent", value: formatPrice(stats.spent), icon: CreditCard, color: "text-purple-500 bg-purple-50 dark:bg-purple-950/30" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
              <stat.icon className="w-4.5 h-4.5" />
            </div>
            <p className="font-display font-bold text-xl">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold">Recent Orders</h2>
          <Link href="/dashboard/orders" className="text-xs text-[var(--brand)] hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : orders && orders.length > 0 ? (
          <div className="space-y-2">
            {orders.slice(0, 5).map((order) => (
              <Link key={order.id} href={`/dashboard/orders/${order.id}`}>
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div>
                    <p className="text-sm font-medium font-mono">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs ${getOrderStatusColor(order.status)}`}>
                      {getOrderStatusLabel(order.status)}
                    </Badge>
                    <span className="text-sm font-semibold">{formatPrice(order.total)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No orders yet</p>
            <Link href="/products">
              <Button size="sm" className="mt-3 bg-[var(--brand)] text-white hover:opacity-90">Start Shopping</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Orders List ──────────────────────────────────────────────────────────────
function OrdersList() {
  const { data: orders, isLoading } = trpc.orders.myOrders.useQuery(undefined, {
    refetchInterval: 10000, // Quietly check for updates every 10 seconds
  });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold">My Orders</h1>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : orders && orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/dashboard/orders/${order.id}`}>
              <div className="bg-card border border-border rounded-xl p-4 hover:border-[var(--brand)]/30 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono font-semibold text-sm">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(order.createdAt).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{order.paymentMethod ?? "—"} payment</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold">{formatPrice(order.total)}</p>
                    <Badge className={`text-xs mt-1 ${getOrderStatusColor(order.status)}`}>
                      {getOrderStatusLabel(order.status)}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-[var(--brand)]">
                  View Details <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No orders yet</p>
          <Link href="/products">
            <Button size="sm" className="mt-4 bg-[var(--brand)] text-white hover:opacity-90">Browse Products</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Order Detail ─────────────────────────────────────────────────────────────
function OrderDetail({ orderId }: { orderId: number }) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.orders.detail.useQuery({ orderId }, {
    refetchInterval: 5000, // Fast polling (5s) for live order tracking!
  });
  const { data: settings } = trpc.settings.public.useQuery({ keys: ["appearance", "general"] });

  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  const cancelOrder = trpc.orders.cancel.useMutation({
    onSuccess: () => {
      toast.success("Order cancelled successfully.");
      utils.orders.detail.invalidate({ orderId });
      utils.orders.myOrders.invalidate();
      setIsCancelModalOpen(false);
      setCancellationReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const syncCart = trpc.cart.syncFromGuest.useMutation();

  useEffect(() => {
    if (!data?.order || (data.order.status !== "shipped" && data.order.status !== "out_for_delivery")) return;

    // Adjust URL to point to your FastAPI backend
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/delivery/${orderId}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const loc = JSON.parse(event.data);
        if (loc.lat && loc.lng) {
          const position = { lat: parseFloat(loc.lat), lng: parseFloat(loc.lng) };
          setDriverLocation(position);
          
          if (mapRef.current && window.google) {
            mapRef.current.panTo(position); // Auto-center map on the moving driver
            
            if (!markerRef.current) {
              const truckIcon = document.createElement("div");
              truckIcon.innerHTML = "🚚";
              truckIcon.className = "bg-white p-2 rounded-full shadow-lg text-2xl border-2 border-[var(--brand)] flex items-center justify-center transition-all duration-1000 ease-linear";
              
              markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
                map: mapRef.current,
                position,
                content: truckIcon,
                title: "Delivery Driver"
              });
            } else {
              markerRef.current.position = position;
              if (loc.heading && markerRef.current.content) {
                (markerRef.current.content as HTMLElement).style.transform = `rotate(${loc.heading}deg)`;
              }
            }
          }
        }
      } catch (e) {
        console.error("WebSocket message error:", e);
      }
    };
    
    return () => ws.close();
  }, [data?.order?.status, orderId]);

  if (isLoading) return <div className="flex items-center justify-center py-20"><StoreLoader /></div>;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Order not found</div>;

  const { order, items, history, payment, agent } = data;

  const handleGenerateReceipt = () => {
    const storeName = settings?.general?.storeName || "Store";
    const logoUrl = settings?.appearance?.logoUrl;
    const address = settings?.general?.address || "123 Innovation Drive, Suite 100, Tech City";
  const contactEmail = settings?.general?.contactEmail || "support@company.com";
    const heroTitle = settings?.general?.heroTitle || "Premium Tech, Exceptional Performance";
    const heroDescription = settings?.general?.heroDescription || "Discover the latest laptops, desktops, and accessories from the world's leading brands.";
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return toast.error("Please allow popups to print receipts");

    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${storeName}" style="max-height: 40px; max-width: 150px; margin-bottom: 4px;" />` : `<h2 style="margin:0 0 4px 0;font-size:20px;">${storeName}</h2>`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt #${order.orderNumber}</title>
        <style>
          @page { margin: 0; }
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body { font-family: 'Inter', system-ui, sans-serif; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.5; }
          .invoice-container { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px; margin-bottom: 20px; }
          .invoice-title { font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.025em; margin: 0; }
          .invoice-number { color: #6b7280; font-size: 16px; margin-top: 4px; }
          .store-info p { color: #6b7280; font-size: 13px; margin: 4px 0 0 0; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; padding: 16px; background: #f9fafb; border-radius: 8px; }
          .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.05em; margin-bottom: 8px; }
          .details-text { font-size: 13px; color: #374151; }
          .details-text strong { color: #111827; font-weight: 600; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 20px; }
          th { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
          td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151; }
          .text-right { text-align: right; }
          .totals { width: 280px; margin-left: auto; background: #f9fafb; padding: 16px; border-radius: 8px; }
          .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #4b5563; }
          .totals-row.bold { font-weight: 700; font-size: 16px; color: #111827; border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 6px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
          .badge-paid { background: #d1fae5; color: #065f46; }
          .badge-pending { background: #fef3c7; color: #92400e; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="invoice-container">
          <div class="header">
            <div>
              <div class="invoice-title">RECEIPT</div>
              <div class="invoice-number">#${order.orderNumber}</div>
            </div>
            <div class="text-right store-info">
              ${logoHtml}
              <p>${address.replace(/,/g, '<br/>')}<br/>${contactEmail}</p>
            </div>
          </div>
          <div class="details">
            <div>
              <div class="section-title">Billed To</div>
              <div class="details-text">
                <strong>${order.shippingFullName}</strong><br/>
                ${order.shippingAddress}<br/>
                ${order.shippingCity}${order.shippingPostalCode ? ', ' + order.shippingPostalCode : ''}<br/>
                ${order.shippingCountry}<br/>
                ${order.shippingPhone}<br/>
                ${user?.email || ''}
              </div>
            </div>
            <div class="text-right">
              <div class="section-title">Order Details</div>
              <div class="details-text">
                Date: <strong>${new Date(order.createdAt).toLocaleDateString()}</strong><br/>
                Status: <strong>${order.status.replace(/_/g, ' ').toUpperCase()}</strong><br/>
                Method: <strong>${order.paymentMethod ? order.paymentMethod.toUpperCase() : 'N/A'}</strong><br/>
                ${(payment?.transactionId || order.paymentReference) ? `Transaction ID: <strong style="font-family: monospace; font-size: 12px; word-break: break-all;">${payment?.transactionId || order.paymentReference}</strong><br/>` : ''}
                <div style="margin-top: 8px;">
                  <span class="badge ${order.paymentStatus === 'paid' ? 'badge-paid' : 'badge-pending'}">${order.paymentStatus}</span>
                </div>
              </div>
            </div>
          </div>
          <table>
            <thead><tr><th>Description</th><th class="text-right">Price</th><th class="text-right">Qty</th><th class="text-right">Total</th></tr></thead>
            <tbody>
              ${items.map((item: any) => `<tr><td><strong>${item.productName}</strong></td><td class="text-right">${formatPrice(item.price)}</td><td class="text-right">${item.quantity}</td><td class="text-right">${formatPrice(item.subtotal)}</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="totals">
            <div class="totals-row"><span>Subtotal</span><span>${formatPrice(order.subtotal)}</span></div>
            <div class="totals-row"><span>Shipping</span><span>${formatPrice(order.shippingCost)}</span></div>
            <div class="totals-row bold"><span>Total</span><span>${formatPrice(order.total)}</span></div>
          </div>
          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 4px 0;">${heroTitle}</p>
            <p style="font-size: 12px; color: #6b7280; margin: 0;">${heroDescription}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleReorder = async () => {
    if (!data) return;
    try {
      if (isAuthenticated) {
        await syncCart.mutateAsync(data.items.map((i: any) => ({
          productId: i.productId,
          quantity: i.quantity,
        })));
        utils.cart.get.invalidate();
      }
      toast.success("Items added to your cart!");
      navigate("/cart");
    } catch (err: any) {
      toast.error(err.message || "Failed to reorder items.");
    }
  };

  const trackingStages = [
    "pending",
    "payment_confirmed",
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
  ];
  const currentStageIndex = trackingStages.indexOf(order.status);

  return (
    <div className="space-y-5 relative">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/orders" className="text-sm text-muted-foreground hover:text-foreground">
            ← Orders
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-mono">{order.orderNumber}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {["pending", "payment_confirmed", "processing"].includes(order.status) && (
            <Button variant="destructive" size="sm" onClick={() => setIsCancelModalOpen(true)} disabled={cancelOrder.isPending} className="gap-2">
              <XCircle className="w-4 h-4" /> {cancelOrder.isPending ? "Cancelling..." : "Cancel Order"}
            </Button>
          )}
          {["delivered", "cancelled", "refunded"].includes(order.status) && (
            <Button variant="default" size="sm" onClick={handleReorder} disabled={syncCart.isPending} className="gap-2 bg-[var(--brand)] text-white hover:opacity-90">
              <RefreshCw className="w-4 h-4" /> {syncCart.isPending ? "Adding..." : "Reorder"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleGenerateReceipt} className="gap-2">
            <Printer className="w-4 h-4" /> Print Receipt
          </Button>
        </div>
      </div>

      {/* Tracking timeline */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-display font-semibold mb-5 flex items-center gap-2">
          <Truck className="w-4.5 h-4.5 text-[var(--brand)]" /> Order Tracking
        </h2>
        <div className="relative">
          <div className="flex justify-between mb-2">
            {trackingStages.map((stage, i) => (
              <div key={stage} className="flex flex-col items-center gap-1.5 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                  i <= currentStageIndex
                    ? "bg-[var(--brand)] border-[var(--brand)] text-white"
                    : "border-border bg-background"
                }`}>
                  {i < currentStageIndex ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                </div>
                <span className="text-[10px] text-center text-muted-foreground hidden sm:block leading-tight">
                  {getOrderStatusLabel(stage)}
                </span>
              </div>
            ))}
          </div>
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-border -z-10">
            <div
              className="h-full bg-[var(--brand)] transition-all duration-500 progress-indicator"
              style={{ "--progress-width": `${(Math.max(0, currentStageIndex) / (trackingStages.length - 1)) * 100}%` } as React.CSSProperties}
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {history.map((h, i) => (
            <div key={h.id} className="flex gap-2.5 text-sm">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${i === history.length - 1 ? "bg-[var(--brand)]" : "bg-green-500"}`} />
              <div>
                <span className="font-medium">{getOrderStatusLabel(h.status)}</span>
                {h.note && <span className="text-muted-foreground ml-1.5">— {h.note}</span>}
                <span className="text-xs text-muted-foreground ml-1.5">{new Date(h.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Delivery Tracking */}
      {(order.status === "shipped" || order.status === "out_for_delivery") && (
        <div className="bg-card border border-border rounded-xl p-5 mt-5 shadow-sm">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-4.5 h-4.5 text-[var(--brand)]" /> Live Delivery Tracking
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              <div className="p-4 bg-muted/40 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Delivery Agent</p>
                <p className="font-medium text-foreground">{agent?.name || "Assigned Driver"}</p>
                <p className="text-sm text-muted-foreground mt-1">Vehicle: {agent?.vehicleNumber || "Pending"}</p>
                <Button variant="outline" className="w-full mt-3 gap-2 hover:bg-[var(--brand)] hover:text-white transition-colors" onClick={() => window.open(`tel:${agent?.phone || ""}`)} disabled={!agent?.phone}>
                  <Phone className="w-4 h-4" /> Call Agent
                </Button>
              </div>
              <div className="p-4 bg-muted/40 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Delivery OTP</p>
                <p className="font-mono text-2xl font-bold tracking-widest text-[var(--brand)]">{order.deliveryOtp || "----"}</p>
                <p className="text-xs text-muted-foreground mt-1">Provide this code to the agent upon arrival.</p>
              </div>
            </div>
            <div className="md:col-span-2 rounded-lg overflow-hidden border border-border h-[280px] bg-muted relative">
              <MapView 
                initialZoom={14} 
                onMapReady={(map) => {
                  mapRef.current = map;
                  if (driverLocation) map.setCenter(driverLocation);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-display font-semibold mb-4">Items</h2>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 items-center">
              {item.productImage && (
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                  <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.productName}</p>
                <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {formatPrice(item.price)}</p>
              </div>
              <p className="text-sm font-semibold">{formatPrice(item.subtotal)}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-4 pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{parseFloat(order.shippingCost) === 0 ? "Free" : formatPrice(order.shippingCost)}</span></div>
          <div className="flex justify-between font-display font-bold text-base pt-1 border-t border-border"><span>Total</span><span>{formatPrice(order.total)}</span></div>
        </div>
      </div>

      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={(e) => { e.preventDefault(); cancelOrder.mutate({ orderNumber: order.orderNumber, reason: cancellationReason }); }}>
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-bold">Cancel Order</h3>
                <p className="text-sm text-muted-foreground">Are you sure you want to cancel this order? This action cannot be undone.</p>
                <div className="space-y-2">
                  <Label htmlFor="cancellationReason">Reason for cancellation (optional)</Label>
                  <Textarea
                    id="cancellationReason"
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="e.g., Ordered by mistake, found a better price, etc."
                    autoFocus
                  />
                </div>
              </div>
              <div className="p-4 bg-muted/40 border-t border-border flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsCancelModalOpen(false)}>
                  Back
                </Button>
                <Button type="submit" variant="destructive" disabled={cancelOrder.isPending}>
                  {cancelOrder.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling...</> : "Confirm Cancellation"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Addresses ────────────────────────────────────────────────────────────────
function AddressesTab() {
  const { data: addresses, isLoading } = trpc.addresses.list.useQuery();
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", addressLine: "", city: "", postalCode: "", country: "", isDefault: false });

  const createAddress = trpc.addresses.create.useMutation({
    onSuccess: () => {
      utils.addresses.list.invalidate();
      setShowForm(false);
      setForm({ fullName: "", phone: "", addressLine: "", city: "", postalCode: "", country: "", isDefault: false });
      toast.success("Address saved!");
    },
    onError: () => toast.error("Failed to save address"),
  });

  const deleteAddress = trpc.addresses.delete.useMutation({
    onSuccess: () => { utils.addresses.list.invalidate(); toast.success("Address deleted"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Saved Addresses</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-[var(--brand)] text-white hover:opacity-90 gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Address
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display font-semibold text-sm mb-4">New Address</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Full Name</Label><Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <div className="sm:col-span-2 space-y-1"><Label>Address</Label><Input value={form.addressLine} onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))} /></div>
            <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Postal Code</Label><Input value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} /></div>
            <div className="sm:col-span-2 space-y-1"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => createAddress.mutate(form)} disabled={createAddress.isPending} className="bg-[var(--brand)] text-white hover:opacity-90">Save</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : addresses && addresses.length > 0 ? (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <MapPin className="w-4 h-4 text-[var(--brand)] mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{addr.fullName}</p>
                  <p className="text-sm text-muted-foreground">{addr.addressLine}, {addr.city}{addr.postalCode ? `, ${addr.postalCode}` : ""}, {addr.country}</p>
                  <p className="text-xs text-muted-foreground">{addr.phone}</p>
                  {addr.isDefault && <Badge className="text-xs mt-1 bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/20">Default</Badge>}
                </div>
              </div>
              <button onClick={() => deleteAddress.mutate({ addressId: addr.id })} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete address">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
          <MapPin className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No saved addresses yet</p>
        </div>
      )}
    </div>
  );
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────
function WishlistTab() {
  const { data: items, isLoading } = trpc.wishlist.get.useQuery();

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold">My Wishlist</h1>
      
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <ProductCard key={item.product.id} product={item.product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
          <Heart className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Your wishlist is empty</p>
          <Link href="/products">
            <Button size="sm" className="mt-4 bg-[var(--brand)] text-white hover:opacity-90">Browse Products</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Account ──────────────────────────────────────────────────────────────────
function AccountTab({ user }: { user: any }) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold">Account Settings</h1>
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-[var(--brand)]/10 flex items-center justify-center">
            <span className="font-display font-bold text-xl text-[var(--brand)]">
              {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
            </span>
          </div>
          <div>
            <p className="font-display font-bold text-lg">{user?.name ?? "User"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Badge className="text-xs mt-1 capitalize">{user?.role ?? "user"}</Badge>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{user?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email ?? "—"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Member Since</span>
            <span className="font-medium">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Last Sign In</span>
            <span className="font-medium">{user?.lastSignedIn ? new Date(user.lastSignedIn).toLocaleDateString() : "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
