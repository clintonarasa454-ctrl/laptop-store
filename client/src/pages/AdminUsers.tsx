import { useState, useEffect } from "react";
import { toast } from "sonner";
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
import { Search, Eye, Mail, Lock, Loader2, ArrowUpDown, Sparkles, Plus, Upload, CheckCircle, ShieldAlert, Edit, Trash2, Camera } from "lucide-react";
import { useAuth } from "@/pages/useAuth";
import { ImageCropperModal } from "@/components/ImageCropperModal";
import { useSearch } from "wouter";

type UserRole = "user" | "manager" | "admin";

export default function AdminUsers() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("user");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [showAddManager, setShowAddManager] = useState(false);
  const [formData, setFormData] = useState<{
    id?: number;
    name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    warehouseId: string;
    photoId: string;
  }>({
    id: undefined,
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "manager",
    warehouseId: "",
    photoId: "",
  });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);
  const [photoIdFile, setPhotoIdFile] = useState<File | null>(null);
  const searchString = useSearch();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedRole, itemsPerPage, sortConfig]);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("newManager") === "true") {
      const wId = params.get("warehouseId");
      setFormData(prev => ({ ...prev, role: "manager", warehouseId: wId || "" }));
      setSelectedRole("manager");
      setShowAddManager(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchString]);

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Fetch all matching users so we can accurately count roles across all tabs
  const { data: allUsers, isLoading } = trpc.admin.users.useQuery(
    { search: debouncedSearch || undefined },
    { staleTime: 0, refetchInterval: 5000, refetchOnWindowFocus: true }
  );

  const { data: warehouses } = trpc.admin.warehouses.useQuery();

  const createPresignedUrl = trpc.admin.createPresignedUrl.useMutation();

  const upsertUser = trpc.admin.upsertUser.useMutation({
    onSuccess: (_, variables) => {
      utils.admin.users.invalidate();
      utils.admin.warehouses.invalidate(); // Keeps the Warehouse panel in sync
      
      if (showAddManager) {
        toast.success(variables.id ? "User profile updated successfully!" : `${variables.role} created successfully!`);
        setShowAddManager(false);
        setFormData({
          id: undefined,
          name: "",
          email: "",
          phone: "",
          password: "",
          role: "manager",
          warehouseId: "",
          photoId: "",
        });
        setPhotoIdFile(null);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPassword = trpc.auth.resetPasswordRequest.useMutation({
    onSuccess: () => toast.success("Password reset link sent!"),
    onError: (err) => toast.error(err.message),
  });

  const triggerAIMarketing = trpc.admin.triggerAIMarketing.useMutation({
    onSuccess: (data) => toast.success(`Successfully sent AI personalized marketing emails to ${data.sentCount} users!`),
    onError: (err) => toast.error(err.message)
  });

  const toggleSuspension = trpc.admin.toggleUserSuspension.useMutation({
    onSuccess: () => {
      toast.success("User access updated!");
      utils.admin.users.invalidate();
      utils.admin.warehouses.invalidate();
      setSelectedUser((prev: any) => prev ? { ...prev, suspended: !prev.suspended } : null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("User permanently deleted!");
      utils.admin.users.invalidate();
      utils.admin.warehouses.invalidate();
      setSelectedUser(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const fireManager = trpc.admin.fireManager.useMutation({
    onSuccess: () => {
      toast.success("Manager fired. Dismissal email sent.");
      utils.admin.users.invalidate();
      utils.admin.warehouses.invalidate();
      setSelectedUser(null);
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
        setFormData(prev => ({ ...prev, photoId: presignedUrl.publicUrl || "" }));
        toast.success("Photo uploaded successfully!");
      }
    } catch (err) {
      toast.error("Failed to upload photo");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmitManager = async () => {
    if (!formData.name || !formData.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    await upsertUser.mutateAsync({
      id: formData.id,
      name: formData.name,
      email: formData.email,
      phone: formData.phone || undefined,
      role: formData.role as "manager" | "admin",
      warehouseId: formData.warehouseId ? parseInt(formData.warehouseId) : undefined,
      photoId: formData.photoId || undefined,
    });
  };

  const filteredUsers = allUsers?.filter((u: any) => u.role === selectedRole) || [];

  const roleCounts = {
    user: allUsers?.filter((u: any) => u.role === "user").length || 0,
    manager: allUsers?.filter((u: any) => u.role === "manager").length || 0,
    admin: allUsers?.filter((u: any) => u.role === "admin").length || 0,
  };

  const availableRoles = user?.role === "admin" ? (["user", "manager", "admin"] as const) : (["user", "manager"] as const);

  useEffect(() => {
    if (user && user.role !== "admin" && selectedRole === "admin") {
      setSelectedRole("user");
    }
  }, [user, selectedRole]);

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortConfig) return 0;
    let aVal = a[sortConfig.key as keyof typeof a] || "";
    let bVal = b[sortConfig.key as keyof typeof b] || "";
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const paginatedUsers = sortedUsers.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const roleColors: Record<string, string> = {
    user: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    manager: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };

  return (
    <AdminLayout activeTab="users">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold">Users Management</h2>
            <p className="text-muted-foreground mt-1">
              View and manage all system users
            </p>
          </div>
          <div className="flex gap-2">
          {user?.role === "admin" && (
              <Button onClick={() => {
                setFormData(prev => ({ ...prev, role: selectedRole, id: undefined }));
                setShowAddManager(true);
              }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm">
                <Plus className="w-4 h-4" />
                Add {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
              </Button>
            )}
            <Button onClick={() => triggerAIMarketing.mutate()} disabled={triggerAIMarketing.isPending} className="bg-pink-600 hover:bg-pink-700 text-white gap-2 shadow-sm">
              {triggerAIMarketing.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Run AI Campaign
            </Button>
          </div>
        </div>

        {/* Role Filter Tabs */}
        <div className="flex gap-2 border-b border-border overflow-x-auto">
          {availableRoles.map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                selectedRole === role
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)} ({roleCounts[role]})
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div className={`grid grid-cols-1 ${user?.role === 'admin' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground font-medium">Total Users</p>
            <p className="text-3xl font-bold mt-2">{allUsers?.length || 0}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground font-medium">Managers</p>
            <p className="text-3xl font-bold mt-2">{roleCounts.manager}</p>
          </Card>
          {user?.role === "admin" && (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground font-medium">Admins</p>
              <p className="text-3xl font-bold mt-2">{roleCounts.admin}</p>
            </Card>
          )}
        </div>

        {/* Search */}
        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-muted-foreground" size={18} />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Users Table */}
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Name <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('email')}>
                    <div className="flex items-center gap-1">Email <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('role')}>
                    <div className="flex items-center gap-1">Role <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('createdAt')}>
                    <div className="flex items-center gap-1">Joined <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('lastSignedIn')}>
                    <div className="flex items-center gap-1">Last Seen <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-muted-foreground">
                      Loading users...
                    </td>
                  </tr>
                ) : paginatedUsers.length > 0 ? (
                  paginatedUsers.map((user: any) => (
                    <tr key={user.id} className="border-b border-border hover:bg-secondary transition-colors">
                      <td className="py-3 px-4 font-medium">{user.name || "-"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                          {user.role}
                        </span>
                        {user.suspended && (
                          <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-[10px] rounded-full font-bold">Suspended</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {new Date(user.lastSignedIn).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Eye size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && filteredUsers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border mt-4">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, sortedUsers.length)} of {sortedUsers.length} entries
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

        {/* User Details Modal */}
        {selectedUser && (
          <Card className="p-6 fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">User Profile</h3>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedUser(null)}
                  >
                    ✕
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-semibold text-lg">{selectedUser.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-mono text-sm">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-semibold">{selectedUser.phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <p className="font-semibold capitalize">{selectedUser.role}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Member Since</p>
                    <p className="font-semibold">
                      {new Date(selectedUser.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Seen</p>
                    <p className="font-semibold">
                      {new Date(selectedUser.lastSignedIn).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-semibold">{selectedUser.suspended ? <span className="text-destructive">Suspended</span> : <span className="text-green-600">Active</span>}</p>
                  </div>
                  
                  {selectedUser.photoId && (
                    <div className="col-span-2 pt-2">
                      <p className="text-sm text-muted-foreground mb-2">Photo ID</p>
                      <img src={selectedUser.photoId} alt="ID" className="w-40 h-auto object-cover rounded-xl border border-border shadow-sm" />
                    </div>
                  )}

                  {selectedUser.role === 'manager' && user?.role === 'admin' && (
                    <div className="col-span-2 pt-2 pb-1 border-t border-border mt-2">
                      <p className="text-sm text-muted-foreground mb-1.5">Assigned Warehouse</p>
                      <div className="flex items-center gap-2">
                        <Select 
                          value={selectedUser.warehouseId?.toString() || "none"}
                          onValueChange={(val) => {
                            const newWarehouseId = val === "none" ? null : parseInt(val);
                            upsertUser.mutate({
                              id: selectedUser.id,
                              name: selectedUser.name,
                              email: selectedUser.email,
                              phone: selectedUser.phone || undefined,
                              role: "manager",
                              warehouseId: newWarehouseId as any,
                              photoId: selectedUser.photoId || undefined,
                            }, {
                              onSuccess: () => {
                                toast.success(newWarehouseId ? "Manager assigned to warehouse successfully!" : "Manager unassigned from warehouse.");
                              }
                            });
                            setSelectedUser({ ...selectedUser, warehouseId: newWarehouseId });
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Assign to a warehouse..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {warehouses?.map((w: any) => (
                              <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {upsertUser.isPending && <Loader2 className="w-4 h-4 animate-spin text-[var(--brand)] shrink-0" />}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-border pt-4 space-y-3">
                    {user?.role === "admin" && (
                      <Button variant="outline" className="w-full justify-start gap-2" onClick={() => {
                        setFormData({
                          id: selectedUser.id,
                          name: selectedUser.name || "",
                          email: selectedUser.email || "",
                          phone: selectedUser.phone || "",
                          password: "",
                          role: selectedUser.role,
                          warehouseId: selectedUser.warehouseId?.toString() || "",
                          photoId: selectedUser.photoId || "",
                        });
                        setShowAddManager(true);
                        setSelectedUser(null);
                      }}>
                        <Edit size={16} />
                        Edit User Profile
                      </Button>
                    )}
                    <Button variant="outline" className="w-full justify-start gap-2" asChild>
                      <a href={`mailto:${selectedUser.email}`}>
                        <Mail size={16} />
                        Send Email
                      </a>
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={() => resetPassword.mutate({ email: selectedUser.email })} disabled={resetPassword.isPending}>
                      {resetPassword.isPending ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                      Reset Password
                    </Button>
                    {user?.id !== selectedUser.id && (
                      <>
                        {/* Only admins can suspend/unsuspend users */}
                        {user?.role === "admin" && (
                          <Button 
                            variant={selectedUser.suspended ? "default" : "secondary"} 
                            className="w-full justify-start gap-2" 
                            onClick={() => toggleSuspension.mutate({ userId: selectedUser.id, suspended: !selectedUser.suspended })} 
                            disabled={toggleSuspension.isPending}
                          >
                            {toggleSuspension.isPending ? <Loader2 size={16} className="animate-spin" /> : (selectedUser.suspended ? <CheckCircle size={16} /> : <ShieldAlert size={16} />)}
                            {selectedUser.suspended ? "Restore Access" : "Suspend Access"}
                          </Button>
                        )}
                        {/* Fire Manager button for managers */}
                        {selectedUser.role === "manager" && user?.role === "admin" && !selectedUser.suspended && (
                          <Button 
                            variant="destructive" 
                            className="w-full justify-start gap-2"
                            onClick={() => {
                              const reason = prompt("Please provide the reason for dismissal:");
                              if (reason && reason.trim()) {
                                fireManager.mutate({ managerId: selectedUser.id, reason: reason.trim() });
                              } else if (reason !== null) {
                                toast.error("Please provide a reason for dismissal.");
                              }
                            }}
                            disabled={fireManager.isPending}
                          >
                            {fireManager.isPending ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                            Fire Manager
                          </Button>
                        )}
                        {/* Only admins can delete users - managers have read-only access */}
                        {user?.role === "admin" && (
                          <Button 
                            variant="destructive" 
                            className="w-full justify-start gap-2" 
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to permanently delete ${selectedUser.name || 'this user'}? This action cannot be undone.`)) {
                                deleteUser.mutate({ id: selectedUser.id });
                              }
                            }} 
                            disabled={deleteUser.isPending}
                          >
                            {deleteUser.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            Delete User
                          </Button>
                        )}
                      </>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setSelectedUser(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </Card>
          </Card>
        )}

        {/* Add Manager Modal */}
        {showAddManager && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold capitalize">{formData.id ? `Edit ${formData.role}` : `Add New ${formData.role}`}</h3>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowAddManager(false);
                      setFormData({
                        id: undefined,
                        name: "",
                        email: "",
                        phone: "",
                        password: "",
                        role: "manager",
                        warehouseId: "",
                        photoId: "",
                      });
                      setPhotoIdFile(null);
                    }}
                  >
                    ✕
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Manager name"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Email *</label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="manager@example.com"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Phone number"
                    />
                  </div>

                  {!formData.id && (
                    <div className="bg-[var(--brand)]/10 p-3 rounded-lg border border-[var(--brand)]/20 text-sm text-[var(--brand)] font-medium">
                      A temporary password will be automatically generated and emailed to the {formData.role}.
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">Assign to Warehouse (Optional)</label>
                    <Select value={formData.warehouseId} onValueChange={(val) => setFormData(prev => ({ ...prev, warehouseId: val }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses?.map((warehouse: any) => (
                          <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Photo ID</label>
                    <div className="flex items-center gap-4 mt-2">
                      {(formData.photoId || photoIdFile) && (
                        <img src={photoIdFile ? URL.createObjectURL(photoIdFile) : formData.photoId} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-border shadow-sm shrink-0" />
                      )}
                      <div className="flex gap-2">
                        <label className={`cursor-pointer flex items-center justify-center gap-1.5 px-3 py-2 border border-[var(--brand)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white rounded-lg transition-colors text-sm font-medium ${isUploadingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                          {isUploadingPhoto ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {isUploadingPhoto ? "Uploading..." : "Take Photo"}
                          <input type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" disabled={isUploadingPhoto} />
                        </label>
                        <label className={`cursor-pointer flex items-center justify-center gap-1.5 px-3 py-2 border border-border bg-secondary hover:bg-muted rounded-lg transition-colors text-sm font-medium ${isUploadingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                          {isUploadingPhoto ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} className="text-muted-foreground" />} {isUploadingPhoto ? "Uploading..." : "Choose File"}
                          <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" disabled={isUploadingPhoto} />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddManager(false);
                        setFormData({
                          id: undefined,
                          name: "",
                          email: "",
                          phone: "",
                          password: "",
                          role: "manager",
                          warehouseId: "",
                          photoId: "",
                        });
                        setPhotoIdFile(null);
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmitManager}
                      disabled={upsertUser.isPending}
                      className="flex-1"
                    >
                      {upsertUser.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {formData.id ? "Save Changes" : `Create ${formData.role}`}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Simple Image Cropper Modal */}
        {fileToCrop && (
          <ImageCropperModal
            file={fileToCrop}
            onCrop={(file) => handlePhotoUpload(file)}
            onCancel={() => setFileToCrop(null)}
            title="Crop User Photo"
          />
        )}
      </div>
    </AdminLayout>
  );
}
