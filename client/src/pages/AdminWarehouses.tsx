import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Plus, Edit2, MapPin, Loader2, Store, Map, Truck, AlertTriangle, Eye, Package, Download, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/pages/useAuth";
import { KENYA_COUNTIES } from "@/lib/kenya-locations";
import { formatPrice } from "@/lib/cart";

export default function AdminWarehouses() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingWarehouse, setViewingWarehouse] = useState<any>(null);
  const [timeRange, setTimeRange] = useState("30d");
  const [, setLocation] = useLocation();

  const { data: warehouses, isLoading } = trpc.admin.warehouses.useQuery();
  const { data: users } = trpc.admin.users.useQuery();
  const { data: drivers } = trpc.fleet.getDrivers.useQuery();
  const managers = users?.filter((u: any) => u.role === "manager") || [];
  
  const upsertUser = trpc.admin.upsertUser.useMutation();

  const { data: modalStats, isLoading: loadingModalStats } = trpc.admin.stats.useQuery(
    { timeRange, warehouseId: viewingWarehouse?.id },
    { enabled: !!viewingWarehouse }
  );
  const { data: warehouseInventory } = trpc.admin.getWarehouseInventory.useQuery(
    { warehouseId: viewingWarehouse?.id },
    { enabled: !!viewingWarehouse?.id }
  );

  const [showTransfers, setShowTransfers] = useState(false);
  const { data: transfers, isLoading: loadingTransfers } = trpc.admin.getInventoryTransfers.useQuery(undefined, { enabled: showTransfers });
  const approveTransfer = trpc.admin.approveInventoryTransfer.useMutation({
    onSuccess: () => { utils.admin.getInventoryTransfers.invalidate(); toast.success("Transfer approved and routed."); },
    onError: (err) => toast.error(err.message),
  });
  const fulfillExternal = trpc.admin.fulfillRestockExternally.useMutation({
    onSuccess: () => { utils.admin.getInventoryTransfers.invalidate(); utils.admin.getWarehouseInventory.invalidate(); toast.success("Stock added externally."); },
    onError: (err) => toast.error(err.message),
  });
  const dispatchTransfer = trpc.admin.dispatchInventoryTransfer.useMutation({
    onSuccess: () => { utils.admin.getInventoryTransfers.invalidate(); toast.success("Transfer dispatched."); },
    onError: (err) => toast.error(err.message),
  });
  const receiveTransfer = trpc.admin.receiveInventoryTransfer.useMutation({
    onSuccess: () => { utils.admin.getInventoryTransfers.invalidate(); utils.admin.getWarehouseInventory.invalidate(); toast.success("Transfer received and stock updated."); },
    onError: (err) => toast.error(err.message),
  });

  const assignAllProducts = trpc.admin.assignAllUnassignedProducts.useMutation({
    onSuccess: () => {
      utils.admin.products.invalidate();
      toast.success("All unassigned products successfully moved to this warehouse!");
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const createDirectTransfer = trpc.admin.createDirectTransfer.useMutation({
    onSuccess: () => {
      utils.admin.getWarehouseInventory.invalidate();
      toast.success("Transfer initiated! The manager will be notified to dispatch the items.");
      setTransferModal(null);
      setTransferForm({ toWarehouseId: "", quantity: 1 });
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const defaultForm = {
    name: "",
    type: "storefront" as "storefront" | "fulfillment_center",
    address: "",
    country: "Kenya",
    county: "",
    city: "",
    lat: "",
    lng: "",
    active: true,
  };

  const [formData, setFormData] = useState(defaultForm);
  const [managerMode, setManagerMode] = useState<"none" | "existing" | "new">("none");
  const [managerForm, setManagerForm] = useState({
    id: undefined as number | undefined,
    name: "",
    email: "",
    phone: "",
  });

  const [transferModal, setTransferModal] = useState<{ productId: number, productName: string, maxStock: number } | null>(null);
  const [transferForm, setTransferForm] = useState({ toWarehouseId: "", quantity: 1 });

  const upsertWarehouse = trpc.admin.upsertWarehouse.useMutation({
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const handleEdit = (warehouse: any) => {
    setEditingId(warehouse.id);
    setFormData({
      name: warehouse.name,
      type: warehouse.type,
      address: warehouse.address,
      country: warehouse.country || "Kenya",
      county: warehouse.county || "",
      city: warehouse.city,
      lat: warehouse.lat.toString(),
      lng: warehouse.lng.toString(),
      active: warehouse.active,
    });
    
    const existingManager = managers.find((m: any) => m.warehouseId === warehouse.id);
    if (existingManager) {
      setManagerMode("existing");
      setManagerForm({
        id: existingManager.id,
        name: existingManager.name || "",
        email: existingManager.email || "",
        phone: existingManager.phone || "",
      });
    } else {
      setManagerMode("none");
      setManagerForm({ id: undefined, name: "", email: "", phone: "" });
    }
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertWarehouse.mutate({
      ...(editingId ? { id: editingId } : {}),
      name: formData.name,
      type: formData.type,
      address: formData.address,
      country: formData.country,
      county: formData.county,
      city: formData.city,
      lat: parseFloat(formData.lat),
      lng: parseFloat(formData.lng),
      active: formData.active,
    }, {
      onSuccess: async (data) => {
        const warehouseId = editingId || data?.id;
        
        if (warehouseId && managerMode !== "none") {
           try {
             await upsertUser.mutateAsync({
               id: managerForm.id,
               name: managerForm.name,
               email: managerForm.email,
               phone: managerForm.phone || undefined,
               role: "manager",
               warehouseId: warehouseId
             });
           } catch (err: any) {
             toast.error(`Failed to assign manager: ${err.message}`);
           }
        }
        
        utils.admin.warehouses.invalidate();
        utils.admin.users.invalidate();
        toast.success(editingId ? "Warehouse updated!" : "Warehouse created!");
        setShowForm(false);
        setFormData(defaultForm);
        setEditingId(null);
        setManagerMode("none");
        setManagerForm({ id: undefined, name: "", email: "", phone: "" });
      }
    });
  };

  const handleExportAnalytics = () => {
    if (!modalStats) return;
    
    const timeLabel = timeRange === 'all' ? 'All Time' : timeRange;
    
    let csv = "Warehouse Analytics Report\n";
    csv += `Warehouse,${viewingWarehouse?.name}\n`;
    csv += `Time Range,${timeLabel}\n`;
    csv += `Revenue (${timeLabel}),${(modalStats as any).totalRevenue || 0}\n`;
    csv += `Orders (${timeLabel}),${(modalStats as any).totalOrders || 0}\n`;
    csv += `Unique Customers (${timeLabel}),${(modalStats as any).totalCustomers || 0}\n\n`;
    
    csv += "Recent Orders\n";
    csv += "Order ID,Customer,Date,Status,Total\n";
    
    ((modalStats as any).recentOrders || []).forEach((order: any) => {
      csv += `${order.orderNumber},"${order.shippingFullName}",${new Date(order.createdAt).toLocaleDateString()},${order.status},${order.total}\n`;
    });
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${viewingWarehouse?.name?.replace(/\s+/g, "_")}_Analytics.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    const toastId = toast.loading("Acquiring GPS location & Address...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude.toString();
        const lng = position.coords.longitude.toString();
        
        let newFormData: Partial<typeof defaultForm> = { lat, lng };

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.address) {
              const addr = data.address;
              
              if (addr.country) newFormData.country = addr.country;
              
              let foundCounty = addr.county || addr.state || "";
              if (newFormData.country === "Kenya" && foundCounty) {
                 foundCounty = foundCounty.replace(/ County$/i, '').trim();
                 const matchedCounty = Object.keys(KENYA_COUNTIES).find(c => c.toLowerCase() === foundCounty.toLowerCase());
                 if (matchedCounty) newFormData.county = matchedCounty;
              } else if (foundCounty && newFormData.country !== "Kenya") {
                 newFormData.county = foundCounty;
              }

              const city = addr.city || addr.town || addr.village || addr.suburb || "";
              if (city) newFormData.city = city;

              const street = addr.road || addr.pedestrian || "";
              const neighborhood = addr.neighbourhood || addr.suburb || "";
              const building = addr.building || addr.amenity || "";
              
              const addressParts = Array.from(new Set([building, street, neighborhood].filter(Boolean)));
              const streetAddress = addressParts.join(", ");
              if (streetAddress) newFormData.address = streetAddress;
            }
          }
        } catch (error) {
          console.error("Reverse geocoding failed", error);
        }

        setFormData((prev) => ({
          ...prev,
          ...newFormData,
        }));
        toast.success("Location & Address acquired!", { id: toastId });
      },
      (error) => {
        toast.error("Failed to get location. Please enter manually.", { id: toastId });
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <AdminLayout activeTab="warehouses">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Warehouses & Stores</h2>
            <p className="text-muted-foreground mt-1">
              Manage your physical locations for dynamic shipping calculations.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowTransfers(true)} variant="outline" className="gap-2">
              <ArrowLeftRight size={18} /> Transfers
            </Button>
            {user?.role === "admin" && (
              <Button onClick={() => { 
              setFormData(defaultForm); 
              setEditingId(null); 
              setManagerMode("none");
              setManagerForm({ id: undefined, name: "", email: "", phone: "" });
              setShowForm(true); 
            }} className="gap-2">
              <Plus size={18} /> Add Location
            </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : warehouses?.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Store className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No locations added yet.</p>
            </div>
          ) : (
            warehouses?.map((w) => (
              <Card key={w.id} className={`p-5 ${!w.active ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-[var(--brand)]/10 flex items-center justify-center text-[var(--brand)]">
                      <Store size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold">{w.name}</h3>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">{w.type.replace("_", " ")}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewingWarehouse(w)} title="View Overview"><Eye size={16} /></Button>
                    {user?.role === "admin" && (
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(w)} title="Edit Warehouse"><Edit2 size={16} /></Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><MapPin size={14} /> {w.address}, {w.city}{w.county ? `, ${w.county}` : ""}, {w.country || "Kenya"}</p>
                  <p className="flex items-center gap-2"><Map size={14} /> {parseFloat(w.lat as any).toFixed(4)}, {parseFloat(w.lng as any).toFixed(4)}</p>
                </div>
                {(() => {
                  const assignedDrivers = drivers?.filter((d: any) => d.warehouseId === w.id) || [];
                  if (assignedDrivers.length > 0) {
                    return (
                      <div className="mt-4 pt-3 border-t border-border">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-2">
                          <Truck size={12} /> Assigned Drivers ({assignedDrivers.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {assignedDrivers.map((d: any) => (
                            <span key={d.id} className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md border border-border">
                              {d.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </Card>
            ))
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">{editingId ? "Edit Location" : "Add New Location"}</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>✕</Button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Location Name *</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. Downtown Store" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location Type *</Label>
                    <Select value={formData.type} onValueChange={(val: any) => setFormData({ ...formData, type: val })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="storefront">Retail Storefront</SelectItem>
                        <SelectItem value="fulfillment_center">Fulfillment Center / Warehouse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Country *</Label>
                      <Select value={formData.country} onValueChange={(val) => setFormData({ ...formData, country: val, county: "", city: "" })}>
                        <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Kenya">Kenya</SelectItem>
                          <SelectItem value="Uganda">Uganda</SelectItem>
                          <SelectItem value="Tanzania">Tanzania</SelectItem>
                          <SelectItem value="United States">United States</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.country === "Kenya" && (
                      <div className="space-y-1.5">
                        <Label>County *</Label>
                        <Select value={formData.county} onValueChange={(val) => setFormData({ ...formData, county: val, city: "" })}>
                          <SelectTrigger><SelectValue placeholder="Select County" /></SelectTrigger>
                          <SelectContent>
                            {Object.keys(KENYA_COUNTIES).sort().map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>City / Town *</Label>
                      {formData.country === "Kenya" && formData.county ? (
                        <Select value={formData.city} onValueChange={(val) => setFormData({ ...formData, city: val })}>
                          <SelectTrigger><SelectValue placeholder="Select City" /></SelectTrigger>
                          <SelectContent>
                            {KENYA_COUNTIES[formData.county as keyof typeof KENYA_COUNTIES]?.map((city: string) => <SelectItem key={city} value={city}>{city}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} required placeholder="Enter City" />
                      )}
                    </div>
                    <div className="space-y-1.5"><Label>Street Address *</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required placeholder="e.g. Godown 4, Industrial Area" /></div>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between">
                      <Label>GPS Coordinates *</Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} className="h-7 text-xs gap-1.5"><MapPin size={12}/> Get Current Location</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input type="number" step="any" placeholder="Latitude" value={formData.lat} onChange={(e) => setFormData({ ...formData, lat: e.target.value })} required />
                      <Input type="number" step="any" placeholder="Longitude" value={formData.lng} onChange={(e) => setFormData({ ...formData, lng: e.target.value })} required />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch checked={formData.active} onCheckedChange={(c) => setFormData({ ...formData, active: c })} />
                    <Label>Active (Available for order fulfillment)</Label>
                  </div>

                  <div className="border-t border-border pt-4 mt-4">
                    <Label className="text-lg font-semibold mb-3 block">Manager Assignment</Label>
                    
                    <div className="flex flex-wrap gap-4 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="managerMode" checked={managerMode === "none"} onChange={() => setManagerMode("none")} className="accent-[var(--brand)]" />
                        <span className="text-sm">No Manager</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="managerMode" checked={managerMode === "existing"} onChange={() => setManagerMode("existing")} className="accent-[var(--brand)]" />
                        <span className="text-sm">Assign Existing Manager</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="managerMode" checked={managerMode === "new"} onChange={() => {
                          setManagerMode("new");
                          setManagerForm({ id: undefined, name: "", email: "", phone: "" });
                        }} className="accent-[var(--brand)]" />
                        <span className="text-sm">Create New Manager</span>
                      </label>
                    </div>

                    {managerMode === "existing" && (
                      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
                        <div className="space-y-1.5">
                          <Label>Select Manager</Label>
                          <Select 
                            value={managerForm.id?.toString() || ""} 
                            onValueChange={(val) => {
                              const m = managers.find((mgr: any) => mgr.id.toString() === val);
                              if (m) setManagerForm({ id: m.id, name: m.name || "", email: m.email || "", phone: m.phone || "" });
                            }}
                          >
                            <SelectTrigger className="bg-background"><SelectValue placeholder="Choose a manager..." /></SelectTrigger>
                            <SelectContent>
                              {managers.map((m: any) => <SelectItem key={m.id} value={m.id.toString()}>{m.name} ({m.email})</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {managerForm.id && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1.5"><Label>Name</Label><Input value={managerForm.name} readOnly className="bg-muted" /></div>
                            <div className="space-y-1.5"><Label>Email</Label><Input value={managerForm.email} readOnly className="bg-muted" /></div>
                          </div>
                        )}
                        {(() => {
                          const m = managers.find((mgr: any) => mgr.id === managerForm.id);
                          const isReassigning = m && m.warehouseId && m.warehouseId !== editingId;
                          const oldWarehouse = isReassigning ? warehouses?.find((w: any) => w.id === m.warehouseId)?.name : null;
                          
                          if (isReassigning) {
                            return (
                              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md flex gap-2 items-start">
                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm text-amber-800 font-bold">Transfer Warning</p>
                                  <p className="text-xs text-amber-700 mt-1">This manager is currently assigned to <strong>{oldWarehouse || "another warehouse"}</strong>. Assigning them here will transfer them, leaving their previous location without a manager.</p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                    {managerMode === "new" && (
                      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5"><Label>Name *</Label><Input value={managerForm.name} onChange={(e) => setManagerForm({...managerForm, name: e.target.value})} required className="bg-background" /></div>
                          <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={managerForm.email} onChange={(e) => setManagerForm({...managerForm, email: e.target.value})} required className="bg-background" /></div>
                          <div className="space-y-1.5 sm:col-span-2"><Label>Phone Number</Label><Input value={managerForm.phone} onChange={(e) => setManagerForm({...managerForm, phone: e.target.value})} className="bg-background" placeholder="e.g. +254 712 345678" /></div>
                        </div>
                        <p className="text-xs text-[var(--brand)] font-medium">A temporary password will be emailed to them automatically.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-6">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
                    <Button type="submit" disabled={upsertWarehouse.isPending} className="flex-1 bg-[var(--brand)] text-white">{upsertWarehouse.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Location"}</Button>
                  </div>
                </form>
              </div>
            </Card>
          </div>
        )}

        {viewingWarehouse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
                <div>
                  <h3 className="text-2xl font-bold">{viewingWarehouse.name} Dashboard</h3>
                  <p className="text-sm text-muted-foreground">{viewingWarehouse.address}, {viewingWarehouse.city}</p>
                </div>
                <Button variant="ghost" onClick={() => setViewingWarehouse(null)}>✕</Button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 bg-background">
                <Tabs defaultValue="analytics" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="analytics">Analytics & Orders</TabsTrigger>
                    <TabsTrigger value="products">Assigned Products</TabsTrigger>
                    <TabsTrigger value="drivers">Assigned Drivers</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="analytics" className="space-y-6">
                    {loadingModalStats ? (
                      <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                          <Select value={timeRange} onValueChange={setTimeRange}>
                            <SelectTrigger className="w-[180px] bg-background">
                              <SelectValue placeholder="Select Time Range" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7d">Last 7 Days</SelectItem>
                              <SelectItem value="30d">Last 30 Days</SelectItem>
                              <SelectItem value="90d">Last 3 Months</SelectItem>
                              <SelectItem value="all">All Time</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={handleExportAnalytics} className="gap-2">
                            <Download size={14} /> Export CSV
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Card className="p-4 bg-blue-50 border-blue-100 dark:bg-blue-950/30 dark:border-blue-900">
                            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Revenue ({timeRange === 'all' ? 'All' : timeRange})</p>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                              {formatPrice((modalStats as any)?.totalRevenue || 0)}
                            </p>
                          </Card>
                          <Card className="p-4 bg-purple-50 border-purple-100 dark:bg-purple-950/30 dark:border-purple-900">
                            <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Orders ({timeRange === 'all' ? 'All' : timeRange})</p>
                            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                              {(modalStats as any)?.totalOrders || 0}
                            </p>
                          </Card>
                          <Card className="p-4 bg-orange-50 border-orange-100 dark:bg-orange-950/30 dark:border-orange-900">
                            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Unique Customers ({timeRange === 'all' ? 'All' : timeRange})</p>
                            <p className="text-2xl font-bold text-orange-700 dark:text-orange-300 mt-1">
                              {(modalStats as any)?.totalCustomers || 0}
                            </p>
                          </Card>
                        </div>
                        
                        <div>
                          <h4 className="font-bold text-lg mb-3">Recent Orders</h4>
                          <div className="overflow-x-auto border border-border rounded-lg">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                  <th className="text-left py-3 px-4 font-semibold">Order ID</th>
                                  <th className="text-left py-3 px-4 font-semibold">Customer</th>
                                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                                  <th className="text-right py-3 px-4 font-semibold">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {((modalStats as any)?.recentOrders || []).length > 0 ? (
                                  ((modalStats as any)?.recentOrders || []).map((order: any) => (
                                    <tr key={order.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                                      <td className="py-2 px-4 font-mono text-xs">{order.orderNumber}</td>
                                      <td className="py-2 px-4">{order.shippingFullName}</td>
                                      <td className="py-2 px-4">{new Date(order.createdAt).toLocaleDateString()}</td>
                                      <td className="py-2 px-4 capitalize">{order.status.replace("_", " ")}</td>
                                      <td className="py-2 px-4 text-right font-semibold">{formatPrice(order.total)}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No recent orders found for this warehouse.</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="products">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-border">
                      <p className="text-sm text-muted-foreground">Products currently assigned to this location.</p>
                      {user?.role === "admin" && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => { if(confirm("Move all currently unassigned global products into this warehouse?")) assignAllProducts.mutate({ warehouseId: viewingWarehouse.id }) }}
                          disabled={assignAllProducts.isPending}
                          className="gap-2 shrink-0"
                        >
                          {assignAllProducts.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                          Pull All Unassigned Products Here
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {warehouseInventory?.length ? (
                        warehouseInventory.map((item: any) => (
                          <Card key={item.id} className="p-3 flex flex-col gap-2">
                            <div className="w-full aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center">
                               {item.productImages?.[0] ? <img src={item.productImages[0]} className="w-full h-full object-cover" /> : <Package className="w-8 h-8 opacity-20" />}
                            </div>
                            <p className="font-semibold text-sm line-clamp-1">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">{item.productBrand}</p>
                            <div className="flex justify-between items-center mt-auto pt-2">
                              <span className="font-bold text-sm">{formatPrice(item.productPrice)}</span>
                              <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">Stock: {item.stock}</span>
                            </div>
                            {user?.role === "admin" && (
                              <div className="pt-2 border-t border-border mt-1">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="w-full h-8 text-xs" 
                                  onClick={() => setTransferModal({ productId: item.productId, productName: item.productName, maxStock: item.stock })}
                                >
                                  Transfer Stock
                                </Button>
                              </div>
                            )}
                          </Card>
                        ))
                      ) : (
                        <div className="col-span-full py-12 text-center text-muted-foreground">
                          <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          <p>No products assigned to this warehouse yet.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="drivers">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {drivers?.filter((d: any) => d.warehouseId === viewingWarehouse.id).length ? (
                        drivers.filter((d: any) => d.warehouseId === viewingWarehouse.id).map((d: any) => (
                          <Card key={d.id} className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                               {d.photoUrl ? <img src={d.photoUrl} className="w-full h-full object-cover" /> : <Truck className="w-6 h-6 opacity-50" />}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{d.name}</p>
                              <p className="text-xs text-muted-foreground">{d.phone}</p>
                              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                {d.status}
                              </span>
                            </div>
                          </Card>
                        ))
                      ) : (
                        <div className="col-span-full py-12 text-center text-muted-foreground">
                          <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          <p>No drivers assigned to this warehouse yet.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </Card>
          </div>
        )}

        {transferModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <Card className="w-full max-w-sm shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Transfer Stock</h3>
                <Button variant="ghost" size="sm" onClick={() => setTransferModal(null)}>✕</Button>
              </div>
              <div className="space-y-4">
                <p className="text-sm font-medium">{transferModal.productName}</p>
                <div className="space-y-1.5">
                  <Label>Destination Warehouse</Label>
                  <Select value={transferForm.toWarehouseId} onValueChange={(val) => setTransferForm({ ...transferForm, toWarehouseId: val })}>
                    <SelectTrigger><SelectValue placeholder="Select Destination" /></SelectTrigger>
                    <SelectContent>
                      {warehouses?.filter((w: any) => w.id !== viewingWarehouse?.id).map((w: any) => (
                        <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Quantity to Transfer (Max: {transferModal.maxStock})</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    max={transferModal.maxStock} 
                    value={transferForm.quantity} 
                    onChange={(e) => setTransferForm({ ...transferForm, quantity: parseInt(e.target.value) || 1 })} 
                  />
                </div>
                <Button 
                  className="w-full bg-[var(--brand)] text-white" 
                  disabled={!transferForm.toWarehouseId || transferForm.quantity < 1 || transferForm.quantity > transferModal.maxStock || createDirectTransfer.isPending}
                  onClick={() => createDirectTransfer.mutate({ productId: transferModal.productId, fromWarehouseId: viewingWarehouse.id, toWarehouseId: parseInt(transferForm.toWarehouseId), quantity: transferForm.quantity })}
                >
                  {createDirectTransfer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Initiate Transfer"}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {showTransfers && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
            <Card className="w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
                <div>
                  <h3 className="text-2xl font-bold">Inventory Transfers & Restocks</h3>
                  <p className="text-sm text-muted-foreground">Manage product movements between warehouses.</p>
                </div>
                <Button variant="ghost" onClick={() => setShowTransfers(false)}>✕</Button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 bg-background">
                {loadingTransfers ? (
                   <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : (
                   <table className="w-full text-sm">
                     <thead className="bg-muted/50 border-b border-border">
                       <tr>
                         <th className="text-left py-3 px-4">Date</th>
                         <th className="text-left py-3 px-4">Product</th>
                         <th className="text-left py-3 px-4">Qty</th>
                         <th className="text-left py-3 px-4">From</th>
                         <th className="text-left py-3 px-4">To</th>
                         <th className="text-left py-3 px-4">Status</th>
                         <th className="text-right py-3 px-4">Action</th>
                       </tr>
                     </thead>
                     <tbody>
                       {transfers?.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No transfers found.</td></tr>}
                       {transfers?.map((t: any) => {
                         const isAdmin = user?.role === "admin";
                         const isDestManager = user?.warehouseId === t.toWarehouseId || isAdmin;
                         const isSourceManager = user?.warehouseId === t.fromWarehouseId || isAdmin;
                         const fromName = t.fromWarehouseId ? warehouses?.find((w: any) => w.id === t.fromWarehouseId)?.name : "External / Pending";
                         const toName = warehouses?.find((w: any) => w.id === t.toWarehouseId)?.name;
                         
                         return (
                           <tr key={t.id} className="border-b border-border hover:bg-secondary/50">
                             <td className="py-3 px-4">{new Date(t.createdAt).toLocaleDateString()}</td>
                             <td className="py-3 px-4 font-medium">{t.productName}</td>
                             <td className="py-3 px-4">{t.quantity}</td>
                             <td className="py-3 px-4 text-muted-foreground">{fromName}</td>
                             <td className="py-3 px-4 text-muted-foreground">{toName}</td>
                             <td className="py-3 px-4">
                               <span className="text-xs bg-muted px-2 py-1 rounded-md font-mono">{t.status.replace(/_/g, " ")}</span>
                             </td>
                             <td className="py-3 px-4 text-right">
                               {t.status === "pending_admin_approval" && isAdmin && (
                                 <div className="flex flex-col gap-2 min-w-[200px] justify-end items-end">
                                   <Select onValueChange={(val) => approveTransfer.mutate({ transferId: t.id, fromWarehouseId: parseInt(val) })}>
                                      <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Approve Transfer From..." /></SelectTrigger>
                                      <SelectContent>
                                        {warehouses?.filter((w: any) => w.id !== t.toWarehouseId).map((w: any) => <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>)}
                                      </SelectContent>
                                   </Select>
                                   <Button size="sm" variant="outline" disabled={fulfillExternal.isPending} className="h-8 text-xs bg-green-50 text-green-700 hover:bg-green-100 border-green-200 w-full" onClick={() => fulfillExternal.mutate({ transferId: t.id })}>
                                     Order New / Fulfill Externally
                                   </Button>
                                 </div>
                               )}
                               {t.status === "pending_sender_fulfillment" && isSourceManager && (
                                 <Select onValueChange={(val) => dispatchTransfer.mutate({ transferId: t.id, driverId: parseInt(val) })}>
                                    <SelectTrigger className="h-8 text-xs w-full min-w-[150px]"><SelectValue placeholder="Dispatch via Driver..." /></SelectTrigger>
                                    <SelectContent>
                                      {drivers?.map((d: any) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                 </Select>
                               )}
                               {t.status === "in_transit" && isDestManager && (
                                 <Button size="sm" disabled={receiveTransfer.isPending} className="bg-[var(--brand)] text-white" onClick={() => receiveTransfer.mutate({ transferId: t.id })}>Confirm Receipt</Button>
                               )}
                             </td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}