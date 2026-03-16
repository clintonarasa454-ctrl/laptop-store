import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { formatPrice, getOrderStatusColor, getOrderStatusLabel } from "@/lib/cart";
import {
  BarChart3,
  CheckCircle,
  ChevronRight,
  CreditCard,
  Edit,
  Loader2,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type AdminTab = "overview" | "orders" | "products" | "customers";

export default function Admin() {
  const { isAuthenticated, loading, user } = useAuth();
  const isDev = import.meta.env.MODE !== "production";
  const params = useParams<{ tab?: string; orderId?: string }>();
  const activeTab = (params.tab as AdminTab) ?? "overview";

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!isDev && (!isAuthenticated || user?.role !== "admin")) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center py-20">
          <div>
            <Settings className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <h2 className="font-display text-xl font-bold mb-2">Admin Access Required</h2>
            <p className="text-muted-foreground mb-6">You don't have permission to access this area.</p>
            <Link href="/">
              <Button className="bg-[var(--brand)] text-white hover:opacity-90">Go Home</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const navItems = [
    { id: "overview" as AdminTab, label: "Overview", icon: BarChart3, href: "/admin" },
    { id: "orders" as AdminTab, label: "Orders", icon: Package, href: "/admin/orders" },
    { id: "products" as AdminTab, label: "Products", icon: ShoppingBag, href: "/admin/products" },
    { id: "customers" as AdminTab, label: "Customers", icon: Users, href: "/admin/customers" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="container py-8 flex-1">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-3">Admin Panel</p>
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <Link key={item.id} href={item.href}>
                    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      activeTab === item.id
                        ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}>
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </div>
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main */}
          <div className="lg:col-span-4">
            {activeTab === "overview" && <AdminOverview />}
            {activeTab === "orders" && (
              params.orderId ? <AdminOrderDetail orderId={parseInt(params.orderId)} /> : <AdminOrders />
            )}
            {activeTab === "products" && <AdminProducts />}
            {activeTab === "customers" && <AdminCustomers />}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

// ─── Admin Overview ────────────────────────────────────────────────────────────
function AdminOverview() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" /></div>;

  return (
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
  );
}

