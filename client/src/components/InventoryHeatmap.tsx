import { trpc } from "@/lib/trpc";
import { Map, AlertTriangle, ArrowRightLeft } from "lucide-react";

export default function InventoryHeatmap() {
  const { data: heatmap, isLoading: loadingHeatmap } = trpc.inventory.heatmap.useQuery(
    undefined,
    { staleTime: 0, refetchInterval: 5000, refetchOnWindowFocus: true }
  );
  const { data: imbalances, isLoading: loadingImbalances } = trpc.inventory.imbalances.useQuery(
    undefined,
    { staleTime: 0, refetchInterval: 5000, refetchOnWindowFocus: true }
  );

  if (loadingHeatmap || loadingImbalances) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-pulse">
          <div className="h-6 w-1/4 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200/50 rounded-lg border border-gray-100"></div>)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-pulse h-[250px]">
          <div className="h-6 w-1/3 bg-gray-200 rounded mb-6"></div>
          <div className="w-full h-32 bg-gray-200/50 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Heatmap Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-gray-800">
          <Map className="w-5 h-5 text-blue-600" /> Stock Heatmap by Warehouse
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {heatmap?.map(wh => (
            <div key={wh.warehouseId} className="p-4 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-900">{wh.warehouseName}</h4>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${wh.averageStockHealth > 50 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {wh.averageStockHealth}% Health
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-4">{wh.city}</p>
              
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Units:</span>
                  <span className="font-medium">{wh.totalUnits}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Low Stock SKUs:</span>
                  <span className="font-medium text-orange-600">{wh.lowStockCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Out of Stock SKUs:</span>
                  <span className="font-medium text-red-600">{wh.outOfStockCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Imbalances Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-gray-800">
          <ArrowRightLeft className="w-5 h-5 text-purple-600" /> Transfer Optimization Recommendations
        </h3>
        
        {imbalances?.length === 0 ? (
          <div className="text-center p-6 text-gray-500 bg-gray-50 rounded-lg">
            Inventory is perfectly balanced across all warehouses!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-3 font-semibold rounded-tl-lg">Product</th>
                  <th className="px-4 py-3 font-semibold">Transfer From (Overstocked)</th>
                  <th className="px-4 py-3 font-semibold">Transfer To (Understocked)</th>
                  <th className="px-4 py-3 font-semibold">Suggested Qty</th>
                  <th className="px-4 py-3 font-semibold rounded-tr-lg">Urgency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {imbalances?.map((imb, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{imb.productName}</td>
                    <td className="px-4 py-3"><span className="block text-gray-900">{imb.overstockedWarehouse.name}</span><span className="text-xs text-gray-500">Stock: {imb.overstockedWarehouse.stock}</span></td>
                    <td className="px-4 py-3"><span className="block text-gray-900">{imb.understockedWarehouse.name}</span><span className="text-xs text-gray-500">Stock: {imb.understockedWarehouse.stock}</span></td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded"><ArrowRightLeft className="w-3 h-3" /> {imb.suggestedTransferQty}</span></td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${imb.urgency === 'critical' ? 'bg-red-100 text-red-700' : imb.urgency === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{imb.urgency === 'critical' && <AlertTriangle className="w-3 h-3" />}{imb.urgency.toUpperCase()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}