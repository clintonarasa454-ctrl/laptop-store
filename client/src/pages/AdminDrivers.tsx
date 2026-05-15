import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2, Edit2, ArrowUpDown, Upload, User, Camera, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/pages/useAuth";
import { ImageCropperModal } from "@/components/ImageCropperModal";
import { DeletionRequestModal } from "@/components/DeletionRequestModal";

export default function AdminDrivers() {
  const { user } = useAuth();
  const { data: drivers, isLoading } = trpc.fleet.getDrivers.useQuery(undefined, {
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
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const createPresignedUrl = trpc.admin.createPresignedUrl.useMutation();

  useEffect(() => {
    setPage(1);
  }, [itemsPerPage, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const upsertDriver = trpc.fleet.upsertDriver.useMutation({
    onSuccess: (data) => {
      utils.fleet.getDrivers.invalidate();
      setShowForm(false);
      setFormData({});
      
      if (data.generatedPin) {
        alert(`Driver saved successfully.\n\nIMPORTANT:\nThe new access PIN for this driver is: ${data.generatedPin}\n\nAn email containing this PIN has been automatically sent to the driver.`);
        toast.success(`Driver saved! New PIN: ${data.generatedPin} (Emailed to driver)`, { duration: 10000 });
      } else {
        toast.success("Driver saved successfully");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteDriver = trpc.fleet.deleteDriver.useMutation({
    onSuccess: () => {
      utils.fleet.getDrivers.invalidate();
      toast.success("Driver deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileToCrop(file);
    e.target.value = '';
  };

  const handlePhotoUpload = async (file: File) => {
    setFileToCrop(null);
    setPhotoFile(file);
    setIsUploadingPhoto(true);
    try {
      const presignedUrl = await createPresignedUrl.mutateAsync({
        filename: file.name,
        contentType: file.type,
      });

      if (!presignedUrl.uploadUrl) throw new Error("Could not get upload URL");
      const response = await fetch(presignedUrl.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (response.ok) {
        setFormData((prev: any) => ({ ...prev, photoUrl: presignedUrl.publicUrl || "" }));
        toast.success("Photo uploaded successfully!");
      }
    } catch (err) {
      toast.error("Failed to upload photo");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.generatePin && !formData.email?.trim()) {
      return toast.error("An email address is required so the new PIN can be sent to the driver.");
    }

    upsertDriver.mutate({
      id: formData.id,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      licenseNumber: formData.licenseNumber,
      status: formData.status || "active",
      generatePin: formData.generatePin,
      photoUrl: formData.photoUrl,
      warehouseId: formData.warehouseId ? parseInt(formData.warehouseId) : undefined,
    } as any);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this driver?")) {
      deleteDriver.mutate({ id });
    }
  };

  const openForm = (driver?: any) => {
    if (driver) {
      setFormData({ ...driver, generatePin: false, warehouseId: driver.warehouseId?.toString() || "" });
    } else {
      setFormData({ name: "", phone: "", email: "", licenseNumber: "", status: "active", generatePin: true, warehouseId: "" });
    }
    setPhotoFile(null);
    setShowForm(true);
  };

  const filteredDrivers = drivers || [];
  
  const sortedDrivers = [...filteredDrivers].sort((a, b) => {
    if (!sortConfig) return 0;
    let aVal = a[sortConfig.key] || "";
    let bVal = b[sortConfig.key] || "";
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
                  <th className="text-left py-3 px-4 font-semibold w-12">Photo</th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Name <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('phone')}>
                    <div className="flex items-center gap-1">Phone <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('email')}>
                    <div className="flex items-center gap-1">Email <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="py-8 text-center"><Loader2 className="mx-auto animate-spin" /></td></tr>
                ) : paginatedDrivers && paginatedDrivers.length > 0 ? (
                  paginatedDrivers.map((driver: any) => (
                    <tr key={driver.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="py-3 px-4">
                        {driver.photoUrl ? (
                          <img src={driver.photoUrl} alt={driver.name} className="w-8 h-8 rounded-full object-cover border border-border" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><User className="w-4 h-4 text-muted-foreground opacity-50"/></div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium">{driver.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{driver.phone}</td>
                      <td className="py-3 px-4 text-muted-foreground">{driver.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${driver.status === 'active' ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                          {driver.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openForm(driver)}><Edit2 size={16} /></Button>
                          {(user?.role === "admin" || user?.role === "manager") && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:bg-destructive/10" 
                              onClick={() => {
                              if (user?.role === "manager") {
                              setDeletionRequest({ isOpen: true, itemId: driver.id.toString(), itemName: driver.name });
                              } else {
                                handleDelete(driver.id);
                              }
                            }}
                            title={user?.role === "manager" ? "Request Driver Dismissal" : "Fire Driver"}
                            >
                              <ShieldAlert size={16} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No drivers found</td></tr>
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
                   <div className="flex items-center gap-4 mb-2">
                     <div className="relative">
                       <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="driver-photo-upload" disabled={isUploadingPhoto} />
                       <label htmlFor="driver-photo-upload" className="cursor-pointer block relative">
                        {formData.photoUrl || photoFile ? (
                          <img src={photoFile ? URL.createObjectURL(photoFile) : formData.photoUrl} alt="Preview" className="w-16 h-16 rounded-full object-cover border border-border shadow-sm" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border border-dashed border-border hover:border-[var(--brand)]/50 transition-colors shadow-sm">
                            <Upload size={20} className="text-muted-foreground opacity-50" />
                          </div>
                        )}
                        {isUploadingPhoto && (
                          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                          </div>
                        )}
                      </label>
                    </div>
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Profile Photo (Optional)</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Upload a clear photo for customer identification.</p>
                    </div>
                  </div>
                  <div className="space-y-1.5"><Label>Full Name *</Label><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Phone Number *</Label><Input required placeholder="+254 712 345 678" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Email {formData.generatePin && "*"}</Label><Input type="email" required={formData.generatePin} placeholder="driver@example.com" value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>License Number</Label><Input placeholder="e.g., AB12345" value={formData.licenseNumber || ""} onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })} /></div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={formData.status || "active"} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
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

                  {!formData.id ? (
                    <div className="bg-[var(--brand)]/10 p-3 rounded-lg border border-[var(--brand)]/20 text-sm text-[var(--brand)] mt-2 font-medium">
                      A unique 6-character access PIN will be generated automatically.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-2 p-3 bg-muted/30 rounded-lg border border-border/50 hover:border-[var(--brand)]/30 transition-colors">
                      <input type="checkbox" id="regenerate" checked={formData.generatePin} onChange={(e) => setFormData({...formData, generatePin: e.target.checked})} className="rounded border-input w-4 h-4 text-[var(--brand)] focus:ring-[var(--brand)]" />
                      <Label htmlFor="regenerate" className="text-sm font-normal cursor-pointer text-muted-foreground hover:text-foreground">Generate and email a new access PIN for this driver</Label>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 bg-[var(--brand)] text-white hover:opacity-90" disabled={upsertDriver.isPending}>
                    {upsertDriver.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Save Driver"}
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
        itemType="driver"
        itemId={deletionRequest.itemId}
        itemName={deletionRequest.itemName}
      />
    )}
    
    {/* Simple Image Cropper Modal */}
    {fileToCrop && (
      <ImageCropperModal
        file={fileToCrop}
        onCrop={(file) => handlePhotoUpload(file)}
        onCancel={() => setFileToCrop(null)}
        title="Crop Driver Photo"
      />
    )}
      </div>
    </AdminLayout>
  );
}