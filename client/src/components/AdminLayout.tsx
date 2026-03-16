import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  Users,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  TrendingUp,
  Tag,
  Layers,
  UserCircle,
  Lock,
  Mail,
  User,
  Loader2,
  Eye,
  EyeOff,
  ShieldAlert
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
}

export default function AdminLayout({ children, activeTab = "dashboard" }: AdminLayoutProps) {
  const { user, logout, loading } = useAuth();
  const isDev = import.meta.env.MODE !== "production";
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
  });

  useEffect(() => {
    if (user) {
      setProfileForm(prev => ({ ...prev, name: user.name || "", email: user.email || "" }));
    }
  }, [user]);

  const { data: settings } = trpc.settings.public.useQuery({ keys: ["appearance", "general"] });
  const storeName = settings?.general?.storeName || (typeof localStorage !== 'undefined' ? localStorage.getItem("nexus_store_name") : null) || "Admin";
  const logoUrl = settings?.appearance?.logoUrl ?? (typeof localStorage !== 'undefined' ? localStorage.getItem("nexus_logo_url") : null);

  const updateProfileMutation = trpc.auth.updateAdminProfile.useMutation({
    onSuccess: () => {
      toast.success("Admin profile updated successfully!");
      setShowEditProfile(false);
      setProfileForm(prev => ({ ...prev, currentPassword: "", newPassword: "" }));
    },
    onError: (err: any) => toast.error(err.message || "Failed to update profile"),
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm.newPassword && !profileForm.currentPassword) {
      return toast.error("Current password is required to set a new password.");
    }
    if (!profileForm.currentPassword) {
      return toast.error("Please enter your current password to authorize changes.");
    }
    updateProfileMutation.mutate(profileForm);
  };

  const [adminLoginForm, setAdminLoginForm] = useState({ email: "", password: "" });
  
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Admin login successful");
      window.location.reload();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(adminLoginForm);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-[var(--brand)]/10 p-4 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[var(--brand)]/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-[var(--brand)]/10 blur-3xl" />
        </div>
        
        <Card className="w-full max-w-md p-8 shadow-2xl bg-card/80 backdrop-blur-xl border-border/50 text-center relative z-10">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="h-12 object-contain mx-auto mb-6" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-[var(--brand)]" />
            </div>
          )}
          <h1 className="text-2xl font-bold font-display mb-6">{logoUrl ? "Admin Login" : "Admin"}</h1>

          <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input type="email" required placeholder="Enter email" className="pl-10" value={adminLoginForm.email} onChange={(e) => setAdminLoginForm({ ...adminLoginForm, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input type={showPassword ? "text" : "password"} required placeholder="Enter password" className="pl-10 pr-10" value={adminLoginForm.password} onChange={(e) => setAdminLoginForm({ ...adminLoginForm, password: e.target.value })} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full bg-[var(--brand)] text-white hover:opacity-90 mt-6 h-11" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Login
            </Button>
          </form>
          
          <div className="mt-6">
            <button type="button" onClick={() => setLocation("/")} className="text-sm text-muted-foreground hover:underline">
              ← Back to Store
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // Guard: Strictly ONLY admins can access the admin panel.
  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-[var(--brand)]/10 p-4 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[var(--brand)]/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-[var(--brand)]/10 blur-3xl" />
        </div>
        
        <Card className="w-full max-w-md p-8 shadow-2xl bg-card/80 backdrop-blur-xl border-border/50 text-center relative z-10">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="h-12 object-contain mx-auto mb-6" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
          )}
          <h1 className="text-2xl font-bold font-display mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-8">You do not have permission to access the admin panel.</p>
          <Button onClick={() => setLocation("/")} className="w-full bg-[var(--brand)] text-white hover:opacity-90 h-11">
            Back to Store
          </Button>
        </Card>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const displayName = user?.name || user?.email || (isDev ? "Dev Admin" : "User");

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
    { id: "analytics", label: "Analytics", icon: TrendingUp, href: "/admin/analytics" },
    { id: "products", label: "Products", icon: Package, href: "/admin/products" },
    { id: "brands", label: "Brands", icon: Tag, href: "/admin/brands" },
    { id: "categories", label: "Categories", icon: Layers, href: "/admin/categories" },
    { id: "orders", label: "Orders", icon: ShoppingCart, href: "/admin/orders" },
    { id: "payments", label: "Payments", icon: CreditCard, href: "/admin/payments" },
    { id: "customers", label: "Customers", icon: Users, href: "/admin/customers" },
    { id: "content", label: "Content", icon: FileText, href: "/admin/content" },
    { id: "settings", label: "Settings", icon: Settings, href: "/admin/settings" },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-card border-r border-border transition-all duration-300 flex flex-col overflow-hidden`}
      >
        {/* Logo Area */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2 truncate pr-2">
              {logoUrl && (
                <img src={logoUrl} alt={storeName} className="h-8 max-w-[140px] object-contain" />
              )}
              <h2 className="text-lg font-bold text-primary truncate">Admin Panel</h2>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-secondary rounded-lg transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setLocation(item.href)}
                className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-[var(--brand)]/10 text-[var(--brand)] font-bold shadow-sm"
                    : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                }`}
                title={sidebarOpen ? "" : item.label}
              >
                {isActive && <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-[var(--brand)] rounded-r-full" />}
                <Icon size={20} className={`flex-shrink-0 ${isActive ? "scale-110" : ""}`} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="border-t border-border"></div>

        {/* User Info & Actions */}
        <div className="p-4 space-y-2">
          {sidebarOpen && (
            <div className="px-3 py-2.5 bg-secondary/50 rounded-lg mb-3 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Admin Profile</p>
              <p className="text-sm font-medium truncate text-foreground">{displayName}</p>
            </div>
          )}
          
          <Button
            onClick={() => setShowEditProfile(true)}
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <UserCircle size={16} />
            {sidebarOpen && "Edit Profile"}
          </Button>

          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          >
            <LogOut size={16} />
            {sidebarOpen && "Sign Out"}
          </Button>
          
          <Button
            onClick={() => setLocation("/")}
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown size={16} className="rotate-90" />
            {sidebarOpen && "Back to Store"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-card border-b border-border px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            {navItems.find((item) => item.id === activeTab)?.label || "Admin Panel"}
          </h1>
          <div className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="p-8 flex-1">{children}</div>
          <footer className="border-t border-border bg-card mt-auto shrink-0">
            <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4 text-xs text-muted-foreground">
              <p>© {new Date().getFullYear()} {storeName}. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <Link href="/legal/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                <Link href="/legal/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link>
                <Link href="/legal/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-border overflow-hidden">
            <form onSubmit={handleProfileSubmit} className="flex flex-col">
              <div className="p-6 bg-muted/40 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold font-display">Admin Profile</h3>
                  <p className="text-xs text-muted-foreground mt-1">Manage your personal information and security.</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setShowEditProfile(false)}>
                  <X size={16} />
                </Button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <UserCircle size={16} className="text-primary"/> Personal Information
                  </h4>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                      <Input value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} required placeholder="e.g. Jane Doe" className="bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Email Address</label>
                      <Input type="email" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} required placeholder="admin@example.com" className="bg-background" />
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
                    <Lock size={16} className="text-primary"/> Security Settings
                  </h4>
                  <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Current Password</label>
                      <Input type="password" placeholder="Required to save any changes" value={profileForm.currentPassword} onChange={e => setProfileForm({...profileForm, currentPassword: e.target.value})} className="bg-background" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">New Password</label>
                      <Input type="password" placeholder="Leave blank to keep current password" value={profileForm.newPassword} onChange={e => setProfileForm({...profileForm, newPassword: e.target.value})} className="bg-background" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-muted/40 border-t border-border flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowEditProfile(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary text-primary-foreground hover:opacity-90 min-w-[120px]" disabled={updateProfileMutation?.isPending}>
                  {updateProfileMutation?.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Save Changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
