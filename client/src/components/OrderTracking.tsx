import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getOrderStatusColor, getOrderStatusLabel, formatPrice, addToGuestCart } from "@/lib/cart";
import { Loader2, Package, Search, Truck, Printer, MapPin, XCircle, RefreshCw } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapView } from "@/components/Map";
import { toast } from "sonner";
import { useAuth } from "@/pages/useAuth";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function OrderTrackingDisplay({ orderNumber }: { orderNumber: string }) {
  const { data, isLoading, error } = trpc.orders.byNumber.useQuery({ orderNumber });
  const { data: settings } = trpc.settings.public.useQuery({ keys: ["appearance", "general"] });
  const utils = trpc.useUtils();
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  useEffect(() => {
    if (!data?.order || (data.order.status !== "shipped" && data.order.status !== "out_for_delivery")) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/delivery/${data.order.id}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const loc = JSON.parse(event.data);
        if (loc.lat && loc.lng) {
          const position = { lat: parseFloat(loc.lat), lng: parseFloat(loc.lng) };
          setDriverLocation(position);
          
          if (mapRef.current && window.google) {
            mapRef.current.panTo(position);
            
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
      } catch (e) { console.error("WebSocket error:", e); }
    };
    
    return () => ws.close();
  }, [data?.order?.status, data?.order?.id]);

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
            stock: 99,
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
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" /></div>;
  }

  if (error || !data) {
    return (
      <div className="text-center py-20"><Package className="w-16 h-16 mx-auto mb-4 opacity-20" /><h2 className="font-display text-xl font-bold mb-2">Order Not Found</h2><p className="text-muted-foreground">Please check the order number and try again.</p></div>
    );
  }

  const { order, history } = data;
  const isLive = order.status === 'out_for_delivery';

  return (
    <>
      <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-border">
        <div>
          <p className="text-sm text-muted-foreground">Order Number</p>
          <h2 className="font-mono font-semibold text-lg">{order.orderNumber}</h2>
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
          <Button variant="outline" size="sm" onClick={handlePrintInvoice} className="gap-2"><Printer className="w-4 h-4" /> Invoice</Button>
          <div className="text-left sm:text-right">
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className={`text-sm ${getOrderStatusColor(order.status)}`}>{getOrderStatusLabel(order.status)}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {isLive && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><MapPin className="w-5 h-5 text-[var(--brand)]" /> Live Location</h3>
            <div className="h-64 rounded-lg overflow-hidden border border-border bg-muted">
              <MapView 
                initialZoom={15} 
                onMapReady={(map) => { mapRef.current = map; if (driverLocation) map.setCenter(driverLocation); }}
              />
            </div>
          </div>
        )}

        <div>
          <p className="text-sm text-muted-foreground">Estimated Delivery</p>
          <p className="font-semibold text-lg text-green-600">{order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "Not available yet"}</p>
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Truck className="w-5 h-5 text-[var(--brand)]" /> Tracking History</h3>
          <div className="space-y-3">
            {history.map((h, i) => (
              <div key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full border-2 ${i === history.length - 1 ? "bg-[var(--brand)] border-[var(--brand)]" : "bg-green-500 border-green-500"}`} />
                  {i < history.length - 1 && <div className="w-0.5 h-full bg-border mt-1" />}
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
      </div>
    </Card>

    {isCancelModalOpen && (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <Card className="w-full max-w-md shadow-2xl border-border overflow-hidden animate-in zoom-in-95 duration-200">
          <form onSubmit={(e) => { e.preventDefault(); cancelOrder.mutate({ orderNumber, reason: cancellationReason }); }}>
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
      <div className="container flex-1 py-12 lg:py-20 max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl lg:text-4xl font-bold mb-2">Track Your Order</h1>
          <p className="text-muted-foreground">Enter your order number below to see its status.</p>
        </div>

        {!orderNumber && (
          <Card className="p-8">
            <form onSubmit={handleTrackOrder} className="flex flex-col sm:flex-row gap-3">
              <Input
                value={inputOrderNumber}
                onChange={(e) => setInputOrderNumber(e.target.value)}
                placeholder="Enter your order number (e.g., ORD-...)"
                className="h-12 text-base"
                required
              />
              <Button type="submit" className="h-12 px-8 bg-[var(--brand)] text-white hover:opacity-90 gap-2">
                <Search className="w-4 h-4" /> Track
              </Button>
            </form>
          </Card>
        )}

        {orderNumber && <OrderTrackingDisplay orderNumber={orderNumber} />}
      </div>
      <Footer />
    </div>
  );
}