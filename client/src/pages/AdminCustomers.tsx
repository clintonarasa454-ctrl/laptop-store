import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Search, Eye, Mail, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminCustomers() {
  const { data: customers, isLoading } = trpc.admin.customers.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const resetPassword = trpc.auth.resetPasswordRequest.useMutation({
    onSuccess: () => toast.success("Password reset link sent to customer!"),
    onError: (err) => toast.error(err.message),
  });

  const filteredCustomers = customers?.filter((c: any) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <AdminLayout activeTab="customers">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold">Customers Management</h2>
          <p className="text-muted-foreground mt-1">
            View and manage customer accounts
          </p>
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
                  <th className="text-left py-3 px-4 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 font-semibold">Email</th>
                  <th className="text-left py-3 px-4 font-semibold">Role</th>
                  <th className="text-left py-3 px-4 font-semibold">Joined</th>
                  <th className="text-left py-3 px-4 font-semibold">Last Seen</th>
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
                ) : filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer: any) => (
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
