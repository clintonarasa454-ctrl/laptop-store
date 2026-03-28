import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Search, Download, Eye, ArrowUpDown, Check, X } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { Link } from "wouter";
import { formatPrice } from "@/lib/cart";

export default function AdminPayments() {
  const { data: payments, isLoading } = trpc.admin.payments.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("all");
  const [payoutStartDate, setPayoutStartDate] = useState("");
  const [payoutEndDate, setPayoutEndDate] = useState("");
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [payoutsItemsPerPage, setPayoutsItemsPerPage] = useState(20);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState({
    mpesa: true,
    paypal: true,
    stripe: true,
    bank_transfer: false,
    cash_on_delivery: true,
  });
  const [page, setPage] = useState(1);
  const [paymentStartDate, setPaymentStartDate] = useState("");
  const [paymentEndDate, setPaymentEndDate] = useState("");
  const [mpesaSettings, setMpesaSettings] = useState({
    consumerKey: "",
    consumerSecret: "",
    shortcode: "",
    initiatorName: "",
    initiatorPassword: "",
    certContent: "",
    apiHost: "sandbox",
  });
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const { data: dbPaymentMethods } = trpc.admin.getSetting.useQuery({ key: "payment_methods" });
  const { data: stats } = trpc.admin.stats.useQuery(undefined, {
    refetchInterval: 30000, // Refetch stats every 30 seconds
  });
  const updateSetting = trpc.admin.updateSetting.useMutation();
  const utils = trpc.useUtils();

  const { data: payoutRequests, isLoading: loadingPayouts } = trpc.admin.getPayoutRequests.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const { data: dbMpesaSettings } = trpc.admin.getSetting.useQuery({ key: "mpesa_b2c" });

  const handleSaveMpesaSettings = async () => {
    updateSetting.mutate({ key: "mpesa_b2c", value: mpesaSettings }, 
      { onSuccess: () => toast.success("M-Pesa settings saved!"), onError: (err) => toast.error(err.message) });
  };

  const filteredPayouts = payoutRequests?.filter((p: any) => {
    const matchesStatus = payoutStatusFilter === "all" || p.status === payoutStatusFilter;
    let matchesDate = true;
    if (payoutStartDate) {
      const start = new Date(payoutStartDate);
      start.setHours(0, 0, 0, 0);
      matchesDate = matchesDate && new Date(p.requestedAt) >= start;
    }
    if (payoutEndDate) {
      const end = new Date(payoutEndDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(p.requestedAt) <= end;
    }
    return matchesStatus && matchesDate;
  }) || [];

  const paginatedPayouts = filteredPayouts.slice((payoutsPage - 1) * payoutsItemsPerPage, payoutsPage * payoutsItemsPerPage);
  const totalPayoutsPages = Math.ceil(filteredPayouts.length / payoutsItemsPerPage);

  const handleExportPayouts = () => {
    const dataToExport = filteredPayouts;
    if (!dataToExport || dataToExport.length === 0) return toast.error("No payout data to export.");
    
    const csvHeader = "Request ID,Agent ID,Amount,Status,Requested At,Processed At,Transaction ID\n";
    const csvRows = dataToExport.map((p: any) => 
      [
        p.id,
        p.agentId,
        p.amount,
        p.status,
        /* Use quotes around toLocaleString to prevent commas from breaking CSV columns */
        `"${new Date(p.requestedAt).toLocaleString()}"`,
        p.processedAt ? `"${new Date(p.processedAt).toLocaleString()}"` : '',
        p.transactionId || ''
      ].join(',')
    ).join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const approvePayout = trpc.admin.approvePayout.useMutation({
    onSuccess: () => {
      utils.admin.getPayoutRequests.invalidate();
      toast.success("Payout approved successfully");
    },
    onError: (err) => toast.error("Failed to approve: " + err.message)
  });

  const rejectPayout = trpc.admin.rejectPayout.useMutation({
    onSuccess: () => {
      utils.admin.getPayoutRequests.invalidate();
      toast.success("Payout rejected");
    },
    onError: (err) => toast.error("Failed to reject: " + err.message)
  });

  const refundPayment = trpc.admin.refundPayment.useMutation({
    onSuccess: () => {
      utils.admin.payments.invalidate();
      utils.admin.orders.invalidate();
      toast.success("Payment refunded successfully");
      setSelectedPayment(null);
    },
    onError: (err) => toast.error("Failed to refund: " + err.message)
  });

  useEffect(() => {
    if (dbPaymentMethods) {
      setPaymentMethods(dbPaymentMethods as any);
    }
  }, [dbPaymentMethods]);

  useEffect(() => {
    if (dbMpesaSettings) {
      setMpesaSettings(current => ({ ...current, ...(dbMpesaSettings as any) }));
    }
  }, [dbMpesaSettings]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, paymentStartDate, paymentEndDate, itemsPerPage, sortConfig]);

  useEffect(() => {
    setPayoutsPage(1);
  }, [payoutStatusFilter, payoutStartDate, payoutEndDate, payoutsItemsPerPage, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleToggleMethod = async (key: string, checked: boolean) => {
    const updated = { ...paymentMethods, [key]: checked };
    setPaymentMethods(updated);
    try {
      await updateSetting.mutateAsync({ key: "payment_methods", value: updated });
      toast.success("Payment method updated");
    } catch (error) {
      toast.error("Failed to update setting");
    }
  };

  const filteredPayments = payments?.filter((p: any) => {
    const matchesSearch = p.id.toString().includes(searchTerm) || p.orderId.toString().includes(searchTerm);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    let matchesDate = true;
    if (paymentStartDate) {
      const start = new Date(paymentStartDate);
      start.setHours(0, 0, 0, 0);
      matchesDate = matchesDate && new Date(p.createdAt) >= start;
    }
    if (paymentEndDate) {
      const end = new Date(paymentEndDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(p.createdAt) <= end;
    }
    return matchesSearch && matchesStatus && matchesDate;
  }) || [];

  const handleExport = () => {
    const dataToExport = filteredPayments;
    if (!dataToExport || dataToExport.length === 0) return toast.error("No payment data to export.");
    
    const csvHeader = "Payment ID,Order ID,Method,Amount,Status,Date\n";
    const csvRows = dataToExport.map((p: any) => 
      `${p.id},${p.orderId},${p.method},${p.amount},${p.status},"${new Date(p.createdAt).toLocaleString()}"`
    ).join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortedPayments = [...filteredPayments].sort((a, b) => {
    if (!sortConfig) return 0;
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    if (sortConfig.key === "amount") {
      aVal = Number(aVal);
      bVal = Number(bVal);
    }
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedPayments.length / itemsPerPage);
  const paginatedPayments = sortedPayments.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const totalPayments = payments?.length || 0;
  const pendingPayments = payments?.filter((p: any) => p.status === "pending").length || 0;
  const failedPayments = payments?.filter((p: any) => p.status === "failed").length || 0;

  const pendingPayouts = payoutRequests?.filter(p => p.status === 'pending') || [];
  const pendingPayoutsCount = pendingPayouts.length;
  const pendingPayoutsAmount = pendingPayouts.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      mpesa: "M-Pesa",
      paypal: "PayPal",
      stripe: "Stripe",
      card: "Card",
      bank_transfer: "Bank Transfer",
      cash_on_delivery: "Cash on Delivery",
    };
    return labels[method] || method;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      refunded: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    };
    return colors[status] || colors.pending;
  };

  return (
    <AdminLayout activeTab="payments">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold">Payments Management</h2>
          <p className="text-muted-foreground mt-1">
            Monitor and manage all financial transactions
          </p>
        </div>

        <Tabs defaultValue="customer_payments" className="w-full space-y-6">
          <TabsList>
            <TabsTrigger value="customer_payments">Customer Payments</TabsTrigger>
            <TabsTrigger value="driver_payouts">Driver Payouts</TabsTrigger>
          </TabsList>

          <TabsContent value="customer_payments" className="space-y-6 m-0">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
            <p className="text-sm text-muted-foreground font-medium">Total Payments</p>
            <p className="text-3xl font-bold mt-2">{totalPayments}</p>
          </Card>
          <Card className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900">
            <p className="text-sm text-muted-foreground font-medium">Pending Payments</p>
            <p className="text-3xl font-bold mt-2">{pendingPayments}</p>
          </Card>
          <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
            <p className="text-sm text-muted-foreground font-medium">Failed Payments</p>
            <p className="text-3xl font-bold mt-2">{failedPayments}</p>
          </Card>
        </div>

        {/* Payment Methods Configuration */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Payment Methods</h3>
          <div className="space-y-4">
            {Object.entries(paymentMethods).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                <div>
                  <p className="font-medium">{getPaymentMethodLabel(key)}</p>
                  <p className="text-sm text-muted-foreground">
                    {enabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => handleToggleMethod(key, checked)}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">M-Pesa B2C Payout Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Consumer Key</label>
              <Input type="password" value={mpesaSettings.consumerKey} onChange={(e) => setMpesaSettings(s => ({...s, consumerKey: e.target.value}))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Consumer Secret</label>
              <Input type="password" value={mpesaSettings.consumerSecret} onChange={(e) => setMpesaSettings(s => ({...s, consumerSecret: e.target.value}))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">ShortCode (Paybill/Till)</label>
              <Input value={mpesaSettings.shortcode} onChange={(e) => setMpesaSettings(s => ({...s, shortcode: e.target.value}))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">API Host</label>
              <Select value={mpesaSettings.apiHost} onValueChange={(val) => setMpesaSettings(s => ({...s, apiHost: val}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (for testing)</SelectItem>
                  <SelectItem value="production">Production (live)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Initiator Name</label>
              <Input value={mpesaSettings.initiatorName} onChange={(e) => setMpesaSettings(s => ({...s, initiatorName: e.target.value}))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Initiator Password</label>
              <Input type="password" value={mpesaSettings.initiatorPassword} onChange={(e) => setMpesaSettings(s => ({...s, initiatorPassword: e.target.value}))} />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-sm font-medium">B2C Certificate Content</label>
              <Textarea 
                placeholder="-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----" 
                className="font-mono text-xs min-h-[120px]"
                value={mpesaSettings.certContent} 
                onChange={(e) => setMpesaSettings(s => ({...s, certContent: e.target.value}))} 
              />
              <p className="text-xs text-muted-foreground">Paste the entire content of the .cer file provided by Safaricom here.</p>
            </div>
          </div>
          <Button className="mt-4" onClick={handleSaveMpesaSettings} disabled={updateSetting.isPending}>Save M-Pesa Settings</Button>
        </Card>

        {/* Search & Filter */}
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-wrap flex-1 w-full gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <Input type="date" value={paymentStartDate} onChange={(e) => setPaymentStartDate(e.target.value)} className="w-36 h-9" title="Start Date" />
              <span className="text-muted-foreground hidden sm:inline mt-1.5">-</span>
              <Input type="date" value={paymentEndDate} onChange={(e) => setPaymentEndDate(e.target.value)} className="w-36 h-9" title="End Date" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="gap-2 h-9" onClick={handleExport}>
              <Download size={16} />
              Export Report
            </Button>
          </div>
        </Card>

        {/* Payments Table */}
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('id')}>
                    <div className="flex items-center gap-1">Payment ID <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('orderId')}>
                    <div className="flex items-center gap-1">Order ID <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('method')}>
                    <div className="flex items-center gap-1">Method <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-right py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('amount')}>
                    <div className="flex items-center justify-end gap-1">Amount <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('createdAt')}>
                    <div className="flex items-center gap-1">Date <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-muted-foreground">
                      Loading payments...
                    </td>
                  </tr>
                ) : paginatedPayments.length > 0 ? (
                  paginatedPayments.map((payment: any) => (
                    <tr key={payment.id} className="border-b border-border hover:bg-secondary transition-colors">
                      <td className="py-3 px-4 font-mono text-xs">{payment.id}</td>
                      <td className="py-3 px-4 font-mono text-xs">{payment.orderId}</td>
                      <td className="py-3 px-4">
                        {getPaymentMethodLabel(payment.method || "card")}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {formatPrice(payment.amount || 0)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPayment(payment)}
                          >
                            <Eye size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-muted-foreground">
                      No payments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && filteredPayments.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border mt-4">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, sortedPayments.length)} of {sortedPayments.length} entries
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground hidden sm:inline">Rows per page:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(Number(val))}>
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </Card>
          </TabsContent>

          <TabsContent value="driver_payouts" className="space-y-6 m-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                <p className="text-sm text-muted-foreground font-medium">Total Paid Out</p>
                <p className="text-3xl font-bold mt-2">{formatPrice(stats?.totalPayouts || 0)}</p>
              </Card>
              <Card className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900">
                <p className="text-sm text-muted-foreground font-medium">Pending Requests</p>
                <p className="text-3xl font-bold mt-2">{pendingPayoutsCount}</p>
              </Card>
              <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
                <p className="text-sm text-muted-foreground font-medium">Pending Amount</p>
                <p className="text-3xl font-bold mt-2">{formatPrice(pendingPayoutsAmount)}</p>
              </Card>
            </div>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Payouts Over Time</h3>
              </div>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.payoutChartData || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPayouts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => formatPrice(val)} dx={-10} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} formatter={(value: number) => [formatPrice(value), "Payouts"]} />
                    <Area type="monotone" dataKey="payouts" stroke="var(--brand)" strokeWidth={2} fillOpacity={1} fill="url(#colorPayouts)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Driver Payout Requests</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Input type="date" value={payoutStartDate} onChange={(e) => setPayoutStartDate(e.target.value)} className="w-36 h-9" title="Start Date" />
                  <span className="text-muted-foreground hidden sm:inline">-</span>
                  <Input type="date" value={payoutEndDate} onChange={(e) => setPayoutEndDate(e.target.value)} className="w-36 h-9" title="End Date" />
                  <Select value={payoutStatusFilter} onValueChange={setPayoutStatusFilter}>
                    <SelectTrigger className="w-36 h-9">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleExportPayouts} className="gap-2"><Download size={16} /> Export CSV</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold">Request ID</th>
                      <th className="text-left py-3 px-4 font-semibold">Agent ID</th>
                      <th className="text-right py-3 px-4 font-semibold">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold">Requested At</th>
                      <th className="text-left py-3 px-4 font-semibold">Status</th>
                      <th className="text-center py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingPayouts ? (
                      <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading requests...</td></tr>
                    ) : paginatedPayouts.length > 0 ? (
                      paginatedPayouts.map((payout: any) => (
                        <tr key={payout.id} className="border-b border-border hover:bg-secondary transition-colors">
                          <td className="py-3 px-4 font-mono text-xs">{payout.id}</td>
                          <td className="py-3 px-4">{payout.agentId}</td>
                          <td className="py-3 px-4 text-right font-semibold text-[var(--brand)]">{formatPrice(payout.amount)}</td>
                          <td className="py-3 px-4">{new Date(payout.requestedAt).toLocaleString()}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${payout.status === 'completed' ? 'bg-green-100 text-green-800' : payout.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {payout.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="outline" size="sm" className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50" disabled={payout.status !== 'pending' || approvePayout.isPending} onClick={() => approvePayout.mutate({ id: payout.id })}>
                                <Check className="w-4 h-4 mr-1" /> Approve
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50" disabled={payout.status !== 'pending' || rejectPayout.isPending} onClick={() => rejectPayout.mutate({ id: payout.id })}>
                                <X className="w-4 h-4 mr-1" /> Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No payout requests found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {!loadingPayouts && filteredPayouts.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border mt-4">
                  <p className="text-sm text-muted-foreground text-center sm:text-left">
                    Showing {((payoutsPage - 1) * payoutsItemsPerPage) + 1} to {Math.min(payoutsPage * payoutsItemsPerPage, filteredPayouts.length)} of {filteredPayouts.length} entries
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground hidden sm:inline">Rows per page:</span>
                      <Select value={payoutsItemsPerPage.toString()} onValueChange={(val) => setPayoutsItemsPerPage(Number(val))}>
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPayoutsPage(p => Math.max(1, p - 1))} disabled={payoutsPage === 1}>Previous</Button>
                      <Button variant="outline" size="sm" onClick={() => setPayoutsPage(p => Math.min(totalPayoutsPages, p + 1))} disabled={payoutsPage >= totalPayoutsPages}>Next</Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {/* Payment Details Modal */}
        {selectedPayment && (
          <Card className="p-6 fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">Payment Details</h3>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedPayment(null)}
                  >
                    ✕
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Payment ID</p>
                    <p className="font-mono text-sm">{selectedPayment.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Order ID</p>
                    <p className="font-mono text-sm">{selectedPayment.orderId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="text-lg font-bold">
                      {formatPrice(selectedPayment.amount || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Method</p>
                    <p className="font-semibold">
                      {getPaymentMethodLabel(selectedPayment.method || "card")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${getStatusColor(selectedPayment.status)}`}>
                      {selectedPayment.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-semibold">
                      {new Date(selectedPayment.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="border-t border-border pt-4 space-y-2">
                    <Link href={`/admin/orders/${selectedPayment.orderId}`}>
                      <Button variant="outline" className="w-full">
                        View Order Details
                      </Button>
                    </Link>
                    {selectedPayment.status === "completed" && (
                      <Button variant="outline" className="w-full text-destructive" onClick={() => refundPayment.mutate({ orderId: selectedPayment.orderId })} disabled={refundPayment.isPending}>
                        Process Refund
                      </Button>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setSelectedPayment(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </Card>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
