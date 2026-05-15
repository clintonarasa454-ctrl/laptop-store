import { useState, useMemo, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Link } from "wouter";
import { DollarSign, ShoppingCart, Users, Package, TrendingUp, Calendar, AlertCircle, Zap } from "lucide-react";
import { formatPrice } from "@/lib/cart";
import InventoryHeatmap from "@/components/InventoryHeatmap";
import InventoryTrends from "@/components/InventoryTrends";
import { useAuth } from "@/pages/useAuth";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("30d");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("all");
  const [updates, setUpdates] = useState<any>(null);
  const { data: warehouses } = trpc.admin.warehouses.useQuery();
  const { data: stats, isLoading, error } = trpc.admin.stats.useQuery({ 
    timeRange, 
    warehouseId: selectedWarehouseId !== "all" ? Number(selectedWarehouseId) : undefined 
  }, {
    staleTime: 0, // Data is immediately stale for real-time updates
    refetchInterval: 5000, // Poll every 5 seconds for live dashboard
    refetchOnWindowFocus: true, // Always refresh when user focuses the tab
    refetchOnReconnect: true, // Refresh when reconnecting
    refetchOnMount: true, // Always fetch fresh data on mount
  });

  // Enable real-time updates (polls every 0.5 seconds)
  useRealtimeUpdates((detectedUpdates, counts) => {
    setUpdates({
      ...detectedUpdates,
      counts,
      detectedAt: new Date().toLocaleTimeString(),
    });

    // Show toast notifications for significant changes
    if (detectedUpdates.newOrders?.count) {
      toast.success(`🎉 ${detectedUpdates.newOrders.count} new order(s) received!`);
    }
    if (detectedUpdates.newManagers?.count) {
      toast.info(`👤 ${detectedUpdates.newManagers.count} new manager(s) added!`);
    }
    if (detectedUpdates.newUsers?.count) {
      toast.info(`👥 ${detectedUpdates.newUsers.count} new customer(s) joined!`);
    }
    if (detectedUpdates.newVisitors?.count) {
      toast.info(`👀 ${detectedUpdates.newVisitors.count} new visitor(s)!`);
    }
    if ((detectedUpdates.productCountChanged?.difference ?? 0) > 0) {
      toast.info(`📦 ${Math.abs(detectedUpdates.productCountChanged.difference ?? 0)} new product(s) added!`);
    } else if ((detectedUpdates.productCountChanged?.difference ?? 0) < 0) {
      toast.info(`📦 ${Math.abs(detectedUpdates.productCountChanged.difference ?? 0)} product(s) removed!`);
    }
  });

  const monthlyRevenueData = (stats as any)?.monthlyRevenueData || [];
  const productPerformanceData = (stats as any)?.productPerformanceData || [];

  const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

  const recentOrders = useMemo(() => {
    return (stats as any)?.recentOrders?.slice(0, 5) || [];
  }, [stats]);

  const bestSellingProducts = useMemo(() => {
    return (stats as any)?.productPerformanceData?.slice(0, 5) || [];
  }, [stats]);

  if (isLoading) {
    return (
      <AdminLayout activeTab="dashboard">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6 animate-pulse bg-secondary h-32" />
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout activeTab="dashboard">
        <Card className="p-6 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-100">Failed to load dashboard data</h3>
              <p className="text-sm text-red-800 dark:text-red-200 mt-1">{error.message}</p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-2 font-mono bg-red-100 dark:bg-red-900 p-2 rounded">
                {error.data?.code || "Unknown error"}
              </p>
            </div>
          </div>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="dashboard">
      <div className="space-y-8">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className="text-muted-foreground mt-1">Overview of your store's activity</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Real-time Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
              <span className="text-xs font-medium text-green-700 dark:text-green-400">Live (0.5s refresh)</span>
            </div>
            {user?.role === "admin" && (
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger className="w-48 h-10 bg-card">
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Global / All Hubs</SelectItem>
                  {warehouses?.map((w: any) => (
                    <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {user?.role === "manager" && (
              <div className="px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium">
                {warehouses?.find((w: any) => w.id === user.warehouseId)?.name || "Assigned Warehouse"}
              </div>
            )}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-44 h-10 bg-card">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Today / 24h</SelectItem>
                <SelectItem value="2d">Last 2 Days</SelectItem>
                <SelectItem value="3d">Last 3 Days</SelectItem>
                <SelectItem value="4d">Last 4 Days</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
                <SelectItem value="12m">Last 12 Months</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Real-time Updates Alert */}
        {updates && Object.keys(updates).length > 2 && (
          <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-blue-900 dark:text-blue-100 text-sm">
                  Real-time Updates Detected
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {updates.newOrders?.count && (
                    <div className="text-xs bg-white dark:bg-blue-900/50 px-2 py-1 rounded">
                      📦 {updates.newOrders.count} new order{updates.newOrders.count > 1 ? 's' : ''}
                    </div>
                  )}
                  {updates.newManagers?.count && (
                    <div className="text-xs bg-white dark:bg-blue-900/50 px-2 py-1 rounded">
                      👤 {updates.newManagers.count} new manager{updates.newManagers.count > 1 ? 's' : ''}
                    </div>
                  )}
                  {updates.newUsers?.count && (
                    <div className="text-xs bg-white dark:bg-blue-900/50 px-2 py-1 rounded">
                      👥 {updates.newUsers.count} new customer{updates.newUsers.count > 1 ? 's' : ''}
                    </div>
                  )}
                  {updates.newVisitors?.count && (
                    <div className="text-xs bg-white dark:bg-blue-900/50 px-2 py-1 rounded">
                      👀 {updates.newVisitors.count} visitor{updates.newVisitors.count > 1 ? 's' : ''}
                    </div>
                  )}
                  {(updates.productCountChanged?.difference ?? 0) !== 0 && (
                    <div className="text-xs bg-white dark:bg-blue-900/50 px-2 py-1 rounded">
                      {(updates.productCountChanged?.difference ?? 0) > 0 ? '✅' : '❌'} {Math.abs(updates.productCountChanged.difference ?? 0)} product(s)
                    </div>
                  )}
                  <div className="text-xs text-blue-600 dark:text-blue-400 ml-auto">
                    Detected at {updates.detectedAt}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {formatPrice((stats as any)?.totalRevenue || 0)}
                </p>
                <p className={`text-xs mt-2 flex items-center gap-1 ${((stats as any)?.trends?.revenue ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  <TrendingUp size={14} className={((stats as any)?.trends?.revenue ?? 0) < 0 ? "rotate-180" : ""} /> {((stats as any)?.trends?.revenue ?? 0) > 0 ? "+" : ""}{(stats as any)?.trends?.revenue ?? 0}% from last month
                </p>
              </div>
              <DollarSign size={40} className="text-blue-500 opacity-20" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Orders</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {(stats as any)?.totalOrders || 0}
                </p>
                <p className={`text-xs mt-2 flex items-center gap-1 ${((stats as any)?.trends?.orders ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  <TrendingUp size={14} className={((stats as any)?.trends?.orders ?? 0) < 0 ? "rotate-180" : ""} /> {((stats as any)?.trends?.orders ?? 0) > 0 ? "+" : ""}{(stats as any)?.trends?.orders ?? 0}% from last month
                </p>
              </div>
              <ShoppingCart size={40} className="text-purple-500 opacity-20" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Customers</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {(stats as any)?.totalCustomers || 0}
                </p>
                <p className={`text-xs mt-2 flex items-center gap-1 ${((stats as any)?.trends?.customers ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  <TrendingUp size={14} className={((stats as any)?.trends?.customers ?? 0) < 0 ? "rotate-180" : ""} /> {((stats as any)?.trends?.customers ?? 0) > 0 ? "+" : ""}{(stats as any)?.trends?.customers ?? 0}% from last month
                </p>
              </div>
              <Users size={40} className="text-green-500 opacity-20" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Products</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {(stats as any)?.totalProducts || 0}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                  <TrendingUp size={14} /> +{(stats as any)?.trends?.products ?? 0} new products
                </p>
              </div>
              <Package size={40} className="text-orange-500 opacity-20" />
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Revenue & Orders</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6" }}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: "#8b5cf6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Product Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={productPerformanceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {productPerformanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Recent Orders Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Orders</h3>
            <Link href={user?.role === "manager" ? "/manager/orders" : "/admin/orders"}>
              <Button variant="outline" size="sm">
                View All Orders
              </Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Order ID</th>
                  <th className="text-left py-3 px-4 font-semibold">Customer</th>
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-right py-3 px-4 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length > 0 ? (
                  recentOrders.map((order: any) => (
                    <tr key={order.id} className="border-b border-border hover:bg-secondary transition-colors">
                      <td className="py-3 px-4 font-mono text-xs">{order.orderNumber}</td>
                      <td className="py-3 px-4">{order.shippingFullName}</td>
                      <td className="py-3 px-4">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            order.status === "delivered"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : order.status === "shipped"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              : order.status === "processing"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                          }`}
                        >
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {formatPrice(order.total)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-muted-foreground">
                      No recent orders
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Advanced Inventory Analytics Section */}
        <div className="space-y-6 mt-8 border-t border-border pt-8">
          <div>
            <h2 className="text-2xl font-bold">Advanced Inventory</h2>
            <p className="text-muted-foreground mt-1">Real-time stock health, velocity, and transfer recommendations</p>
          </div>
          <InventoryHeatmap />
          <InventoryTrends timeRange={timeRange} />
        </div>
      </div>
    </AdminLayout>
  );
}
