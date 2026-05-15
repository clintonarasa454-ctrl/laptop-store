import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ShieldAlert, Activity, User, FileText, Search, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, actionFilter, itemsPerPage]);

  const { data, isLoading, isError, error, refetch, isRefetching } = trpc.admin.auditLogs.useQuery({ 
    limit: itemsPerPage, 
    offset: (page - 1) * itemsPerPage,
    search: debouncedSearch,
    action: actionFilter === "all" ? undefined : actionFilter
  }, {
    refetchOnWindowFocus: false
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / itemsPerPage);

  const availableActions = ["CREATE_PRODUCT", "UPDATE_PRODUCT", "DELETE_PRODUCT", "UPDATE_ORDER_STATUS", "TRANSFER_PRODUCT", "ASSIGN_ALL_PRODUCTS"];

  return (
    <AdminLayout activeTab="audit-logs">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-[var(--brand)]" />
              System Audit Logs
            </h2>
            <p className="text-muted-foreground mt-1">
              Enterprise tracking of all administrative actions and data modifications.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching || isLoading} className="gap-2 shrink-0">
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by details or resource ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {availableActions.map((action) => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {isError ? (
          <Card className="p-6 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 flex items-center justify-center flex-col text-center">
            <AlertCircle className="w-8 h-8 text-red-600 mb-2" />
            <h3 className="font-semibold text-red-900 dark:text-red-100">Failed to load audit logs</h3>
            <p className="text-sm text-red-800 dark:text-red-200 mt-1">{error?.message}</p>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Timestamp</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">User ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Action</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Resource</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <Loader2 className="mx-auto w-8 h-8 animate-spin text-[var(--brand)]" />
                      </td>
                    </tr>
                  ) : logs.length > 0 ? (
                    logs.map((log: any) => (
                      <tr key={log.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                        <td className="whitespace-nowrap py-3 px-4 text-muted-foreground">
                          {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                        </td>
                        <td className="whitespace-nowrap py-3 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground opacity-50" />
                            {log.userId}
                          </div>
                        </td>
                        <td className="whitespace-nowrap py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-800 dark:text-blue-300">
                            <Activity className="h-3 w-3" />
                            {log.action}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-3 px-4 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 opacity-50" />
                            {log.resourceId}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {log.details || <span className="italic opacity-50">No additional details</span>}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        <ShieldAlert className="mx-auto mb-3 h-8 w-8 opacity-20" />
                        No audit logs matched your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {!isLoading && logs.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border mt-4">
                <p className="text-sm text-muted-foreground text-center sm:text-left">
                  Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, total)} of {total} logs
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
                        <SelectItem value="100">100</SelectItem>
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
        )}
      </div>
    </AdminLayout>
  );
}
