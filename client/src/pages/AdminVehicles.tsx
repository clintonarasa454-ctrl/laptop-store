import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2, Edit2, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/pages/useAuth";
import { DeletionRequestModal } from "@/components/DeletionRequestModal";

export default function AdminVehicles() {
  const { user } = useAuth();
  const { data: vehicles, isLoading } = trpc.fleet.getVehicles.useQuery(undefined, {
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const utils = trpc.useUtils();
  const { data: warehouses } = trpc.admin.warehouses.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [deletionRequest, setDeletionRequest] = useState<{ isOpen: boolean; itemId: string; itemName: string } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [itemsPerPage, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const upsertVehicle = trpc.fleet.upsertVehicle.useMutation({
    onSuccess: () => {
      utils.fleet.getVehicles.invalidate();
      setShowForm(false);
      setFormData({});
      toast.success("Vehicle saved successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteVehicle = trpc.fleet.deleteVehicle.useMutation({
    onSuccess: () => {
      utils.fleet.getVehicles.invalidate();
      toast.success("Vehicle deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    upsertVehicle.mutate({
      id: formData.id,
      name: formData.name,
      numberPlate: formData.numberPlate,
      type: formData.type || "car",
      status: formData.status || "available",
      warehouseId: formData.warehouseId ? parseInt(formData.warehouseId) : undefined,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this vehicle?")) {
      deleteVehicle.mutate({ id });
    }
  };

  const openForm = (vehicle?: any) => {
    if (vehicle) {
      setFormData({ ...vehicle, warehouseId: vehicle.warehouseId?.toString() || "" });
    } else {
      setFormData({ name: "", numberPlate: "", type: "car", status: "available", warehouseId: "" });
    }
    setShowForm(true);
  };

  const filteredVehicles = vehicles || [];
  
  const sortedVehicles = [...filteredVehicles].sort((a, b) => {
    if (!sortConfig) return 0;
    let aVal = a[sortConfig.key] || "";
    let bVal = b[sortConfig.key] || "";
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedVehicles.length / itemsPerPage);
  const paginatedVehicles = sortedVehicles.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <AdminLayout activeTab="vehicles">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Fleet Vehicles</h2>
            <p className="text-muted-foreground mt-1">
              Manage your delivery fleet and vehicle assignments
            </p>
          </div>
          <Button onClick={() => openForm()} className="gap-2 bg-[var(--brand)] text-white hover:opacity-90">
            <Plus size={18} /> Add Vehicle
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
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('numberPlate')}>
                    <div className="flex items-center gap-1">License Plate <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('type')}>
                    <div className="flex items-center gap-1">Type <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="py-8 text-center"><Loader2 className="mx-auto animate-spin" /></td></tr>
                ) : paginatedVehicles && paginatedVehicles.length > 0 ? (
                  paginatedVehicles.map((vehicle: any) => (
                    <tr key={vehicle.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="py-3 px-4 font-medium">{vehicle.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{vehicle.numberPlate}</td>
                      <td className="py-3 px-4 capitalize">{vehicle.type}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                          vehicle.status === 'available' ? "bg-green-100 text-green-800" : 
                          vehicle.status === 'assigned' ? "bg-blue-100 text-blue-800" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {vehicle.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openForm(vehicle)}><Edit2 size={16} /></Button>
                          {(user?.role === "admin" || user?.role === "manager") && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => {
                              if (user?.role === "manager") {
                              setDeletionRequest({ isOpen: true, itemId: vehicle.id.toString(), itemName: vehicle.name });
                              } else {
                                handleDelete(vehicle.id);
                              }
                            }}><Trash2 size={16} /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No vehicles found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && filteredVehicles.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border mt-4">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, sortedVehicles.length)} of {sortedVehicles.length} entries
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
                  <h3 className="text-xl font-bold">{formData.id ? "Edit Vehicle" : "Add New Vehicle"}</h3>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>✕</Button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Vehicle Name *</Label><Input required placeholder="e.g., Toyota Hiace" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>License Plate *</Label><Input required placeholder="e.g., KBA 123A" value={formData.numberPlate} onChange={(e) => setFormData({ ...formData, numberPlate: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Vehicle Type *</Label>
                      <Select value={formData.type || "car"} onValueChange={(val) => setFormData({ ...formData, type: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="car">Car</SelectItem>
                          <SelectItem value="motorcycle">Motorcycle</SelectItem>
                          <SelectItem value="truck">Truck</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={formData.status || "available"} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="assigned">Assigned</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {user?.role === "admin" && (
                    <div className="space-y-1.5">
                      <Label>Assign to Warehouse (Optional)</Label>
                      <Select value={formData.warehouseId || "none"} onValueChange={(val) => setFormData({ ...formData, warehouseId: val === "none" ? "" : val })}>
                        <SelectTrigger><SelectValue placeholder="Global / All Hubs" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Global / All Hubs</SelectItem>
                          {warehouses?.map((w: any) => (
                            <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 bg-[var(--brand)] text-white hover:opacity-90" disabled={upsertVehicle.isPending}>
                    {upsertVehicle.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Save Vehicle"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

    {deletionRequest && (
      <DeletionRequestModal
        isOpen={deletionRequest.isOpen}
        onClose={() => setDeletionRequest(null)}
        itemType="vehicle"
        itemId={deletionRequest.itemId}
        itemName={deletionRequest.itemName}
      />
    )}
      </div>
    </AdminLayout>
  );
}
