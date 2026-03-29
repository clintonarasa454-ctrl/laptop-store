import { useState } from "react";
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
  AreaChart,
  Area,
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
import { Download, Calendar, TrendingUp, Users, ShoppingBag, Eye, Sparkles } from "lucide-react";
import { formatPrice } from "@/lib/cart";

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

export default function AdminAnalytics() {
  const [timeRange, setTimeRange] = useState("30d");
  const { data: stats, isLoading } = trpc.admin.stats.useQuery({ timeRange }, {
    refetchInterval: 15000,
  });

  const revenueData = stats?.revenueData || [];
  const categoryData = stats?.categoryData || [];
  const brandData = stats?.brandData || [];
  const trafficSourceData = stats?.trafficSourceData || [];

  const totalVisitors = revenueData.reduce((sum: number, day: any) => sum + (day.visitors || 0), 0) || 1;
  const totalOrders = stats?.totalOrders || 0;
  const conversionRate = ((totalOrders / totalVisitors) * 100).toFixed(1);
  const avgOrderValue = totalOrders > 0 ? (parseFloat(stats?.totalRevenue as string) / totalOrders).toFixed(2) : "0.00";
  const returningUsersPercentage = stats?.totalCustomers ? Math.round(((stats?.returningUsersCount || 0) / stats.totalCustomers) * 100) : 0;

  const handleExport = () => {
    if (!revenueData || revenueData.length === 0) return;
    const csv = ["Date,Revenue,Visitors"];
    revenueData.forEach((day: any) => {
      csv.push(`${day.date},${day.revenue},${day.visitors}`);
    });
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <AdminLayout activeTab="analytics">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="analytics">
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Analytics & Reports</h2>
            <p className="text-muted-foreground mt-1">
              Detailed insights into your store's performance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40 h-10">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2 h-10" onClick={handleExport}>
              <Download className="w-4 h-4" /> Export
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Page Views</p>
              <h4 className="text-2xl font-bold">{totalVisitors.toLocaleString()}</h4>
              <p className={`text-xs font-medium flex items-center mt-1 ${(stats?.trends?.pageViews ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                <TrendingUp className={`w-3 h-3 mr-1 ${(stats?.trends?.pageViews ?? 0) < 0 ? "rotate-180" : ""}`} /> {(stats?.trends?.pageViews ?? 0) > 0 ? "+" : ""}{stats?.trends?.pageViews ?? 0}%
              </p>
            </div>
          </Card>
          <Card className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
              <h4 className="text-2xl font-bold">{conversionRate}%</h4>
              <p className={`text-xs font-medium flex items-center mt-1 ${(stats?.trends?.conversion ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                <TrendingUp className={`w-3 h-3 mr-1 ${(stats?.trends?.conversion ?? 0) < 0 ? "rotate-180" : ""}`} /> {(stats?.trends?.conversion ?? 0) > 0 ? "+" : ""}{stats?.trends?.conversion ?? 0}%
              </p>
            </div>
          </Card>
          <Card className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg. Order Value</p>
              <h4 className="text-2xl font-bold">{formatPrice(avgOrderValue)}</h4>
              <p className={`text-xs font-medium flex items-center mt-1 ${(stats?.trends?.aov ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                <TrendingUp className={`w-3 h-3 mr-1 ${(stats?.trends?.aov ?? 0) < 0 ? "rotate-180" : ""}`} /> {(stats?.trends?.aov ?? 0) > 0 ? "+" : ""}{stats?.trends?.aov ?? 0}%
              </p>
            </div>
          </Card>
          <Card className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Returning Users</p>
              <h4 className="text-2xl font-bold">{returningUsersPercentage}%</h4>
              <p className={`text-xs font-medium flex items-center mt-1 ${(stats?.trends?.returning ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                <TrendingUp className={`w-3 h-3 mr-1 ${(stats?.trends?.returning ?? 0) < 0 ? "rotate-180" : ""}`} /> {(stats?.trends?.returning ?? 0) > 0 ? "+" : ""}{stats?.trends?.returning ?? 0}%
              </p>
            </div>
          </Card>
        </div>

        {/* Charts - Main row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6">
            <h3 className="font-semibold mb-6">Revenue Trend</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => formatPrice(val)} dx={-10} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-6">Traffic Sources</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={trafficSourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                    {trafficSourceData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* AI Conversion Tracking Chart */}
        <Card className="p-6">
          <h3 className="font-semibold mb-6 flex items-center gap-2"><Sparkles className="w-5 h-5 text-pink-500" /> AI vs Organic Revenue</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.aiRevenueData || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOrganic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => formatPrice(val)} dx={-10} />
                <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} />
                <Legend />
                <Area type="monotone" name="Organic Revenue" dataKey="organicRevenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorOrganic)" stackId="1" />
                <Area type="monotone" name="AI Assisted Revenue" dataKey="aiRevenue" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorAi)" stackId="1" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Charts - Secondary row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-6">Sales by Category</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => formatPrice(val)} />
                  <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} />
                  <Bar dataKey="sales" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-6">Sales by Brand</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={brandData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => formatPrice(val)} />
                  <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} />
                  <Bar dataKey="sales" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-6">Store Visitors</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="visitors" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorVisitors)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}