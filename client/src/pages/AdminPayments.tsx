import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Search, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { formatPrice } from "@/lib/cart";

export default function AdminPayments() {
  const { data: payments, isLoading } = trpc.admin.payments.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState({
    mpesa: true,
    paypal: true,
    stripe: true,
    bank_transfer: false,
    cash_on_delivery: true,
  });

  const { data: dbPaymentMethods } = trpc.admin.getSetting.useQuery({ key: "payment_methods" });
  const updateSetting = trpc.admin.updateSetting.useMutation();
  const utils = trpc.useUtils();

  const refundPayment = trpc.admin.refundPayment.useMutation({
    onSuccess: () => {
      utils.admin.payments.invalidate();
      utils.admin.orders.invalidate();
      toast.success("Payment refunded successfully");
      setSelectedPayment(null);
    },
    onError: (err) => toast.error("Failed to refund: " + err.message)
  });

  const handleExport = () => {
    if (!payments) return;
    const csv = ["Payment ID,Order ID,Method,Amount,Status,Date"];
    payments.forEach((p: any) => {
      csv.push(`${p.id},${p.orderId},${p.method},${p.amount},${p.status},${new Date(p.createdAt).toISOString()}`);
    });
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payments_export.csv";
    a.click();
  };

  useEffect(() => {
    if (dbPaymentMethods) {
      setPaymentMethods(dbPaymentMethods as any);
    }
  }, [dbPaymentMethods]);

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

  const filteredPayments = payments?.filter((p: any) =>
    p.id.toString().includes(searchTerm) ||
    p.orderId.toString().includes(searchTerm)
  ) || [];

  const totalPayments = payments?.length || 0;
  const pendingPayments = payments?.filter((p: any) => p.status === "pending").length || 0;
  const failedPayments = payments?.filter((p: any) => p.status === "failed").length || 0;

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

        {/* Search & Filter */}
        <Card className="p-4">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by payment or order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2" onClick={handleExport}>
              <Download size={18} />
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
                  <th className="text-left py-3 px-4 font-semibold">Payment ID</th>
                  <th className="text-left py-3 px-4 font-semibold">Order ID</th>
                  <th className="text-left py-3 px-4 font-semibold">Method</th>
                  <th className="text-right py-3 px-4 font-semibold">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
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
                ) : filteredPayments.length > 0 ? (
                  filteredPayments.map((payment: any) => (
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
        </Card>

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