// ─── Admin Orders ──────────────────────────────────────────────────────────────
function AdminOrders() {
  const { data: orders, isLoading } = trpc.admin.orders.useQuery();
  const [search, setSearch] = useState("");

  const filtered = (orders ?? []).filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (o.customerName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">All Orders</h1>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="pl-9 h-8 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Order</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden md:table-cell">Payment</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((order, i) => (
                <tr key={order.id} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/20"} hover:bg-muted/40 transition-colors`}>
                  <td className="px-4 py-3">
                    <p className="font-mono font-medium">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="font-medium">{order.customerName ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge className={`text-xs ${order.paymentStatus === "paid" ? "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"}`}>
                      {order.paymentStatus === "paid" ? "Paid" : "Pending"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${getOrderStatusColor(order.status)}`}>
                      {getOrderStatusLabel(order.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPrice(order.total)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 px-2">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Admin Order Detail ────────────────────────────────────────────────────────
function AdminOrderDetail({ orderId }: { orderId: number }) {
  const { data, isLoading, refetch } = trpc.admin.orderDetail.useQuery({ orderId });
  const utils = trpc.useUtils();

  const updateStatus = trpc.admin.updateOrderStatus.useMutation({
    onSuccess: () => {
      refetch();
      utils.admin.orders.invalidate();
      toast.success("Order status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const verifyPayment = trpc.admin.verifyPayment.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Payment verified");
    },
    onError: () => toast.error("Failed to verify payment"),
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" /></div>;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Order not found</div>;

  const { order, items, history, customer } = data;

  const statusOptions = [
    "pending", "payment_confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled", "refunded",
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground">← Orders</Link>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-sm font-mono">{order.orderNumber}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Order info */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4">Order Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Order #</span><span className="font-mono font-medium">{order.orderNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(order.createdAt).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="capitalize">{order.paymentMethod ?? "—"}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Payment Status</span>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs ${order.paymentStatus === "paid" ? "text-green-600 bg-green-50 border-green-200" : "text-yellow-600 bg-yellow-50 border-yellow-200"}`}>
                  {order.paymentStatus === "paid" ? "Paid" : "Pending"}
                </Badge>
                {order.paymentStatus !== "paid" && (
                  <Button
                    size="sm"
                    className="h-6 px-2 text-xs bg-green-600 text-white hover:bg-green-700"
                    onClick={() => verifyPayment.mutate({ orderId })}
                    disabled={verifyPayment.isPending}
                  >
                    Verify
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Customer info */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4">Customer</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{customer?.name ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{customer?.email ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ship To</span><span className="text-right max-w-[180px]">{order.shippingFullName}, {order.shippingCity}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{order.shippingPhone}</span></div>
          </div>
        </div>
      </div>

      {/* Update status */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Truck className="w-4.5 h-4.5 text-[var(--brand)]" /> Update Order Status
        </h2>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={order.status === status ? "default" : "outline"}
              className={order.status === status ? "bg-[var(--brand)] text-white" : ""}
              onClick={() => updateStatus.mutate({ orderId, status: status as any, note: `Status updated to ${getOrderStatusLabel(status)}` })}
              disabled={updateStatus.isPending || order.status === status}
            >
              {getOrderStatusLabel(status)}
            </Button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-display font-semibold mb-4">Items</h2>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 items-center">
              {item.productImage && (
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                  <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.productName}</p>
                <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {formatPrice(item.price)}</p>
              </div>
              <p className="text-sm font-semibold">{formatPrice(item.subtotal)}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-4 pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{parseFloat(order.shippingCost) === 0 ? "Free" : formatPrice(order.shippingCost)}</span></div>
          <div className="flex justify-between font-display font-bold text-base pt-1 border-t border-border"><span>Total</span><span>{formatPrice(order.total)}</span></div>
        </div>
      </div>

      {/* History */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-display font-semibold mb-4">Status History</h2>
        <div className="space-y-2">
          {history.map((h) => (
            <div key={h.id} className="flex gap-2.5 text-sm">
              <div className="w-2 h-2 rounded-full bg-[var(--brand)] mt-1.5 shrink-0" />
              <div>
                <span className="font-medium">{getOrderStatusLabel(h.status)}</span>
                {h.note && <span className="text-muted-foreground ml-1.5">— {h.note}</span>}
                <span className="text-xs text-muted-foreground ml-1.5">{new Date(h.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Products ────────────────────────────────────────────────────────────
function AdminProducts() {
  const { data: products, isLoading } = trpc.products.list.useQuery({ limit: 100 });
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", slug: "", description: "", shortDescription: "", price: "", comparePrice: "",
    brand: "", stock: "0", sku: "", categoryId: 1, featured: false,
    images: "", specifications: "",
  });

  const { data: categories } = trpc.categories.list.useQuery();

  const createProduct = trpc.admin.createProduct.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      setShowForm(false);
      resetForm();
      toast.success("Product created!");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateProduct = trpc.admin.updateProduct.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      setEditProduct(null);
      setShowForm(false);
      resetForm();
      toast.success("Product updated!");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProduct = trpc.admin.deleteProduct.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); toast.success("Product deleted"); },
    onError: () => toast.error("Failed to delete product"),
  });

  const resetForm = () => setForm({ name: "", slug: "", description: "", shortDescription: "", price: "", comparePrice: "", brand: "", stock: "0", sku: "", categoryId: 1, featured: false, images: "", specifications: "" });

  const openEdit = (product: any) => {
    setEditProduct(product);
    const images = (product.images as string[]) ?? [];
    const specs = product.specifications ?? {};
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      shortDescription: product.shortDescription ?? "",
      price: product.price,
      comparePrice: product.comparePrice ?? "",
      brand: product.brand ?? "",
      stock: String(product.stock),
      sku: product.sku ?? "",
      categoryId: product.categoryId ?? 1,
      featured: product.featured ?? false,
      images: images.join("\n"),
      specifications: Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join("\n"),
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const imageList = form.images.split("\n").map((s) => s.trim()).filter(Boolean);
    const specsObj: Record<string, string> = {};
    form.specifications.split("\n").forEach((line) => {
      const [k, ...v] = line.split(":");
      if (k && v.length) specsObj[k.trim()] = v.join(":").trim();
    });

    const payload = {
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      description: form.description || undefined,
      shortDescription: form.shortDescription || undefined,
      price: form.price,
      comparePrice: form.comparePrice || undefined,
      brand: form.brand || undefined,
      stock: parseInt(form.stock) || 0,
      sku: form.sku || undefined,
      categoryId: form.categoryId,
      featured: form.featured,
      images: imageList,
      specifications: specsObj,
    };

    if (editProduct) {
      updateProduct.mutate({ productId: editProduct.id, ...payload });
    } else {
      createProduct.mutate(payload);
    }
  };

  const filtered = (products ?? []).filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Products</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 h-8 text-sm" />
          </div>
          <Button size="sm" onClick={() => { resetForm(); setEditProduct(null); setShowForm(!showForm); }} className="bg-[var(--brand)] text-white hover:opacity-90 gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Product
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">{editProduct ? "Edit Product" : "New Product"}</h3>
            <button onClick={() => { setShowForm(false); setEditProduct(null); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="auto-generated" /></div>
            <div className="space-y-1"><Label>Price *</Label><Input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="999.99" /></div>
            <div className="space-y-1"><Label>Compare Price</Label><Input value={form.comparePrice} onChange={(e) => setForm((f) => ({ ...f, comparePrice: e.target.value }))} placeholder="1299.99" /></div>
            <div className="space-y-1"><Label>Brand</Label><Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} /></div>
            <div className="space-y-1"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Category</Label>
              <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: parseInt(e.target.value) }))} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 space-y-1"><Label>Short Description</Label><Input value={form.shortDescription} onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))} /></div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Description</Label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Image URLs (one per line)</Label>
              <textarea value={form.images} onChange={(e) => setForm((f) => ({ ...f, images: e.target.value }))} rows={3} className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono" placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg" />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Specifications (Key: Value, one per line)</Label>
              <textarea value={form.specifications} onChange={(e) => setForm((f) => ({ ...f, specifications: e.target.value }))} rows={4} className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono" placeholder="Processor: Intel Core i7&#10;RAM: 16GB DDR5&#10;Storage: 512GB SSD" />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} />
                <span className="text-sm">Featured product</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSubmit} disabled={createProduct.isPending || updateProduct.isPending} className="bg-[var(--brand)] text-white hover:opacity-90">
              {editProduct ? "Update" : "Create"} Product
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditProduct(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Brand</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Price</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden md:table-cell">Stock</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((product, i) => {
                const images = (product.images as string[]) ?? [];
                return (
                  <tr key={product.id} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted shrink-0">
                          {images[0] && <img src={images[0]} alt={product.name} className="w-full h-full object-cover" />}
                        </div>
                        <div>
                          <p className="font-medium truncate max-w-[200px]">{product.name}</p>
                          {product.featured && <Badge className="text-[10px] px-1 py-0 bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/20">Featured</Badge>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{product.brand ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold">{formatPrice(product.price)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={product.stock === 0 ? "text-destructive" : product.stock <= 5 ? "text-orange-500" : "text-green-600"}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(product)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Delete this product?")) deleteProduct.mutate({ productId: product.id });
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Admin Customers ───────────────────────────────────────────────────────────
function AdminCustomers() {
  const { data: customers, isLoading } = trpc.admin.customers.useQuery();
  const [search, setSearch] = useState("");

  const filtered = (customers ?? []).filter(
    (c) =>
      (c.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Customers</h1>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="pl-9 h-8 text-sm" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden md:table-cell">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden md:table-cell">Joined</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Orders</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer, i) => (
                <tr key={customer.id} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[var(--brand)]/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-[var(--brand)]">{customer.name?.charAt(0)?.toUpperCase() ?? "?"}</span>
                      </div>
                      <span className="font-medium">{customer.name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{customer.email ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge className={`text-xs capitalize ${customer.role === "admin" ? "bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/20" : ""}`}>{customer.role}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{new Date(customer.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right font-semibold">{(customer as any).orderCount ?? 0}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">No customers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
