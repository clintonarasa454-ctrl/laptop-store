import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, CheckCircle2, ArrowUpDown, X } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export default function AdminAssignments() {
  const { data: assignments, isLoading: assignmentsLoading } = trpc.fleet.getAssignments.useQuery(undefined, {
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const { data: drivers, isLoading: driversLoading } = trpc.fleet.getDrivers.useQuery(undefined, {
    staleTime: 0, refetchInterval: 5000, refetchOnWindowFocus: true
  });
  const { data: vehicles, isLoading: vehiclesLoading } = trpc.fleet.getVehicles.useQuery(undefined, {
    staleTime: 0, refetchInterval: 5000, refetchOnWindowFocus: true
  });
  
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({ driverId: "", vehicleId: "" });
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnAssignmentId, setReturnAssignmentId] = useState<number | null>(null);
  const [inspectionNotes, setInspectionNotes] = useState("");

  const { data: returnDetails, isLoading: loadingReturnDetails } = trpc.fleet.getReturnRequestDetails.useQuery(
    { assignmentId: returnAssignmentId ?? 0 },
    { enabled: !!returnAssignmentId }
  );

  const createAssignment = trpc.fleet.createAssignment.useMutation({
    onSuccess: () => {
      utils.fleet.getAssignments.invalidate();
      utils.fleet.getVehicles.invalidate();
      setShowForm(false);
      setFormData({ driverId: "", vehicleId: "" });
      toast.success("Assignment created successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const returnAssignment = trpc.fleet.returnAssignment.useMutation({
    onSuccess: () => {
      utils.fleet.getAssignments.invalidate();
      utils.fleet.getVehicles.invalidate();
      toast.success("Vehicle return confirmed successfully");
      setReturnModalOpen(false);
      setReturnAssignmentId(null);
      setInspectionNotes("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.driverId || !formData.vehicleId) {
      toast.error("Please select both a driver and vehicle");
      return;
    }
    createAssignment.mutate({
      driverId: Number(formData.driverId),
      vehicleId: Number(formData.vehicleId),
    });
  };

  const handleReturnAssignment = (assignmentId: number) => {
    setReturnAssignmentId(assignmentId);
    setInspectionNotes("");
    setReturnModalOpen(true);
  };

  const confirmReturn = () => {
    if (returnAssignmentId) {
      returnAssignment.mutate({ assignmentId: returnAssignmentId, inspectionNotes });
    }
  };

  // The API already returns a flat structure
  const flatAssignments = (assignments || []).map((item: any) => ({
    id: item.id,
    driverId: item.driverId,
    vehicleId: item.vehicleId,
    driverName: item.driverName || 'Unknown',
    vehicleName: item.vehicleName || 'Unknown',
    numberPlate: item.vehiclePlate || 'Unknown',
    status: item.status,
    assignedAt: item.assignedAt,
    raw: item // Keep original for reference
  }));

  const filteredAssignments = flatAssignments || [];
  
  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    if (!sortConfig) return 0;
    let aVal = a[sortConfig.key] || "";
    let bVal = b[sortConfig.key] || "";
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedAssignments.length / itemsPerPage);
  const paginatedAssignments = sortedAssignments.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Get available vehicles (not assigned)
  const availableVehicles = vehicles?.filter(v => v.status === 'available') || [];
  
  // Get active drivers
  const activeDrivers = drivers?.filter(d => d.status === 'active') || [];

  return (
    <AdminLayout activeTab="assignments">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Vehicle Assignments</h2>
            <p className="text-muted-foreground mt-1">
              Assign vehicles to drivers and manage active assignments
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2 bg-[var(--brand)] text-white hover:opacity-90" disabled={availableVehicles.length === 0 || activeDrivers.length === 0}>
            <Plus size={18} /> Create Assignment
          </Button>
        </div>

        {availableVehicles.length === 0 && (
          <Card className="p-4 bg-yellow-50 border-yellow-200">
            <p className="text-sm text-yellow-800">No vehicles available for assignment. All vehicles are currently assigned or in maintenance.</p>
          </Card>
        )}

        {activeDrivers.length === 0 && (
          <Card className="p-4 bg-yellow-50 border-yellow-200">
            <p className="text-sm text-yellow-800">No active drivers available. Please create or activate drivers first.</p>
          </Card>
        )}

        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('driverName')}>
                    <div className="flex items-center gap-1">Driver <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('vehicleName')}>
                    <div className="flex items-center gap-1">Vehicle <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('numberPlate')}>
                    <div className="flex items-center gap-1">Plate <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold">Assigned</th>
                  <th className="text-center py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignmentsLoading ? (
                  <tr key="loading"><td colSpan={6} className="py-8 text-center"><Loader2 className="mx-auto animate-spin" /></td></tr>
                ) : paginatedAssignments && paginatedAssignments.length > 0 ? (
                  paginatedAssignments.map((item: any) => (
                    <tr key={item.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="py-3 px-4 font-medium">{item.driverName}</td>
                      <td className="py-3 px-4 text-muted-foreground">{item.vehicleName}</td>
                      <td className="py-3 px-4 text-muted-foreground">{item.numberPlate}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                          item.status === 'active' ? "bg-blue-100 text-blue-800" : 
                          item.status === 'pending_return' ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                        }`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(item.assignedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          {(item.status === 'active' || item.status === 'pending_return') && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-green-600 hover:bg-green-100"
                              onClick={() => handleReturnAssignment(item.id)}
                              disabled={returnAssignment.isPending}
                              title="Confirm Vehicle Return"
                            >
                              <CheckCircle2 size={16} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr key="empty"><td colSpan={6} className="py-8 text-center text-muted-foreground">No assignments found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {!assignmentsLoading && filteredAssignments.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border mt-4">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, sortedAssignments.length)} of {sortedAssignments.length} entries
              </p>
              <div className="flex items-center gap-4">
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
              <form onSubmit={handleCreateAssignment} className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold">Create Assignment</h3>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>✕</Button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Select Driver *</Label>
                    <Select value={formData.driverId} onValueChange={(val) => setFormData({ ...formData, driverId: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a driver" />
                      </SelectTrigger>
                      <SelectContent>
                        {driversLoading ? (
                          <p key="loading">Loading drivers...</p>
                        ) : activeDrivers.length > 0 ? (
                          activeDrivers.map(driver => (
                            <SelectItem key={driver.id} value={String(driver.id)}>{driver.name}</SelectItem>
                          ))
                        ) : (
                          <p key="empty">No active drivers</p>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Select Vehicle *</Label>
                    <Select value={formData.vehicleId} onValueChange={(val) => setFormData({ ...formData, vehicleId: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehiclesLoading ? (
                          <p key="loading">Loading vehicles...</p>
                        ) : availableVehicles.length > 0 ? (
                          availableVehicles.map(vehicle => (
                            <SelectItem key={vehicle.id} value={String(vehicle.id)}>{vehicle.name} ({vehicle.numberPlate})</SelectItem>
                          ))
                        ) : (
                          <p key="empty">No available vehicles</p>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 bg-[var(--brand)] text-white hover:opacity-90" disabled={createAssignment.isPending}>
                    {createAssignment.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Create Assignment"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {returnModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Confirm Vehicle Return</h3>
                <Button variant="ghost" size="sm" onClick={() => setReturnModalOpen(false)}><X className="w-4 h-4" /></Button>
              </div>
              <p className="text-sm text-muted-foreground">Please enter any inspection notes (optional) before confirming the vehicle return.</p>
              
              {loadingReturnDetails ? (
                <div className="py-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
              ) : returnDetails && (
                <div className="bg-muted/30 p-3 rounded-lg border border-border space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Driver's Return Submission</h4>
                  {(returnDetails as any).imageUrl && (
                    <a href={(returnDetails as any).imageUrl} target="_blank" rel="noreferrer">
                      <img src={(returnDetails as any).imageUrl} alt="Vehicle condition" className="w-full h-32 object-cover rounded border border-border" />
                    </a>
                  )}
                  {(returnDetails as any).notes && <p className="text-sm">"{(returnDetails as any).notes}"</p>}
                  {!(returnDetails as any).imageUrl && !(returnDetails as any).notes && <p className="text-sm text-muted-foreground italic">No photos or notes provided by driver.</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label>Inspection Notes</Label>
                <Textarea 
                  placeholder="e.g. Scratches on the left door, fuel tank half full..." 
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setReturnModalOpen(false)}>Cancel</Button>
                <Button onClick={confirmReturn} disabled={returnAssignment.isPending} className="flex-1 bg-green-600 text-white hover:bg-green-700">
                  {returnAssignment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Return"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
