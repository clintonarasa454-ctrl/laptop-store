import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertCircle, Truck, Package, DollarSign, CheckCircle, ExternalLink, Trash2, ShoppingCart, Loader2, Mail, Check, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/pages/useAuth";

const iconMap: Record<string, any> = {
  Package, Truck, AlertCircle, DollarSign, ShoppingCart, Mail
};

export default function AdminNotifications() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: fetchedNotifications, isLoading } = trpc.admin.notifications.useQuery(undefined, { 
    staleTime: 0, // Data is immediately stale for real-time updates
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
  const { data: deletionRequests, isLoading: requestsLoading } = trpc.admin.getDeletionRequests.useQuery(undefined, { 
    staleTime: 0, // Data is immediately stale for real-time updates
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  const reviewRequest = trpc.admin.reviewDeletionRequest.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.admin.getDeletionRequests.invalidate();
      utils.admin.notifications.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [readIds, setReadIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("admin_read_notifications") || "[]"); } catch { return []; }
  });
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("admin_dismissed_notifications") || "[]"); } catch { return []; }
  });

  useEffect(() => { 
    localStorage.setItem("admin_read_notifications", JSON.stringify(readIds)); 
    window.dispatchEvent(new Event("admin_notifications_updated"));
  }, [readIds]);
  
  useEffect(() => { 
    localStorage.setItem("admin_dismissed_notifications", JSON.stringify(dismissedIds)); 
    window.dispatchEvent(new Event("admin_notifications_updated"));
  }, [dismissedIds]);

  const activeNotifications = (fetchedNotifications || [])
    .filter((n: any) => !dismissedIds.includes(n.id))
    .map((n: any) => ({ ...n, isRead: readIds.includes(n.id) }));

  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) setReadIds([...readIds, id]);
  };

  const markAllAsRead = () => {
    const newIds = activeNotifications.map((n: any) => n.id);
    setReadIds(Array.from(new Set([...readIds, ...newIds])));
    toast.success("All notifications marked as read");
  };

  const clearNotification = (id: string) => {
    setDismissedIds([...dismissedIds, id]);
  };

  const unreadCount = activeNotifications.filter((n: any) => !n.isRead).length;

  const pendingRequests = deletionRequests?.filter((r: any) => r.status === "pending") || [];

  return (
    <AdminLayout activeTab="notifications">
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <Bell className="w-8 h-8 text-[var(--brand)]" />
              Action Center & Notifications
            </h2>
            <p className="text-muted-foreground mt-1">
              Stay on top of system errors, driver requests, and customer issues.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead} className="gap-2 shrink-0">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {/* Pending Deletion Requests (Admin Only) */}
          {user?.role === "admin" && pendingRequests.length > 0 && (
            <div className="space-y-4 mb-8">
              <h3 className="text-xl font-bold flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Pending Deletion Requests
              </h3>
              {pendingRequests.map((req: any) => (
                <Card key={req.id} className="p-5 border-l-4 border-l-destructive shadow-md bg-card">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-destructive/10 text-destructive">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          Deletion Request: {req.itemName}
                          <Badge className="bg-destructive text-white text-[10px] px-1.5 py-0 capitalize">{req.itemType}</Badge>
                        </h3>
                        <span className="text-xs font-medium text-muted-foreground">{new Date(req.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm font-semibold mt-2">Requested by: <span className="font-normal">{req.managerName}</span></p>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-4 mt-1"><span className="font-semibold text-foreground">Reason:</span> {req.reason}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button 
                          size="sm" 
                          className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => reviewRequest.mutate({ requestId: req.id, action: "approve" })}
                          disabled={reviewRequest.isPending}
                        >
                          <Check className="w-4 h-4" /> Approve & Delete
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          className="gap-1.5"
                          onClick={() => reviewRequest.mutate({ requestId: req.id, action: "reject" })}
                          disabled={reviewRequest.isPending}
                        >
                          <X className="w-4 h-4" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Manager's Deletion Requests Status */}
          {user?.role === "manager" && deletionRequests && deletionRequests.length > 0 && (
            <div className="space-y-4 mb-8">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-[var(--brand)]" />
                Your Deletion Requests
              </h3>
              {deletionRequests.map((req: any) => (
                <Card key={req.id} className="p-5 shadow-sm bg-card">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                        <h3 className="text-base font-bold flex items-center gap-2">
                          {req.itemName}
                          <Badge className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0 capitalize">{req.itemType}</Badge>
                        </h3>
                        <Badge className={
                          req.status === 'pending' ? 'bg-yellow-500' :
                          req.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                        }>
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">{new Date(req.createdAt).toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Reason:</span> {req.reason}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {isLoading || requestsLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" /></div>
          ) : activeNotifications.length > 0 ? activeNotifications.map((notification: any) => {
            const Icon = iconMap[notification.icon] || AlertCircle;
            return (
              <Card key={notification.id} className={`p-5 transition-all duration-300 ${notification.isRead ? 'opacity-70 bg-muted/20' : 'border-l-4 border-l-[var(--brand)] shadow-md bg-card'}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${notification.bgColor} ${notification.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        {notification.title}
                        {!notification.isRead && <Badge className="bg-[var(--brand)] text-white text-[10px] px-1.5 py-0">New</Badge>}
                      </h3>
                      <span className="text-xs font-medium text-muted-foreground">{notification.time || "Recent"}</span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4">{notification.message}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={notification.actionLink} onClick={() => markAsRead(notification.id)}>
                        <Button size="sm" className="gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80">
                          {notification.actionText} <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                      {!notification.isRead && (
                        <Button size="sm" variant="ghost" onClick={() => markAsRead(notification.id)} className="text-muted-foreground hover:text-foreground">
                          Mark as Read
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => clearNotification(notification.id)} className="text-muted-foreground hover:text-destructive ml-auto">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          }) : (
            <div className="text-center py-20 bg-card border border-border rounded-xl border-dashed">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="font-medium text-lg">You're all caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No new notifications or actions required.</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}