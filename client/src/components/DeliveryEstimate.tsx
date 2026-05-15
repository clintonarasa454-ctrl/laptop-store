import { trpc } from "@/lib/trpc";
import { MapPin, Truck } from "lucide-react";

export default function DeliveryEstimate({ productId, warehouseId }: { productId: number, warehouseId?: number }) {
  const { data, isLoading } = trpc.products.estimateDelivery.useQuery(
    { productId, warehouseId: warehouseId || 1 },
    { enabled: !!productId }
  );

  if (isLoading) {
    return (
      <div className="flex items-start gap-3 p-4 bg-emerald-50/20 rounded-xl border border-emerald-100/50 mt-4 animate-pulse">
        <div className="w-5 h-5 rounded-full bg-emerald-200/50 mt-0.5 shrink-0"></div>
        <div className="space-y-2.5 flex-1 py-1">
          <div className="h-3.5 bg-emerald-200/50 rounded w-1/3"></div>
          <div className="h-3 bg-emerald-200/50 rounded w-1/2"></div>
          <div className="h-2.5 bg-emerald-200/50 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const deliveryDate = new Date(data.estimatedDate);
  const dateString = deliveryDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="flex items-start gap-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 mt-4">
      <Truck className="w-5 h-5 text-emerald-600 mt-0.5" />
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Delivery Estimate</h4>
        <p className="text-sm text-gray-600 mt-1">
          Arrives in <span className="font-bold text-emerald-700">{data.days} days</span> (by {dateString})
        </p>
        <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Shipping from nearest available warehouse
        </p>
      </div>
    </div>
  );
}