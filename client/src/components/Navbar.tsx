import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { getGuestCart, clearGuestCart, formatPrice } from "@/lib/cart";
import {
  ChevronDown,
  ChevronRight,
  Cpu,
  LogOut,
  Menu,
  Monitor,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Heart,
  User,
  X,
  LayoutDashboard,
  Headphones,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./ui/dropdown-menu";

const categoryIcons: Record<string, React.ReactNode> = {
  laptops: <Monitor className="w-4 h-4" />,
  desktops: <Cpu className="w-4 h-4" />,
  accessories: <Headphones className="w-4 h-4" />,
};

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: categories } = trpc.categories.list.useQuery();
  const { data: cartItems } = trpc.cart.get.useQuery(undefined, { enabled: isAuthenticated });
  const activeCategories = categories ? categories.filter(c => (c as any).active !== false) : [];
  const orderedCategories = [...activeCategories].sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));
  const rootCategories = orderedCategories.filter(c => !(c as any).parentId);

  const { data: settings } = trpc.settings.public.useQuery({ keys: ["general", "appearance"] });
  const storeName = settings?.general?.storeName || (typeof localStorage !== 'undefined' ? localStorage.getItem("nexus_store_name") : null) || "Store";
  const logoUrl = settings?.appearance?.logoUrl ?? (typeof localStorage !== 'undefined' ? localStorage.getItem("nexus_logo_url") : null);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [mobileOpen]);

  // Auto-sync guest cart globally when authenticating (e.g. returning from Google OAuth)
  const syncCart = trpc.cart.syncFromGuest.useMutation({
    onSuccess: () => {
      clearGuestCart();
      utils.cart.get.invalidate();
    }
  });
  useEffect(() => {
    if (isAuthenticated) {
      const guestItems = getGuestCart();
      if (guestItems.length > 0) syncCart.mutate(guestItems);
    }
  }, [isAuthenticated]);

  // Guest cart count
  const [guestCartCount, setGuestCartCount] = useState(0);
  useEffect(() => {
    const update = () => {
      const items = getGuestCart();
      setGuestCartCount(items.reduce((s, i) => s + i.quantity, 0));
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("guestCartUpdated", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("guestCartUpdated", update);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults, isLoading: searching } = trpc.products.list.useQuery(
    { search: debouncedSearch, limit: 5 },
    { enabled: debouncedSearch.trim().length > 1 }
  );

  const cartCount = isAuthenticated
    ? (cartItems?.reduce((s, i) => s + i.quantity, 0) ?? 0)
    : guestCartCount;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  const renderAutocomplete = () => {
    if (searchQuery.trim().length <= 1) return null;
    return (
      <div className="absolute top-full left-0 right-0 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
        {searching ? (
          <div className="p-4 flex justify-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /></div>
        ) : searchResults && searchResults.length > 0 ? (
          <div className="flex flex-col">
            {searchResults.map(product => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                onClick={() => { setSearchOpen(false); setMobileOpen(false); setSearchQuery(""); }}
                className="flex items-center gap-3 p-2 hover:bg-muted transition-colors border-b border-border last:border-0"
              >
                <div className="w-10 h-10 rounded overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                  {product.images && Array.isArray(product.images) && product.images[0] ? (
                    <img src={product.images[0] as string} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-[var(--brand)] font-semibold">{formatPrice(product.price)}</p>
                </div>
              </Link>
            ))}
            <button type="submit" className="p-2 text-xs text-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium border-t border-border">
              View all results for "{searchQuery}"
            </button>
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">No products found</div>
        )}
      </div>
    );
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-background/80 backdrop-blur-xl shadow-sm border-b border-border" : "bg-background border-b border-transparent"
      }`}
    >
      {/* Top bar */}
      <div className="container">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            {logoUrl && (
              <img src={logoUrl} alt={storeName} className="h-8 object-contain" />
            )}
            <span className="font-display font-bold text-lg tracking-tight">
              {storeName}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/" className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${location === "/" ? "text-[var(--brand)]" : "text-muted-foreground hover:text-foreground"}`}>
              Home
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Products <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem key="all-products" asChild>
                  <Link href="/products" className="flex items-center gap-2 cursor-pointer">
                    <Package className="w-4 h-4" /> All Products
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
            {rootCategories.map((cat) => {
              const children = orderedCategories.filter(c => (c as any).parentId === cat.id);
              if (children.length > 0) {
                return (
                  <DropdownMenuSub key={cat.id}>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                      {categoryIcons[cat.slug] ?? <Package className="w-4 h-4" />} {cat.name}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56 p-1.5 shadow-xl border-border/60">
                      <DropdownMenuItem asChild className="py-2.5 px-3">
                        <Link href={`/products?category=${cat.slug}`} className="cursor-pointer font-semibold text-[var(--brand)]">All {cat.name}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {children.map(child => (
                        <DropdownMenuItem key={child.id} asChild className="group/item py-2.5 px-3 focus:bg-muted/50 transition-colors">
                          <Link href={`/products?category=${child.slug}`} className="cursor-pointer flex items-center justify-between w-full text-muted-foreground focus:text-foreground">
                            <span>{child.name}</span>
                            <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all duration-300 text-[var(--brand)]" />
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              }
              return (
                <DropdownMenuItem key={cat.id} asChild>
                  <Link href={`/products?category=${cat.slug}`} className="flex items-center gap-2 cursor-pointer">
                    {categoryIcons[cat.slug] ?? <Package className="w-4 h-4" />}
                    {cat.name}
                  </Link>
                </DropdownMenuItem>
              );
            })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href="/products?featured=true" className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Deals
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center gap-2 relative">
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-48 sm:w-64 h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setSearchOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
                {renderAutocomplete()}
              </form>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="hidden sm:flex">
                <Search className="w-4.5 h-4.5" />
              </Button>
            )}

        {/* Wishlist */}
        {isAuthenticated && (
          <Link href="/dashboard/wishlist">
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Heart className="w-4.5 h-4.5" />
            </Button>
          </Link>
        )}

            {/* Cart */}
            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="w-4.5 h-4.5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-[var(--brand)] text-white text-[10px] font-bold flex items-center justify-center">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Auth */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div className="w-7 h-7 rounded-full bg-[var(--brand)]/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-[var(--brand)]">
                        {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-sm font-medium truncate">{user?.name ?? "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <DropdownMenuItem key="nav-dashboard" asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem key="nav-orders" asChild>
                    <Link href="/dashboard/orders" className="flex items-center gap-2 cursor-pointer">
                      <Package className="w-4 h-4" /> My Orders
                    </Link>
                  </DropdownMenuItem>
                  {user?.role === "admin" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem key="nav-admin" asChild>
                        <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
                          <Settings className="w-4 h-4" /> Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (window.location.href = getLoginUrl(location))}
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  className="bg-[var(--brand)] text-white hover:opacity-90"
                  onClick={() => (window.location.href = getLoginUrl(location, "register"))}
                >
                  Sign Up
                </Button>
              </div>
            )}

            {/* Mobile menu toggle */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="w-4.5 h-4.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm transition-opacity" 
          onClick={() => setMobileOpen(false)} 
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div 
        className={`fixed top-0 left-0 h-full w-[85%] max-w-sm bg-background border-r border-border z-[70] transform transition-transform duration-300 ease-in-out md:hidden flex flex-col shadow-2xl ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-4 border-b border-border flex items-center justify-between shrink-0">
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
            {logoUrl && (
              <img src={logoUrl} alt={storeName} className="h-8 object-contain" />
            )}
            <span className="font-display font-bold text-lg tracking-tight">
              {storeName}
            </span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
        
        {/* Sidebar Content */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col">
          <form onSubmit={handleSearch} className="flex gap-2 mb-6 relative">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="flex-1 h-11 px-4 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand)] shadow-sm"
            />
            <Button type="submit" size="icon" className="bg-[var(--brand)] text-white h-11 w-11 rounded-xl shadow-sm hover:opacity-90 shrink-0">
              <Search className="w-4.5 h-4.5" />
            </Button>
            {renderAutocomplete()}
          </form>

          <div className="space-y-1.5 mb-6">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Navigation</p>
            <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium hover:bg-[var(--brand)]/10 hover:text-[var(--brand)] transition-colors">
              Home
            </Link>
            <Link href="/products" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium hover:bg-[var(--brand)]/10 hover:text-[var(--brand)] transition-colors">
              All Products
            </Link>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Categories</p>
            {rootCategories.map((cat) => {
              const children = orderedCategories.filter(c => (c as any).parentId === cat.id);
              return (
                <div key={cat.id} className="space-y-0.5">
                  <Link href={`/products?category=${cat.slug}`} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-[var(--brand)]/10 hover:text-[var(--brand)] transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      {categoryIcons[cat.slug] ?? <Package className="w-4 h-4" />} 
                    </div>
                    {cat.name}
                  </Link>
                  <div className="flex flex-col gap-0.5 ml-7 pl-3 border-l-2 border-border/40 mt-0.5">
                    {children.map(child => (
                      <Link key={child.id} href={`/products?category=${child.slug}`} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        {child.name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {!isAuthenticated && (
            <div className="flex flex-col gap-3 mt-auto pt-6 pb-2 border-t border-border">
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl"
                onClick={() => (window.location.href = getLoginUrl(location))}
              >
                Sign In
              </Button>
              <Button
                className="w-full bg-[var(--brand)] text-white hover:opacity-90 h-11 rounded-xl shadow-md"
                onClick={() => (window.location.href = getLoginUrl(location, "register"))}
              >
                Sign Up
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
