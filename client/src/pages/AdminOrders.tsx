import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Search, Eye, FileText, Truck, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/cart";

export default function AdminOrders() {
  const utils = trpc.useUtils();
  const updateStatus = trpc.admin.updateOrderStatus.useMutation();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [assignAgentId, setAssignAgentId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const { data: agents } = trpc.delivery.getAgents.useQuery();
  const assignDelivery = trpc.delivery.assignDelivery.useMutation({
    onSuccess: () => {
      toast.success("Delivery assigned and customer notified!");
      utils.admin.orders.invalidate();
      utils.admin.orderDetail.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, itemsPerPage, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: orders, isLoading } = trpc.admin.orders.useQuery(
    { search: debouncedSearch || undefined, status: statusFilter !== "all" ? statusFilter : undefined }, 
    { refetchInterval: 5000 }
  );

  type Order = NonNullable<typeof orders>[number];
  type Agent = NonNullable<typeof agents>[number];

  const { data: settings } = trpc.settings.public.useQuery({ keys: ["appearance", "general"] });
  const storeName = settings?.general?.storeName || "Store";
  const logoUrl = settings?.appearance?.logoUrl;
  const address = settings?.general?.address || "123 Innovation Drive, Suite 100, Tech City";
  const contactEmail = settings?.general?.contactEmail || "support@company.com";
  const heroTitle = settings?.general?.heroTitle || "Premium Tech, Exceptional Performance";
  const heroDescription = settings?.general?.heroDescription || "Discover the latest laptops, desktops, and accessories from the world's leading brands.";

  const statuses = [
    "pending",
    "payment_confirmed",
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "refunded",
  ];

  const filteredOrders = orders || [];
  
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (!sortConfig) return 0;
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    if (sortConfig.key === "total") {
      aVal = Number(aVal);
      bVal = Number(bVal);
    }
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const paginatedOrders = sortedOrders.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ orderId: Number(orderId), status: newStatus as any });
      toast.success("Order status updated");
      utils.admin.orders.invalidate();
      utils.admin.stats.invalidate(); // Keep dashboard stats in sync!
    } catch (error) {
      toast.error("Failed to update order status");
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      payment_confirmed:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      processing:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      shipped:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      out_for_delivery:
        "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      delivered:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      refunded: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    return colors[status] || colors.pending;
  };

  const handleGenerateInvoice = async (orderId: number) => {
    try {
      const data = await utils.admin.orderDetail.fetch({ orderId: Number(orderId) });
      if (!data || !data.order) {
        return toast.error("Could not load order details");
      }

      const { order, items, customer, payment } = data;
      const printWindow = window.open('', '_blank');
      if (!printWindow) return toast.error("Please allow popups to print invoices");

      const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${storeName}" style="max-height: 40px; max-width: 150px; margin-bottom: 4px;" />` : `<h2 style="margin:0 0 4px 0;font-size:20px;">${storeName}</h2>`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice #${order.orderNumber}</title>
          <style>
            @page { margin: 0; }
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', system-ui, sans-serif; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.5; }
            .invoice-container { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px; margin-bottom: 20px; }
            .invoice-title { font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.025em; margin: 0; }
            .invoice-number { color: #6b7280; font-size: 16px; margin-top: 4px; }
            .store-info p { color: #6b7280; font-size: 13px; margin: 4px 0 0 0; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; padding: 16px; background: #f9fafb; border-radius: 8px; }
            .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.05em; margin-bottom: 8px; }
            .details-text { font-size: 13px; color: #374151; }
            .details-text strong { color: #111827; font-weight: 600; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 20px; }
            th { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
            td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151; }
            .text-right { text-align: right; }
            .totals { width: 280px; margin-left: auto; background: #f9fafb; padding: 16px; border-radius: 8px; }
            .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #4b5563; }
            .totals-row.bold { font-weight: 700; font-size: 16px; color: #111827; border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 6px; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
            .badge-paid { background: #d1fae5; color: #065f46; }
            .badge-pending { background: #fef3c7; color: #92400e; }
          </style>
        </head>
        <body onload="window.print();">
          <div class="invoice-container">
            <div class="header">
              <div>
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-number">#${order.orderNumber}</div>
              </div>
              <div class="text-right store-info">
                ${logoHtml}
                <p>${address.replace(/,/g, '<br/>')}<br/>${contactEmail}</p>
              </div>
            </div>
            <div class="details">
              <div>
                <div class="section-title">Billed To</div>
                <div class="details-text">
                  <strong>${order.shippingFullName}</strong><br/>
                  ${order.shippingAddress}<br/>
                  ${order.shippingCity}${order.shippingPostalCode ? ', ' + order.shippingPostalCode : ''}<br/>
                  ${order.shippingCountry}<br/>
                  ${order.shippingPhone}<br/>
                  ${customer?.email || ''}
                </div>
              </div>
              <div class="text-right">
                <div class="section-title">Order Details</div>
                <div class="details-text">
                  Date: <strong>${new Date(order.createdAt).toLocaleDateString()}</strong><br/>
                  Status: <strong>${order.status.replace(/_/g, ' ').toUpperCase()}</strong><br/>
                  Method: <strong>${order.paymentMethod ? order.paymentMethod.toUpperCase() : 'N/A'}</strong><br/>
                  ${(payment?.transactionId || order.paymentReference) ? `Transaction ID: <strong style="font-family: monospace; font-size: 12px; word-break: break-all;">${payment?.transactionId || order.paymentReference}</strong><br/>` : ''}
                  <div style="margin-top: 8px;">
                    <span class="badge ${order.paymentStatus === 'paid' ? 'badge-paid' : 'badge-pending'}">${order.paymentStatus}</span>
                  </div>
                </div>
              </div>
            </div>
            <table>
              <thead><tr><th>Description</th><th class="text-right">Price</th><th class="text-right">Qty</th><th class="text-right">Total</th></tr></thead>
              <tbody>
                ${items.map((item: any) => `<tr><td><strong>${item.productName}</strong></td><td class="text-right">${formatPrice(item.price)}</td><td class="text-right">${item.quantity}</td><td class="text-right">${formatPrice(item.subtotal)}</td></tr>`).join('')}
              </tbody>
            </table>
            <div class="totals">
              <div class="totals-row"><span>Subtotal</span><span>${formatPrice(order.subtotal)}</span></div>
              <div class="totals-row"><span>Shipping</span><span>${formatPrice(order.shippingCost)}</span></div>
              <div class="totals-row bold"><span>Total</span><span>${formatPrice(order.total)}</span></div>
            </div>
            <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 4px 0;">${heroTitle}</p>
              <p style="font-size: 12px; color: #6b7280; margin: 0;">${heroDescription}</p>
            </div>
          </div>
        </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate invoice");
    }
  };

  // Ensures the modal always displays the freshest data from our 5s polling interval
  const activeOrder = selectedOrder ? orders?.find((o: Order) => o.id === selectedOrder.id) || selectedOrder : null;

  return (
    <AdminLayout activeTab="orders">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold">Orders Management</h2>
          <p className="text-muted-foreground mt-1">
            View and manage all customer orders
          </p>
        </div>

        {/* Search & Filter */}
        <Card className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by order ID or customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Orders Table */}
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('orderNumber')}>
                    <div className="flex items-center gap-1">Order ID <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('shippingFullName')}>
                    <div className="flex items-center gap-1">Customer <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('createdAt')}>
                    <div className="flex items-center gap-1">Date <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-right py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('total')}>
                    <div className="flex items-center justify-end gap-1">Total <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-muted-foreground">
                      Loading orders...
                    </td>
                  </tr>
                ) : paginatedOrders.length > 0 ? (
                  paginatedOrders.map((order: Order) => (
                    <tr key={order.id} className="border-b border-border hover:bg-secondary transition-colors">
                      <td className="py-3 px-4 font-mono text-xs">{order.orderNumber}</td>
                      <td className="py-3 px-4">{order.shippingFullName}</td>
                      <td className="py-3 px-4">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Select
                          value={order.status}
                          onValueChange={(value) =>
                            handleStatusUpdate(order.id, value)
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {formatPrice(order.total)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedOrder(order)}
                            title="View Details"
                          >
                            <Eye size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Generate Invoice"
                            onClick={() => handleGenerateInvoice(order.id)}
                          >
                            <FileText size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Shipping Info"
                            onClick={() => {
                              const newTracking = window.prompt("Enter or update Tracking Number:", order.trackingNumber || "");
                              if (newTracking !== null && newTracking !== (order.trackingNumber || "")) {
                                updateStatus.mutate({
                                  orderId: Number(order.id),
                                  status: order.status as any,
                                  trackingNumber: newTracking,
                                  note: `Tracking number updated to ${newTracking}`
                                }, {
                                  onSuccess: () => { toast.success("Tracking number saved"); utils.admin.orders.invalidate(); },
                                  onError: (err) => toast.error(err.message || "Failed to save tracking number")
                                });
                              }
                            }}
                          >
                            <Truck size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-muted-foreground">
                      No orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && filteredOrders.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border mt-4">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, sortedOrders.length)} of {sortedOrders.length} entries
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
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Order Details Modal */}
        {selectedOrder && activeOrder && (
          <Card className="p-6 fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">
                    Order {activeOrder.orderNumber}
                  </h3>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedOrder(null)}
                  >
                    ✕
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Customer</p>
                      <p className="font-semibold">{activeOrder.shippingFullName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Order Date</p>
                      <p className="font-semibold">
                        {new Date(activeOrder.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <h4 className="font-semibold mb-2">Shipping Address</h4>
                    <p className="text-sm">
                      {activeOrder.shippingAddress}
                      <br />
                      {activeOrder.shippingCity}, {activeOrder.shippingPostalCode}
                      <br />
                      {activeOrder.shippingCountry}
                    </p>
                  </div>

                  <div className="border-t border-border pt-4">
                    <h4 className="font-semibold mb-2">Order Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatPrice(activeOrder.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Shipping:</span>
                        <span>{formatPrice(activeOrder.shippingCost)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-border pt-2">
                        <span>Total:</span>
                        <span>{formatPrice(activeOrder.total)}</span>
                      </div>
                    </div>
                  </div>

                {/* Delivery Information (for Admin testing/support) */}
                {activeOrder.status === "out_for_delivery" && activeOrder.deliveryOtp && (
                  <div className="border-t border-border pt-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[var(--brand)]" /> Active Delivery
                    </h4>
                    <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                      <span className="text-sm text-muted-foreground">Customer OTP Code:</span>
                      <span className="font-mono text-lg font-bold tracking-widest text-[var(--brand)]">{activeOrder.deliveryOtp}</span>
                    </div>
                  </div>
                )}

                {/* Delivery Agent Assignment */}
                {(activeOrder.status === "processing" || activeOrder.status === "shipped") && (
                  <div className="border-t border-border pt-4">
                    <h4 className="font-semibold mb-3">Delivery Management</h4>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <Select 
                        value={assignAgentId || activeOrder.deliveryAgentId?.toString() || ""}
                        onValueChange={setAssignAgentId}
                      >
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue placeholder="Assign a Delivery Agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents?.map((agent: Agent) => {
                            const isAssignedToThis = activeOrder.deliveryAgentId === agent.id;
                            const isAgentDisabled = !agent.isAvailable || (agent.activeCity && agent.activeCity !== activeOrder.shippingCity);
                            const isDisabled = isAgentDisabled && !isAssignedToThis;

                            let statusText = "";
                            if (!agent.isAvailable) statusText = " (Offline)";
                            else if (agent.activeCity && agent.activeCity !== activeOrder.shippingCity) statusText = ` (Busy in ${agent.activeCity})`;
                            else if (agent.activeCity === activeOrder.shippingCity) statusText = ` (Active in ${agent.activeCity})`;

                            return (
                              <SelectItem key={agent.id} value={agent.id.toString()} disabled={isDisabled}>
                                {agent.name} ({agent.vehicleType} - {agent.vehicleNumber}){statusText}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <Button 
                        className="w-full sm:w-auto shrink-0 bg-[var(--brand)] text-white" 
                        disabled={!assignAgentId || assignDelivery.isPending}
                        onClick={() => assignDelivery.mutate({ orderId: activeOrder.id, agentId: parseInt(assignAgentId) })}
                      >
                        {assignDelivery.isPending ? "Assigning..." : "Assign & Notify"}
                      </Button>
                    </div>
                  </div>
                )}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSelectedOrder(null)}
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
