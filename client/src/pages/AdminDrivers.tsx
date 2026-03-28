import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2, Edit2, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

export default function AdminDrivers() {
  const { data: drivers, isLoading } = trpc.delivery.getAgents.useQuery(undefined, {
    refetchInterval: 10000
  });
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [itemsPerPage, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const upsertAgent = trpc.delivery.upsertAgent.useMutation({
    onSuccess: () => {
      utils.delivery.getAgents.invalidate();
      setShowForm(false);
      setFormData({});
      toast.success("Driver saved successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAgent = trpc.delivery.deleteAgent.useMutation({
    onSuccess: () => {
      utils.delivery.getAgents.invalidate();
      toast.success("Driver deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    upsertAgent.mutate({
      id: formData.id,
      name: formData.name,
      phone: formData.phone,
      vehicleNumber: formData.vehicleNumber,
      vehicleType: formData.vehicleType || "bike",
      pin: formData.pin,
      isAvailable: formData.isAvailable ?? true
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this driver?")) {
      deleteAgent.mutate({ id });
    }
  };

  const openForm = (driver?: any) => {
    if (driver) {
      setFormData({ ...driver, pin: "" }); // Never pre-fill pin
    } else {
      setFormData({ name: "", phone: "", vehicleNumber: "", vehicleType: "bike", pin: "", isAvailable: true });
    }
    setShowForm(true);
  };

  const filteredDrivers = drivers || [];
  
  const sortedDrivers = [...filteredDrivers].sort((a, b) => {
    if (!sortConfig) return 0;
    let aVal = a[sortConfig.key] || "";
    let bVal = b[sortConfig.key] || "";
    if (sortConfig.key === "isAvailable") {
      aVal = aVal ? 1 : 0;
      bVal = bVal ? 1 : 0;
    }
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedDrivers.length / itemsPerPage);
  const paginatedDrivers = sortedDrivers.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <AdminLayout activeTab="drivers">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Delivery Drivers</h2>
            <p className="text-muted-foreground mt-1">
              Manage your delivery agents and vehicles
            </p>
          </div>
          <Button onClick={() => openForm()} className="gap-2 bg-[var(--brand)] text-white hover:opacity-90">
            <Plus size={18} /> Add Driver
          </Button>
        </div>

        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Name <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('phone')}>
                    <div className="flex items-center gap-1">Phone <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('vehicleType')}>
                    <div className="flex items-center gap-1">Vehicle <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('isAvailable')}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="py-8 text-center"><Loader2 className="mx-auto animate-spin" /></td></tr>
                ) : paginatedDrivers && paginatedDrivers.length > 0 ? (
                  paginatedDrivers.map((driver: any) => (
                    <tr key={driver.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="py-3 px-4 font-medium">{driver.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{driver.phone}</td>
                      <td className="py-3 px-4">
                        <span className="capitalize">{driver.vehicleType}</span> — {driver.vehicleNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${driver.isAvailable ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                          {driver.isAvailable ? "Available" : "Busy / Offline"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openForm(driver)}><Edit2 size={16} /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(driver.id)}><Trash2 size={16} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No drivers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && filteredDrivers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border mt-4">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, sortedDrivers.length)} of {sortedDrivers.length} entries
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

        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md shadow-xl">
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold">{formData.id ? "Edit Driver" : "Add New Driver"}</h3>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>✕</Button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Full Name *</Label><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Phone Number *</Label><Input required placeholder="+254 712 345 678" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Vehicle Type *</Label>
                      <Select value={formData.vehicleType || "bike"} onValueChange={(val) => setFormData({ ...formData, vehicleType: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bike">Bike / Motorcycle</SelectItem>
                          <SelectItem value="car">Car</SelectItem>
                          <SelectItem value="truck">Truck / Van</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>License Plate *</Label><Input required placeholder="KDA 123X" value={formData.vehicleNumber} onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })} /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{formData.id ? "Update Access PIN" : "Access PIN *"}</Label>
                    <Input type="password" placeholder="••••" maxLength={4} required={!formData.id} value={formData.pin || ""} onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "") })} />
                    {formData.id && <p className="text-xs text-muted-foreground">Leave blank to keep current PIN.</p>}
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg mt-2">
                    <Label className="cursor-pointer">Currently Available</Label>
                    <Switch checked={formData.isAvailable ?? true} onCheckedChange={(c) => setFormData({ ...formData, isAvailable: c })} />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 bg-[var(--brand)] text-white hover:opacity-90" disabled={upsertAgent.isPending}>
                    {upsertAgent.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Save Driver"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}