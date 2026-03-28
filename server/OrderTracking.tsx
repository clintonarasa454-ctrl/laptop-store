import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getOrderStatusColor, getOrderStatusLabel } from "@/lib/cart";
import { Loader2, Package, Search, Truck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function OrderTrackingDisplay({ orderNumber }: { orderNumber: string }) {
  const { data, isLoading, error } = trpc.orders.byNumber.useQuery({ orderNumber });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <h2 className="font-display text-xl font-bold mb-2">Order Not Found</h2>
        <p className="text-muted-foreground">Please check the order number and try again.</p>
      </div>
    );
  }

  const { order, history } = data;

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-border">
        <div>
          <p className="text-sm text-muted-foreground">Order Number</p>
          <h2 className="font-mono font-semibold text-lg">{order.orderNumber}</h2>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge className={`text-sm ${getOrderStatusColor(order.status)}`}>
            {getOrderStatusLabel(order.status)}
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Estimated Delivery</p>
          <p className="font-semibold text-lg text-green-600">
            {order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "Not available yet"}
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Truck className="w-5 h-5 text-[var(--brand)]" />
            Tracking History
          </h3>
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