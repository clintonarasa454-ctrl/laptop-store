import { trpc } from "@/lib/trpc";
import { formatPrice, getOrderStatusColor, getOrderStatusLabel } from "@/lib/cart";
import {
  ChevronRight,
  CreditCard,
  Loader2,
  Package,
  Truck,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";

export default function Admin() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();

  if (isLoading) {
    return (
      <AdminLayout activeTab="overview">
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="overview">
      <div className="space-y-6">
      <h1 className="font-display text-xl font-bold">Admin Overview</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: stats?.totalOrders ?? 0, icon: Package, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30" },
          { label: "Pending Orders", value: stats?.pendingOrders ?? 0, icon: Truck, color: "text-orange-500 bg-orange-50 dark:bg-orange-950/30" },
          { label: "Total Revenue", value: formatPrice(stats?.totalRevenue ?? 0), icon: CreditCard, color: "text-green-500 bg-green-50 dark:bg-green-950/30" },
          { label: "Total Customers", value: stats?.totalCustomers ?? 0, icon: Users, color: "text-purple-500 bg-purple-50 dark:bg-purple-950/30" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-4.5 h-4.5" />
            </div>
            <p className="font-display font-bold text-xl">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold">Recent Orders</h2>
          <Link href="/admin/orders" className="text-xs text-[var(--brand)] hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {stats?.recentOrders && stats.recentOrders.length > 0 ? (
          <div className="space-y-2">
            {stats.recentOrders.map((order: any) => (
              <Link key={order.id} href={`/admin/orders/${order.id}`}>
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div>
                    <p className="text-sm font-medium font-mono">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{order.customerName} · {new Date(order.createdAt).toLocaleDateString()}</p>
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
          <p className="text-sm text-muted-foreground text-center py-6">No orders yet</p>
        )}
      </div>
      </div>
    </AdminLayout>
  );
}
