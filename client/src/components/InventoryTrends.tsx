import { useMemo, lazy, Suspense } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { TrendingUp, Clock, AlertTriangle } from "lucide-react";

const InventoryVelocityChart = lazy(() => import("@/components/InventoryVelocityChart"));

export default function InventoryTrends({ timeRange = "30d" }: { timeRange?: string }) {
  const { data: velocity, isLoading: loadingVelocity } = trpc.inventory.velocityTrends.useQuery(
    { timeRange },
    { staleTime: 0, refetchInterval: 5000, refetchOnWindowFocus: true }
  );
  const { data: aging, isLoading: loadingAging } = trpc.inventory.aging.useQuery(
    undefined,
    { staleTime: 0, refetchInterval: 5000, refetchOnWindowFocus: true }
  );

  // Safely map velocity data to standard chart format
  const velocityData = useMemo(() => velocity?.map((v: any) => ({
    name: v.productName || v.name || "Unknown",
    Velocity: parseFloat(Number(v.velocity || v.salesVelocity || v.salesPerDay || 0).toFixed(1))
  })).slice(0, 10) || [], [velocity]);

  if (loadingVelocity || loadingAging) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 shadow-sm border border-gray-100 h-[380px] animate-pulse bg-gray-50/50 flex flex-col">
          <div className="h-6 w-1/3 bg-gray-200 rounded mb-6"></div>
          <div className="flex-1 bg-gray-200/50 rounded-lg"></div>
        </Card>
        <Card className="p-6 shadow-sm border border-gray-100 h-[380px] animate-pulse bg-gray-50/50 flex flex-col">
          <div className="h-6 w-1/3 bg-gray-200 rounded mb-6"></div>
          <div className="flex-1 bg-gray-200/50 rounded-lg"></div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Velocity Trends */}
      <Card className="p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-gray-800">
          <TrendingUp className="w-5 h-5 text-emerald-600" /> Stock Velocity (Fastest Movers)
        </h3>
        <div className="h-[300px]">
          {velocityData.length > 0 ? (
            <Suspense fallback={<div className="h-full flex items-center justify-center text-muted-foreground bg-gray-50 rounded-lg">Loading chart…</div>}>
              <InventoryVelocityChart data={velocityData} />
            </Suspense>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-gray-50 rounded-lg">No velocity data available.</div>
          )}
        </div>
      </Card>

      {/* Aging Inventory */}
      <Card className="p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-gray-800">
          <Clock className="w-5 h-5 text-orange-600" /> Aging Inventory Alerts
        </h3>
        <div className="overflow-x-auto h-[300px] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 sticky top-0 shadow-[0_1px_0_var(--border)]">
              <tr>
                <th className="px-4 py-3 font-semibold rounded-tl-lg">Product</th>
                <th className="px-4 py-3 font-semibold">Days in Stock</th>
                <th className="px-4 py-3 font-semibold">Qty</th>
                <th className="px-4 py-3 font-semibold rounded-tr-lg">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {aging?.length > 0 ? aging.map((item: any, idx: number) => {
                const days = item.daysOld || item.daysInStock || item.age || 0;
                return (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.productName || item.name || "Unknown SKU"}</td>
                    <td className="px-4 py-3"><span className={`font-semibold ${days > 90 ? 'text-red-600' : 'text-orange-600'}`}>{days} Days</span></td>
                    <td className="px-4 py-3 text-gray-600">{item.quantity || item.stock || 1}</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 cursor-pointer hover:bg-red-200 transition-colors"><AlertTriangle className="w-3 h-3" /> Discount</span></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={4} className="text-center p-6 text-gray-500 bg-gray-50 rounded-lg">No aging inventory detected.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}