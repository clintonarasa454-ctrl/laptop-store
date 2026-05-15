import { useAuth } from "@/pages/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { formatPrice, getOrderStatusColor, getOrderStatusLabel } from "@/lib/cart";
import {
  CheckCircle,
  ChevronRight,
  CreditCard,
  Download,
  Edit2,
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
  MessageSquare,
  Send,
  X,
  ArrowLeft,
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
import { LiveDeliveryMap } from "@/components/Map";

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
                {user?.photoId ? (
                  <img src={user.photoId} alt={user.name || "User"} className="w-10 h-10 rounded-full object-cover border border-border shadow-sm shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--brand)]/10 flex items-center justify-center shrink-0">
                    <span className="font-display font-bold text-[var(--brand)]">
                      {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </span>
                  </div>
                )}
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
    staleTime: 0, // Data is immediately stale for real-time updates
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    refetchOnWindowFocus: true, // Refresh when user focuses the tab
    refetchOnReconnect: true, // Refresh when reconnecting
    refetchOnMount: true, // Always fetch fresh data on mount
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
    staleTime: 0, // Data is immediately stale for real-time updates
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    refetchOnWindowFocus: true, // Refresh when user focuses the tab
    refetchOnReconnect: true, // Refresh when reconnecting
    refetchOnMount: true, // Always fetch fresh data on mount
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
    staleTime: 0, // Data is immediately stale for real-time updates
    refetchInterval: 5000, // Fast polling (5s) for live order tracking
    refetchOnWindowFocus: true, // Refresh when user focuses the tab
    refetchOnReconnect: true, // Refresh when reconnecting
    refetchOnMount: true, // Always fetch fresh data on mount
  });
  const { data: settings } = trpc.settings.public.useQuery({ keys: ["appearance", "general"] });
  
  // Fetch driver location for orders out for delivery
  const { data: driverLocationData, refetch: refetchDriverLocation } = trpc.fleet.getDriverLocation.useQuery(
    { orderId },
    { 
      enabled: !!data?.order?.id && (data?.order?.status === "shipped" || data?.order?.status === "out_for_delivery"),
      staleTime: 0, // Data is immediately stale for real-time updates
      refetchInterval: 3000, // Polling every 3 seconds for live driver location
      refetchOnWindowFocus: true, // Refresh when user focuses the tab
      refetchOnReconnect: true, // Refresh when reconnecting
      refetchOnMount: true, // Always fetch fresh data on mount
    }
  );

  // Force refetch when order status changes to out_for_delivery
  useEffect(() => {
    if (data?.order?.status === "out_for_delivery" && !driverLocationData?.driverLocation) {
      console.log("🔄 Order is out for delivery, forcing location refetch...");
      refetchDriverLocation();
    }
  }, [data?.order?.status, driverLocationData?.driverLocation, refetchDriverLocation]);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [showMapMode, setShowMapMode] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{distance: number, duration: number} | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [isEditAddressModalOpen, setIsEditAddressModalOpen] = useState(false);
  const [editAddressForm, setEditAddressForm] = useState({
    shippingAddress: "",
    shippingCity: "",
    shippingCounty: "",
    shippingPostalCode: "",
    shippingCountry: "",
  });

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

  const updateAddress = trpc.orders.updateShippingAddress.useMutation({
    onSuccess: () => {
      toast.success("Shipping address updated successfully.");
      utils.orders.detail.invalidate({ orderId });
      setIsEditAddressModalOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><StoreLoader /></div>;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Order not found</div>;

  const { order, items, history, payment, agent } = data;
  const isLive = order.status === 'out_for_delivery';

  // ─── FULLSCREEN UBER-STYLE LIVE TRACKING VIEW ───
  if (isLive && showMapMode && driverLocationData?.driverLocation) {
    const etaMins = routeInfo ? Math.ceil(routeInfo.duration / 60) : "--";
    const distKm = routeInfo ? (routeInfo.distance / 1000).toFixed(1) : "--";

    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in fade-in duration-300">
        {/* Top Bar Overlay */}
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
          <Button 
            variant="secondary" 
            className="pointer-events-auto rounded-full shadow-lg gap-2 bg-background/90 backdrop-blur-md hover:bg-background"
            onClick={() => setShowMapMode(false)}
          >
            <ArrowLeft className="w-4 h-4" /> Order Details
          </Button>
          <div className="bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-full shadow-lg pointer-events-auto border border-border flex items-center gap-2.5">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-semibold tracking-wide">Driver on the way</span>
          </div>
        </div>

        {/* Fullscreen Map Layer */}
        <div className="flex-1 relative w-full h-full">
          <LiveDeliveryMap
            className="absolute inset-0 w-full h-full rounded-none border-0 pb-32"
            destinationAddress={`${order.shippingAddress}, ${order.shippingCity}`}
            driverLat={driverLocationData.driverLocation.lat}
            driverLng={driverLocationData.driverLocation.lng}
            onRouteCalculated={(dist, dur) => setRouteInfo({ distance: dist, duration: dur })}
          />
        </div>

        {/* Bottom Floating Card */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 pointer-events-none pb-8 sm:pb-8">
          <div className="max-w-md mx-auto bg-card/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-border overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-10 duration-500">
            {/* ETA & Distance Row */}
            <div className="p-5 flex items-center justify-between border-b border-border/50 bg-muted/10">
              <div className="text-center flex-1">
                <p className="text-3xl font-display font-bold text-foreground tracking-tight">{etaMins} <span className="text-sm text-muted-foreground font-medium">min</span></p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">Arrival Time</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div className="text-center flex-1">
                <p className="text-3xl font-display font-bold text-foreground tracking-tight">{distKm} <span className="text-sm text-muted-foreground font-medium">km</span></p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">Distance</p>
              </div>
            </div>
            {/* Driver Profile Row */}
            <div className="p-5">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center border-[3px] border-blue-100 shrink-0 shadow-inner">
                  <Truck className="w-7 h-7 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-foreground truncate">{agent?.name || "Delivery Driver"}</h3>
                  <p className="text-sm text-muted-foreground truncate">{agent?.vehicleNumber || "Assigned Vehicle"}</p>
                </div>
                {order.deliveryOtp && (
                  <div className="text-right shrink-0 bg-muted/50 p-2 rounded-xl border border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Your PIN</p>
                    <p className="font-mono text-xl font-bold text-[var(--brand)] tracking-widest leading-none">{order.deliveryOtp}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Button 
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl h-12 gap-2 shadow-lg shadow-green-500/20" 
                  onClick={() => window.open(`tel:${agent?.phone || ''}`)}
                >
                  <Phone className="w-5 h-5" /> Call Driver
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
    <div className="space-y-5 relative md:pr-[26rem] lg:pr-[26rem]">
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
        
        {["pending", "payment_confirmed", "processing"].includes(order.status) && (
          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Need to update your delivery address?</p>
              <p className="text-xs text-muted-foreground mt-0.5">You can only change your address before the order ships.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              setEditAddressForm({
                shippingAddress: order.shippingAddress || "",
                shippingCity: order.shippingCity || "",
                shippingCounty: order.shippingCounty || "",
                shippingPostalCode: order.shippingPostalCode || "",
                shippingCountry: order.shippingCountry || "Kenya",
              });
              setIsEditAddressModalOpen(true);
            }}>
              <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit Address
            </Button>
          </div>
        )}
      </div>

      {/* Live Delivery Tracking */}
      {(order.status === "shipped" || order.status === "out_for_delivery") && (
        <div className="bg-card border border-border rounded-xl p-5 mt-5 shadow-sm">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-4.5 h-4.5 text-[var(--brand)]" /> Delivery Information
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              <div className="p-4 bg-muted/40 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Delivery Agent</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{agent?.name || "Assigned Driver"}</p>
                    <p className="text-sm text-muted-foreground mt-1">Vehicle: {agent?.vehicleNumber || "Pending"}</p>
                  </div>
                  {driverLocationData?.driverLocation && (
                    <div className="flex flex-col items-end">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                        <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                        Live
                      </span>
                    </div>
                  )}
                </div>
                <Button variant="outline" className="w-full mt-3 gap-2 hover:bg-[var(--brand)] hover:text-white transition-colors" onClick={() => window.open(`tel:${agent?.phone || ""}`)} disabled={!agent?.phone}>
                  <Phone className="w-4 h-4" /> Call Agent
                </Button>
                {order.status === "out_for_delivery" && (
                  <div className="mt-3">
                    <CustomerDeliveryChat orderId={order.id} driverName={agent?.name} driverPhoto={agent?.photoUrl} />
                  </div>
                )}
              </div>
              <div className="p-4 bg-muted/40 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Delivery OTP</p>
                <p className="font-mono text-2xl font-bold tracking-widest text-[var(--brand)]">{order.deliveryOtp || "----"}</p>
                <p className="text-xs text-muted-foreground mt-1">Provide this code to the agent upon arrival.</p>
              </div>
              <div className="p-4 bg-muted/40 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">📍 Delivery Address</p>
                <div className="space-y-1">
                  <p className="font-medium text-sm text-foreground">{order.shippingFullName}</p>
                  <p className="text-xs text-muted-foreground">{order.shippingAddress}</p>
                  <p className="text-xs text-muted-foreground">{order.shippingCity}, {order.shippingCounty}</p>
                  <p className="text-xs text-muted-foreground">Phone: {order.shippingPhone}</p>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 rounded-lg overflow-hidden border border-border h-[500px] bg-muted relative">
              <LiveDeliveryMap
                className="absolute inset-0 w-full h-full rounded-none border-0"
                destinationAddress={`${order.shippingAddress}, ${order.shippingCity}`}
                driverLat={driverLocationData?.driverLocation?.lat}
                driverLng={driverLocationData?.driverLocation?.lng}
              />
            </div>
          </div>
        </div>
      )}

      {/* Live Tracking Button */}
      {isLive && !showMapMode && driverLocationData?.driverLocation && (
        <div className="bg-card border border-border rounded-xl p-6 mt-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-semibold text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[var(--brand)]" /> Live Delivery Active
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Your driver is currently on the way with your order.</p>
            </div>
            <Button 
              onClick={() => setShowMapMode(true)}
              className="bg-[var(--brand)] text-white hover:opacity-90 gap-2 shrink-0 h-10 px-6 rounded-full shadow-md"
            >
              <MapPin className="w-4 h-4" /> View Live Tracking
            </Button>
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

      {/* Driver Rating */}
      {order.status === "delivered" && agent && !ratingSubmitted && (
        <div className="bg-card border border-border rounded-xl p-6 mt-5 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-3">
            <Star className="w-6 h-6 text-[var(--brand)]" />
          </div>
          <h3 className="font-bold text-lg mb-1">Rate your delivery</h3>
          <p className="text-sm text-muted-foreground mb-4">How was your experience with {agent.name}?</p>
          <div className="flex items-center justify-center gap-2 mb-5">
            {[1, 2, 3, 4, 5].map(star => (
              <Star 
                key={star} 
                className={`w-8 h-8 cursor-pointer transition-all hover:scale-110 ${rating >= star ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} 
                onClick={() => setRating(star)} 
              />
            ))}
          </div>
          <Button 
            onClick={() => { 
              toast.success("Thank you for your feedback!"); 
              setRatingSubmitted(true); 
            }} 
            disabled={rating === 0}
            className="bg-[var(--brand)] text-white px-8"
          >
            Submit Rating
          </Button>
        </div>
      )}

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

      {isEditAddressModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              updateAddress.mutate({ orderId: order.id, ...editAddressForm }); 
            }}>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Update Delivery Address</h3>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditAddressModalOpen(false)}>✕</Button>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Street Address</Label>
                    <Input required value={editAddressForm.shippingAddress} onChange={(e) => setEditAddressForm({ ...editAddressForm, shippingAddress: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>City</Label>
                      <Input required value={editAddressForm.shippingCity} onChange={(e) => setEditAddressForm({ ...editAddressForm, shippingCity: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>County / State</Label>
                      <Input value={editAddressForm.shippingCounty} onChange={(e) => setEditAddressForm({ ...editAddressForm, shippingCounty: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Postal Code</Label>
                      <Input value={editAddressForm.shippingPostalCode} onChange={(e) => setEditAddressForm({ ...editAddressForm, shippingPostalCode: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Country</Label>
                      <Input required value={editAddressForm.shippingCountry} onChange={(e) => setEditAddressForm({ ...editAddressForm, shippingCountry: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-muted/40 border-t border-border flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsEditAddressModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-[var(--brand)] text-white hover:opacity-90" disabled={updateAddress.isPending}>
                  {updateAddress.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Save Address"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Customer Delivery Chat ───────────────────────────────────────────────────
export function CustomerDeliveryChat({ orderId, driverName, driverPhoto }: { orderId: number, driverName?: string, driverPhoto?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();

  // Poll for new messages every 3 seconds while chat is open
  const { data: messages } = trpc.fleet.getDeliveryMessages.useQuery(
    { orderId },
    { 
      enabled: isOpen,
      staleTime: 0, // Data is immediately stale for real-time updates
      refetchInterval: 2000, // Refresh every 2 seconds when chat is open
      refetchOnWindowFocus: true, // Refresh when user focuses the tab
      refetchOnReconnect: true, // Refresh when reconnecting
    }
  );

  const { data: unreadCount } = trpc.fleet.getUnreadDeliveryMessagesCount.useQuery(
    { orderId, userType: "customer" },
    { 
      enabled: !isOpen,
      staleTime: 0, // Data is immediately stale for real-time updates
      refetchInterval: 3000, // Refresh every 3 seconds when chat is closed
      refetchOnWindowFocus: true, // Refresh when user focuses the tab
      refetchOnReconnect: true, // Refresh when reconnecting
    }
  );

  const markAsRead = trpc.fleet.markDeliveryMessagesAsRead.useMutation({
    onSuccess: () => {
      utils.fleet.getUnreadDeliveryMessagesCount.invalidate();
      utils.fleet.getDeliveryMessages.invalidate();
    }
  });

  useEffect(() => {
    if (isOpen && messages) {
      const hasUnread = messages.some((msg: any) => msg.senderType === 'driver' && !msg.isRead);
      if (hasUnread) {
        markAsRead.mutate({ orderId, userType: "customer" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, messages]);

  const sendMessage = trpc.fleet.sendDeliveryMessage.useMutation({
    onSuccess: () => {
      utils.fleet.getDeliveryMessages.invalidate({ orderId });
      setMessage("");
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sendMessage.isPending) return;
    sendMessage.mutate({ orderId, content: message.trim(), senderType: "customer" });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="relative w-full gap-2 bg-[var(--brand)] text-white shadow-md hover:shadow-lg transition-all">
        <MessageSquare className="w-4 h-4" /> Contact Driver
        {unreadCount && unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white shadow-sm">
            {unreadCount}
          </span>
        ) : null}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop - only on small screens */}
          <div className="hidden sm:block fixed inset-0 bg-black/40 z-[105] backdrop-blur-sm animate-in fade-in" onClick={() => setIsOpen(false)} />
          
          {/* Chat Panel - Side panel on desktop, full-screen on mobile */}
          <div className="fixed inset-0 sm:inset-auto sm:fixed sm:right-4 sm:top-1/2 sm:-translate-y-1/2 sm:bottom-auto sm:w-96 sm:h-[80vh] z-[110] flex items-end sm:items-center justify-center p-4 sm:p-0 animate-in sm:animate-in">
            <div className="w-full sm:w-96 h-[85vh] sm:h-[600px] bg-card rounded-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 slide-in-from-bottom-10 sm:slide-in-from-right-5">
              {/* Header */}
              <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--brand)]/10 flex items-center justify-center border border-[var(--brand)]/20 overflow-hidden shrink-0">
                  {driverPhoto ? (
                    <img src={driverPhoto} alt={driverName || "Driver"} className="w-full h-full object-cover" />
                  ) : (
                    <Truck className="w-5 h-5 text-[var(--brand)]" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm">{driverName || "Delivery Driver"}</h3>
                  <p className="text-xs text-muted-foreground">Order #{orderId}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close chat" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4"/>
              </Button>
            </div>
            
            {/* Message History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
              <div className="text-center my-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-muted px-2 py-1 rounded-full">Secure Chat</span>
              </div>
              {(messages || []).map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.senderType === 'customer' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] shadow-sm ${msg.senderType === 'customer' ? 'bg-[var(--brand)] text-white rounded-tr-sm' : 'bg-muted text-foreground border border-border/50 rounded-tl-sm'}`}>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1.5 mx-1 font-medium">
                    {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-border bg-card shrink-0">
              <div className="flex gap-2 overflow-x-auto pb-2 mb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {["Okay, thank you!", "Please leave it at the door.", "I'll be right there."].map(reply => (
                  <button 
                    key={reply} 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      sendMessage.mutate({ orderId, content: reply, senderType: "customer" });
                    }}
                    className="shrink-0 bg-muted hover:bg-[var(--brand)]/10 hover:text-[var(--brand)] text-xs px-3 py-1.5 rounded-full border border-border/50 whitespace-nowrap transition-colors"
                  >
                    {reply}
                  </button>
                ))}
              </div>
              <form className="flex gap-2" onSubmit={handleSend}>
                <Input 
                  placeholder="Message your driver..." 
                  aria-label="Type a message"
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                  disabled={sendMessage.isPending} 
                  className="bg-muted/50 border-transparent focus-visible:ring-2 focus-visible:ring-[var(--brand)]/50 h-11 rounded-xl transition-shadow" 
                  autoFocus 
                />
                <Button type="submit" aria-label="Send message" size="icon" className="bg-[var(--brand)] text-white shrink-0 hover:opacity-90 disabled:opacity-50 h-11 w-11 rounded-xl transition-opacity" disabled={!message.trim() || sendMessage.isPending}>
                  {sendMessage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
                </Button>
              </form>
            </div>
            </div>
          </div>
        </>
      )}
    </>
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
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
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
          {user?.photoId ? (
            <img src={user.photoId} alt={user.name || "User"} className="w-14 h-14 rounded-full object-cover border border-border shadow-sm shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[var(--brand)]/10 flex items-center justify-center shrink-0">
              <span className="font-display font-bold text-xl text-[var(--brand)]">
                {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
              </span>
            </div>
          )}
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
