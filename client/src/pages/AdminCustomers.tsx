import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Search, Eye, Mail, Lock, Loader2, ArrowUpDown, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function AdminCustomers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, itemsPerPage, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const { data: customers, isLoading } = trpc.admin.customers.useQuery(
    { search: debouncedSearch || undefined }, 
    { refetchInterval: 15000 }
  );

  const resetPassword = trpc.auth.resetPasswordRequest.useMutation({
    onSuccess: () => toast.success("Password reset link sent to customer!"),
    onError: (err) => toast.error(err.message),
  });

  const triggerAIMarketing = trpc.admin.triggerAIMarketing.useMutation({
    onSuccess: (data) => toast.success(`Successfully sent AI personalized marketing emails to ${data.sentCount} customers!`),
    onError: (err) => toast.error(err.message)
  });

  const filteredCustomers = customers || [];
  
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    if (!sortConfig) return 0;
    let aVal = a[sortConfig.key] || "";
    let bVal = b[sortConfig.key] || "";
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const paginatedCustomers = sortedCustomers.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <AdminLayout activeTab="customers">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold">Customers Management</h2>
            <p className="text-muted-foreground mt-1">
              View and manage customer accounts
            </p>
          </div>
          <Button onClick={() => triggerAIMarketing.mutate()} disabled={triggerAIMarketing.isPending} className="bg-pink-600 hover:bg-pink-700 text-white gap-2 shadow-sm">
            {triggerAIMarketing.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Run AI Email Campaign
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground font-medium">Total Customers</p>
            <p className="text-3xl font-bold mt-2">{customers?.length || 0}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground font-medium">Active Customers</p>
            <p className="text-3xl font-bold mt-2">
              {customers?.filter((c: any) => c.role !== "admin").length || 0}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground font-medium">Admins</p>
            <p className="text-3xl font-bold mt-2">
              {customers?.filter((c: any) => c.role === "admin").length || 0}
            </p>
          </Card>
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

        {/* Customers Table */}
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
                      Loading customers...
                    </td>
                  </tr>
                ) : paginatedCustomers.length > 0 ? (
                  paginatedCustomers.map((customer: any) => (
                    <tr key={customer.id} className="border-b border-border hover:bg-secondary transition-colors">
                      <td className="py-3 px-4 font-medium">{customer.name || "-"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{customer.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            customer.role === "admin"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          }`}
                        >
                          {customer.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {new Date(customer.lastSignedIn).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCustomer(customer)}
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
                      No customers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && filteredCustomers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border mt-4">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, sortedCustomers.length)} of {sortedCustomers.length} entries
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

        {/* Customer Details Modal */}
        {selectedCustomer && (
          <Card className="p-6 fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">Customer Profile</h3>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    ✕
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-semibold text-lg">{selectedCustomer.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-mono text-sm">{selectedCustomer.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-semibold">{selectedCustomer.phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <p className="font-semibold">{selectedCustomer.role}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Member Since</p>
                    <p className="font-semibold">
                      {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Seen</p>
                    <p className="font-semibold">
                      {new Date(selectedCustomer.lastSignedIn).toLocaleString()}
                    </p>
                  </div>

                  <div className="border-t border-border pt-4 space-y-3">
                    <Button variant="outline" className="w-full justify-start gap-2" asChild>
                      <a href={`mailto:${selectedCustomer.email}`}>
                        <Mail size={16} />
                        Send Email
                      </a>
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={() => resetPassword.mutate({ email: selectedCustomer.email })} disabled={resetPassword.isPending}>
                      {resetPassword.isPending ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                      Reset Password
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setSelectedCustomer(null)}
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
