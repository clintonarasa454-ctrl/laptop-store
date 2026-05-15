import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getOrderStatusColor, getOrderStatusLabel, formatPrice, addToGuestCart } from "@/lib/cart";
import { Loader2, Package, Search, Truck, Printer, MapPin, XCircle, RefreshCw, Star } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveDeliveryMap } from "@/components/Map";
import { toast } from "sonner";
import { useAuth } from "@/pages/useAuth";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function OrderTrackingDisplay({ orderNumber }: { orderNumber: string }) {
  const { data, isLoading, error } = trpc.orders.byNumber.useQuery(
    { orderNumber },
    { staleTime: 1000 * 60 * 2 } // Cache order details for 2 minutes to prevent rapid refetches
  );
  const { data: settings } = trpc.settings.public.useQuery({ keys: ["appearance", "general"] });
  const utils = trpc.useUtils();
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [deliveryETA, setDeliveryETA] = useState<string | null>(null);
  const [deliveryDistance, setDeliveryDistance] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Get driver location using tRPC polling
  // This will automatically start polling when order enters out_for_delivery status
  const { data: driverLocationData, refetch: refetchDriverLocation } = trpc.fleet.getDriverLocation.useQuery(
    { orderId: data?.order?.id || 0 },
    {
      enabled: !!data?.order?.id && (data.order.status === "shipped" || data.order.status === "out_for_delivery"),
      refetchInterval: 5000, // Poll every 5 seconds for live tracking
      staleTime: 2000, // Consider data stale after 2 seconds to encourage refetches
    }
  );

  // Update driver location when data changes
  useEffect(() => {
    const newLat = driverLocationData?.driverLocation?.lat;
    const newLng = driverLocationData?.driverLocation?.lng;
    
    if (newLat && newLng) {
      setDriverLocation(prev => {
        if (prev?.lat === newLat && prev?.lng === newLng) return prev;
        console.log("📍 Driver location updated:", { lat: newLat, lng: newLng, cached: driverLocationData.cached });
        return { lat: newLat, lng: newLng };
      });
    } else if (data?.order?.status === "out_for_delivery" && !driverLocationData?.driverLocation) {
      console.log("⏳ Waiting for driver location update...", { orderId: data.order.id, agentId: driverLocationData?.agentId });
    }
  }, [driverLocationData, data?.order?.id, data?.order?.status]);

  // Force refetch when order status changes to out_for_delivery
  useEffect(() => {
    if (data?.order?.status === "out_for_delivery" && !driverLocationData?.driverLocation) {
      console.log("🔄 Order is out for delivery, forcing location refetch...");
      // Refetch immediately instead of waiting for next interval
      refetchDriverLocation();
    }
  }, [data?.order?.status]);

  const handlePrintInvoice = () => {
    if (!data || !settings) return toast.error("Details not loaded yet.");
    const { order, items } = data;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return toast.error("Please allow popups to print invoices");

    const logoHtml = settings.appearance?.logoUrl ? `<img src="${settings.appearance.logoUrl}" alt="${settings.general?.storeName}" style="max-height: 40px; margin-bottom: 1rem;" />` : `<h2>${settings.general?.storeName}</h2>`;

    const html = `
      <html><head><title>Invoice #${order.orderNumber}</title><style>body{font-family:sans-serif;padding:2rem;}.item{display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid #eee}</style></head><body>
      ${logoHtml}<h1>Invoice #${order.orderNumber}</h1><p>Date: ${new Date(order.createdAt).toLocaleDateString()}</p>
      <p><strong>To:</strong> ${order.shippingFullName}<br/>${order.shippingAddress}, ${order.shippingCity}</p>
      <hr/>
      ${items.map(item => `<div class="item"><span>${item.productName} (x${item.quantity})</span><span>${formatPrice(item.price)}</span></div>`).join('')}
      <hr/>
      <p>Subtotal: ${formatPrice(order.subtotal)}</p><p>Shipping: ${formatPrice(order.shippingCost)}</p>
      <h3>Total: ${formatPrice(order.total)}</h3>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  // Convert raw route duration in seconds into a readable ETA string
  const handleRouteCalculated = (distance: number, duration: number) => {
    if (!duration || isNaN(duration)) return;
    const minutes = Math.round(duration / 60);
    if (minutes < 60) {
      setDeliveryETA(`~${minutes} min${minutes !== 1 ? 's' : ''}`);
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMins = minutes % 60;
      setDeliveryETA(`~${hours} hr${hours !== 1 ? 's' : ''} ${remainingMins > 0 ? `${remainingMins} min` : ''}`.trim());
    }

    if (distance && !isNaN(distance)) {
      const distanceKm = (distance / 1000).toFixed(1);
      setDeliveryDistance(`${distanceKm} km`);
    }
  };

  const cancelOrder = trpc.orders.cancel.useMutation({
    onSuccess: () => {
      toast.success("Order cancelled successfully.");
      utils.orders.byNumber.invalidate({ orderNumber });
      setIsCancelModalOpen(false);
      setCancellationReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const syncCart = trpc.cart.syncFromGuest.useMutation();

  const handleReorder = async () => {
    if (!data) return;
    try {
      if (isAuthenticated) {
        await syncCart.mutateAsync(data.items.map((i: any) => ({
          productId: i.productId,
          quantity: i.quantity,
        })));
        utils.cart.get.invalidate();
      } else {
        data.items.forEach((item: any) => {
          addToGuestCart({
            id: item.productId,
            name: item.productName,
            price: item.price,
            images: item.productImage ? [item.productImage] : [],
            slug: "",
            stock: 1,
          }, item.quantity);
        });
        window.dispatchEvent(new Event("guestCartUpdated"));
      }
      toast.success("Items added to your cart!");
      navigate("/cart");
    } catch (err: any) {
      toast.error(err.message || "Failed to reorder items.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 animate-in fade-in">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-muted"></div>
          <div className="w-12 h-12 rounded-full border-4 border-[var(--brand)] border-t-transparent animate-spin absolute inset-0"></div>
        </div>
        <p className="text-muted-foreground font-medium animate-pulse tracking-wide">Locating your order...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 animate-in fade-in duration-500">
        <Card className="max-w-md mx-auto p-10 text-center border-dashed border-2 shadow-sm bg-muted/10">
          <div className="w-20 h-20 mx-auto mb-6 bg-muted/50 flex items-center justify-center rounded-full">
            <Search className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-3 text-foreground">Order Not Found</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">We couldn't find an order matching that number. Please verify the number and try again.</p>
          <Button onClick={() => navigate("/track-order")} className="bg-[var(--brand)] text-white hover:opacity-90 px-8 h-11 rounded-lg font-semibold shadow-md">
            Try Another Number
          </Button>
        </Card>
      </div>
    );
  }

  const { order, history } = data;
  const isLive = order.status === 'out_for_delivery';

  return (
    <>
      <Card className="p-0 overflow-hidden shadow-xl border-border/60">
      {/* Header Block */}
      <div className="bg-muted/30 p-6 sm:px-8 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Order Number</p>
          <h2 className="font-mono font-bold text-xl text-foreground flex items-center gap-3">
            {order.orderNumber}
            <Badge className={`text-xs ${getOrderStatusColor(order.status)} shadow-sm`}>{getOrderStatusLabel(order.status)}</Badge>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {["pending", "payment_confirmed", "processing"].includes(order.status) && (
            <Button variant="destructive" size="sm" onClick={() => setIsCancelModalOpen(true)} disabled={cancelOrder.isPending} className="gap-2 shadow-sm font-medium">
              <XCircle className="w-4 h-4" /> {cancelOrder.isPending ? "Cancelling..." : "Cancel Order"}
            </Button>
          )}
          {["delivered", "cancelled", "refunded"].includes(order.status) && (
            <Button variant="default" size="sm" onClick={handleReorder} disabled={syncCart.isPending} className="gap-2 bg-[var(--brand)] text-white hover:opacity-90 shadow-sm font-medium">
              <RefreshCw className="w-4 h-4" /> {syncCart.isPending ? "Adding..." : "Reorder"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrintInvoice} className="gap-2 shadow-sm bg-background hover:bg-muted font-medium"><Printer className="w-4 h-4" /> Invoice</Button>
        </div>
      </div>

      {/* Body Block */}
      <div className="p-6 sm:p-8 space-y-8">
        {/* Information Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="p-5 rounded-2xl border border-border/50 bg-background shadow-sm space-y-1.5">
            <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2.5"><Truck className="w-4 h-4" /> Estimated Delivery</p>
            <p className="font-bold text-lg text-foreground">
              {order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "Calculating..."}
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-border/50 bg-background shadow-sm space-y-1.5">
             <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2.5"><MapPin className="w-4 h-4" /> Shipping Address</p>
             <p className="font-semibold text-sm text-foreground truncate" title={`${order.shippingAddress}, ${order.shippingCity}`}>{order.shippingAddress}, {order.shippingCity}</p>
             <p className="text-xs text-muted-foreground font-medium">{order.shippingFullName}</p>
          </div>
        </div>

        {/* Live Map Area */}
        {isLive && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-lg flex items-center gap-2.5 text-foreground"><MapPin className="w-5 h-5 text-[var(--brand)]" /> Live Location Tracking</h3>
              <div className="flex items-center gap-2.5">
                {deliveryDistance && (
                  <Badge variant="outline" className="bg-muted text-foreground border-border shadow-sm font-bold px-3 py-1.5 text-sm animate-in fade-in zoom-in duration-300">
                    {deliveryDistance} away
                  </Badge>
                )}
                {deliveryETA && (
                  <Badge variant="outline" className="bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/20 shadow-sm font-bold px-3 py-1.5 text-sm animate-in fade-in zoom-in duration-300">
                    ETA: {deliveryETA}
                  </Badge>
                )}
              </div>
            </div>
            <div className="h-[750px] sm:h-[1000px] rounded-2xl overflow-hidden border border-border/50 shadow-inner relative bg-muted">
              <LiveDeliveryMap
                className="absolute inset-0 w-full h-full rounded-none border-0"
                destinationAddress={
                  [order.shippingAddress, order.shippingCity, order.shippingCounty, order.shippingCountry]
                    .filter(p => {
                      if (!p) return false;
                      const str = String(p).trim();
                      // Filter out empty strings, "undefined", "null", "na", "n/a" (case-insensitive)
                      return str.length > 0 && !/^(undefined|null|na|n\/a)$/i.test(str);
                    })
                    .join(", ")
                }
                driverLat={driverLocation?.lat}
                driverLng={driverLocation?.lng}
                onRouteCalculated={handleRouteCalculated}
              />
            </div>
          </div>
        )}

        {/* Tracking Timeline */}
        <div className="pt-2">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2.5 text-foreground"><Truck className="w-5 h-5 text-[var(--brand)]" /> Tracking History</h3>
          <div className="space-y-0 mt-2">
            {history.map((h, i) => {
              const isActive = i === history.length - 1;
              return (
                <div key={h.id} className="flex gap-5 group">
                  <div className="flex flex-col items-center shrink-0 pt-2">
                    <div className={`w-4 h-4 rounded-full border-[3px] transition-all duration-300 z-10 ${
                      isActive 
                        ? "bg-background border-[var(--brand)] ring-4 ring-[var(--brand)]/20 shadow-sm" 
                        : "bg-green-500 border-green-500"
                    }`} />
                    {i < history.length - 1 && <div className="w-0.5 grow min-h-[3.5rem] bg-border mt-2 mb-2 rounded-full" />}
                  </div>
                  <div className={`flex-1 p-4 mb-4 rounded-xl border transition-all duration-300 ${
                    isActive ? 'border-[var(--brand)]/30 bg-[var(--brand)]/5 shadow-sm' : 'border-transparent hover:bg-muted/40'
                  }`}>
                    <p className={`text-sm font-bold ${isActive ? 'text-[var(--brand)]' : 'text-foreground'}`}>
                      {getOrderStatusLabel(h.status)}
                    </p>
                    {h.note && <p className="text-sm mt-1.5 text-muted-foreground leading-relaxed">{h.note}</p>}
                    <p className="text-xs text-muted-foreground mt-2 font-medium">
                      {new Date(h.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
              </div>
              )
            })}
          </div>
        </div>

        {/* Driver Rating */}
        {order.status === "delivered" && !ratingSubmitted && (
          <div className="bg-card border border-border rounded-xl p-6 mt-8 shadow-sm text-center animate-in fade-in slide-in-from-bottom-4">
            <div className="w-12 h-12 rounded-full bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-3">
              <Star className="w-6 h-6 text-[var(--brand)]" />
            </div>
            <h3 className="font-bold text-lg mb-1">Rate your delivery</h3>
            <p className="text-sm text-muted-foreground mb-4">How was your delivery experience?</p>
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
      </div>
    </Card>

    {isCancelModalOpen && (
      <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsCancelModalOpen(false)}>
        <Card className="w-full max-w-md shadow-2xl border-border overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
          <form onSubmit={(e) => { e.preventDefault(); cancelOrder.mutate({ orderNumber, reason: cancellationReason }); }}>
            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-xl font-bold font-display text-foreground">Cancel Order</h3>
                <p className="text-sm text-muted-foreground mt-1">Are you sure you want to cancel this order? This action cannot be undone.</p>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="cancellationReason" className="text-sm font-semibold">Reason for cancellation (optional)</Label>
                <Textarea
                  id="cancellationReason"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g., Ordered by mistake, found a better price, etc."
                  className="resize-none h-24 bg-background"
                  autoFocus
                  disabled={cancelOrder.isPending}
                />
              </div>
            </div>
            <div className="p-5 bg-muted/40 border-t border-border flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsCancelModalOpen(false)} className="font-semibold" disabled={cancelOrder.isPending}>
                Keep Order
              </Button>
              <Button type="submit" variant="destructive" disabled={cancelOrder.isPending} className="font-semibold">
                {cancelOrder.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling...</> : "Confirm Cancellation"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    )}
    </>
  );
}

export default function OrderTracking() {
  const { orderNumber } = useParams<{ orderNumber?: string }>();
  const [, navigate] = useLocation();
  const [inputOrderNumber, setInputOrderNumber] = useState("");

  const handleTrackOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputOrderNumber.trim()) {
      navigate(`/track-order/${inputOrderNumber.trim()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="container flex-1 py-12 lg:py-20 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl lg:text-4xl font-bold mb-3 tracking-tight">Track Your Order</h1>
          <p className="text-muted-foreground text-lg">Enter your order number below to receive real-time updates.</p>
        </div>

        {!orderNumber && (
          <Card className="p-8 max-w-xl mx-auto shadow-xl border-border/50 bg-card/50 backdrop-blur-sm">
            <form onSubmit={handleTrackOrder} className="flex flex-col sm:flex-row gap-4">
              <Input
                value={inputOrderNumber}
                onChange={(e) => setInputOrderNumber(e.target.value)}
                placeholder="Enter your order number (e.g., ORD-...)"
                className="h-14 text-base rounded-xl bg-background shadow-inner focus-visible:ring-[var(--brand)]"
                required
              />
              <Button type="submit" className="h-14 px-8 rounded-xl bg-[var(--brand)] text-white hover:opacity-90 gap-2 shadow-md hover:shadow-lg transition-all font-semibold text-base shrink-0">
                <Search className="w-5 h-5" /> Track Order
              </Button>
            </form>
          </Card>
        )}

        {orderNumber && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={() => navigate("/track-order")} className="text-muted-foreground hover:text-foreground -ml-4 font-semibold">&larr; Track Another Order</Button>
            </div>
            <OrderTrackingDisplay orderNumber={orderNumber} />
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}