import { trpc } from "@/lib/trpc";
import { SettingsResponse } from "@shared/settingsTypes";
import {
  CheckCircle,
  ArrowRight,
  Award,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Palette,
  Briefcase,
  Gamepad2,
  BookOpen,
  Film,
  Building,
  Headphones,
  MapPin,
  Monitor,
  Package,
  RefreshCw,
  Shield,
  ShoppingBag,
  Truck,
  Zap,
  Megaphone,
  X,
  Store,
  Navigation,
} from "lucide-react";
import { dynamicIconMap } from "@/lib/iconMap";
import { useState, useEffect, useRef } from "react";
import { getRecentlyViewed } from "@/lib/ux";
import { Link } from "wouter";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";
import StoreLoader from "@/components/StoreLoader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/cart";
import { useCurrency } from "@/_core/hooks/useCurrency";
import { useGeolocation } from "@/hooks/useGeolocation";

const categoryGradients = [
  { gradient: "from-blue-500/10 to-indigo-500/10", iconColor: "text-blue-500" },
  { gradient: "from-purple-500/10 to-pink-500/10", iconColor: "text-purple-500" },
  { gradient: "from-emerald-500/10 to-teal-500/10", iconColor: "text-emerald-500" },
];

const fallbackLifestyles = [
  { title: "Creative & Technical", description: "For designers, developers, and artists.", icon: "Palette", color: "text-purple-500 bg-purple-500/10", link: "/products?tag=creative" },
  { title: "Professional", description: "For business, productivity, and meetings.", icon: "Briefcase", color: "text-blue-500 bg-blue-500/10", link: "/products?tag=professional" },
  { title: "Gaming", description: "For high-performance, immersive gaming.", icon: "Gamepad2", color: "text-red-500 bg-red-500/10", link: "/products?tag=gaming" },
  { title: "School & Hobbies", description: "For students, learning, and personal projects.", icon: "BookOpen", color: "text-green-500 bg-green-500/10", link: "/products?tag=student" },
  { title: "Entertainment", description: "For movies, music, and streaming.", icon: "Film", color: "text-yellow-500 bg-yellow-500/10", link: "/products?tag=entertainment" },
  { title: "Business", description: "For enterprise-level security and management.", icon: "Building", color: "text-gray-500 bg-gray-500/10", link: "/products?tag=business" },
];

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
];

export default function Home() {
  const geoLocation = useGeolocation(); // Get user's geolocation for warehouse filtering
  
  const { data: featuredProducts, isLoading: loadingFeatured } = trpc.products.list.useQuery(
    { featured: true, limit: 8, lat: geoLocation?.lat, lng: geoLocation?.lng },
    { staleTime: 1000 * 60 * 5 } // Cache for 5 minutes
  );
  const { data: latestProducts, isLoading: loadingLatest } = trpc.products.list.useQuery(
    { limit: 8, lat: geoLocation?.lat, lng: geoLocation?.lng },
    { staleTime: 1000 * 60 * 5 }
  );
  const { data: banners, isLoading: loadingBanners } = trpc.content.banners.useQuery(undefined, { 
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,  // Keep in memory for 10 mins so returning users see instant display
    refetchOnMount: false,    // Don't refetch if already cached
    refetchOnWindowFocus: false  // Don't interrupt user if they switch tabs
  });
  const { data: promotions } = trpc.content.promotions.useQuery(undefined, { staleTime: 1000 * 60 * 5 });
  const { data: dbCategories, isLoading: loadingCategories } = trpc.categories.list.useQuery(undefined, { 
    staleTime: 1000 * 60 * 60 // Cache categories for 1 full hour
  });
  const { data: storeStats } = trpc.store.stats.useQuery(undefined, { staleTime: 1000 * 60 * 5 });
  const { data: settingsData } = trpc.settings.public.useQuery(
    { keys: ["shipping", "general", "brands"] },
    { 
      staleTime: 1000 * 60 * 5, // Refetch every 5 minutes to catch admin updates
      gcTime: 1000 * 60 * 10 // Keep in cache for 10 minutes
    }
  );
  const settings = settingsData as SettingsResponse;
  const { data: announcements } = trpc.content.announcements.useQuery(undefined, { 
    staleTime: 1000 * 60 * 5 
  });

  const activeAnnouncements = (Array.isArray(announcements) ? announcements : []).filter((a: any) => a.active) || [];
  const latestAnnouncement = activeAnnouncements[0];
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<number[]>(() => {
    if (typeof localStorage !== "undefined") {
      try { return JSON.parse(localStorage.getItem("dismissed_announcements") || "[]"); } catch { return []; }
    }
    return [];
  });
  const dismissAnnouncement = (id: number) => {
    const newDismissed = [...dismissedAnnouncements, id];
    setDismissedAnnouncements(newDismissed);
    localStorage.setItem("dismissed_announcements", JSON.stringify(newDismissed));
  };

  const orderedBanners = Array.isArray(banners) ? [...banners].sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0)) : [];
  const mainBanner = orderedBanners?.[0];
  const activeBanners = orderedBanners?.filter(b => b.active) || [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const mapSectionRef = useRef<HTMLElement>(null);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const [isStoreOpen, setIsStoreOpen] = useState(true);

  useEffect(() => {
    setRecentProducts(getRecentlyViewed());
  }, []);

  // Listen for settings updates from admin panel
  useEffect(() => {
    const handleSettingsUpdate = () => {
      // Settings will automatically refetch due to staleTime expiry
      // But we can force refetch by using refetch if needed
      console.log("Settings updated event received");
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          console.log("[MAP DEBUG] Map section is visible - setting isMapVisible to true");
          setIsMapVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" } // Pre-load the map slightly before it scrolls into view
    );
    if (mapSectionRef.current) {
      observer.observe(mapSectionRef.current);
    } else {
      console.warn("[MAP DEBUG] mapSectionRef is not set");
    }
    return () => observer.disconnect();
  }, []);
  
  useEffect(() => {
    if (activeBanners.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % activeBanners.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [activeBanners.length, isHovered]);

  // Check store opening hours
  useEffect(() => {
    const checkOpenStatus = () => {
      const openingHours = settings?.general?.openingHours || [
        { label: "Mon - Fri", value: "9:00 AM - 8:00 PM" },
        { label: "Saturday", value: "10:00 AM - 6:00 PM" },
        { label: "Sunday", value: "Closed" }
      ];
      const now = new Date();
      const day = now.getDay();
      const currentTime = now.getHours() + now.getMinutes() / 60;
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const currentDayName = dayNames[day];
      
      let todaysRule = openingHours.find((h: any) => {
        if (!h.label) return false;
        const label = h.label.toLowerCase();
        if (label.includes(currentDayName.toLowerCase())) return true;
        if (label.includes("mon") && label.includes("fri") && day >= 1 && day <= 5) return true;
        if (label.includes("weekdays") && day >= 1 && day <= 5) return true;
        if (label.includes("weekend") && (day === 0 || day === 6)) return true;
        if (label === "everyday" || label === "daily") return true;
        return false;
      });

      if (!todaysRule) { setIsStoreOpen(false); return; }
      const value = (todaysRule as any).value?.toLowerCase() || "";
      if (value.includes("closed")) { setIsStoreOpen(false); return; }
      if (value.includes("24 hours") || value.includes("open 24")) { setIsStoreOpen(true); return; }
      
      try {
        const times = value.split("-").map((t: string) => t.trim());
        if (times.length === 2) {
          const parseTime = (timeStr: string) => {
            const match = timeStr.match(/(\d+)(?::(\d+))?\s*(am|pm)?/);
            if (!match) return null;
            let h = parseInt(match[1], 10);
            const m = parseInt(match[2] || "0", 10);
            if (match[3] === "pm" && h < 12) h += 12;
            if (match[3] === "am" && h === 12) h = 0;
            return h + m / 60;
          };
          const openTime = parseTime(times[0]);
          const closeTime = parseTime(times[1]);
          if (openTime !== null && closeTime !== null) { setIsStoreOpen(currentTime >= openTime && currentTime < closeTime); return; }
        }
      } catch (e) {}
      setIsStoreOpen(true);
    };
    checkOpenStatus();
    const interval = setInterval(checkOpenStatus, 60000);
    return () => clearInterval(interval);
  }, [settings?.general?.openingHours]);

  // Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    if (distance > minSwipeDistance) setActiveIndex((prev) => (prev + 1) % activeBanners.length); // Swipe left -> next
    else if (distance < -minSwipeDistance) setActiveIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length); // Swipe right -> prev
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Use cached localStorage values as instant defaults so the hero renders without waiting for the API
  const cachedStoreName = typeof localStorage !== 'undefined' ? localStorage.getItem("store_name_cache") : null;
  const heroTitle = settings?.general?.heroTitle || "Premium Tech, Exceptional Performance";
  const heroDescription = settings?.general?.heroDescription || "Discover the latest laptops, desktops, and accessories from the world's leading brands. Built for professionals, creators, and gamers.";
  const ctaTitle = settings?.general?.ctaTitle || "Ready to Upgrade Your Setup?";
  const ctaDescription = settings?.general?.ctaDescription || "Join thousands of satisfied customers. Shop the latest tech with confidence — free shipping on orders over $500.";

  const badge1 = settings?.general?.floatingBadge1 || { icon: "Shield", title: "Verified Quality", desc: "All products certified" };
  const badge2 = settings?.general?.floatingBadge2 || { icon: "Truck", title: "Fast Delivery", desc: "2–5 business days" };
  const Badge1Icon = dynamicIconMap[badge1.icon] || Shield;
  const Badge2Icon = dynamicIconMap[badge2.icon] || Truck;
  
  const storeName = settings?.general?.storeName || cachedStoreName || 'Store';

  // --- SEO Metadata ---
  useEffect(() => {
    document.title = storeName;
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    const storeDesc = settings?.general?.storeDescription || (typeof localStorage !== 'undefined' ? localStorage.getItem("store_description_cache") : null) || heroDescription;
    metaDesc.setAttribute("content", storeDesc);

    return () => { document.title = storeName; };
  }, [settings, heroTitle, heroDescription]);

  const displayBrands = settings?.brands && settings.brands.length > 0 ? settings.brands : ["Samsung", "Dell", "HP", "Lenovo", "Asus", "Apple", "Acer"];

  const lifestyles = settings?.general?.lifestyles || fallbackLifestyles;

  // ── No full-page block: render the shell immediately using cached defaults.
  // Individual sections show skeleton placeholders while their data loads.

  // --- Schema.org JSON-LD ---
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": settings?.general?.storeName || "Store",
    "url": typeof window !== "undefined" ? window.location.origin : "",
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${typeof window !== "undefined" ? window.location.origin : ""}/products?search={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      {/* Custom Keyframes for the Floating Parallax Effect */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(12px); }
        }
        @keyframes scroll-x {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: scroll-x 40s linear infinite;
        }
      `}} />

      {/* ── Promotions Bar ───────────────────────────────────────────────── */}
      {(Array.isArray(promotions) ? promotions : []).length > 0 && (
        <div 
          className="text-white py-2.5 px-4 text-center text-sm font-medium relative z-10"
          style={{ backgroundColor: "var(--promo-banner, var(--brand))" }}
        >
          <div className="container flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {(Array.isArray(promotions) ? promotions : []).map((p: any) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                  {p.title}
                </span>
                <span>{p.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section 
        className="relative overflow-hidden bg-gradient-to-br from-background via-background to-[var(--brand)]/5 border-b border-border"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Tech Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:linear-gradient(to_bottom,white_30%,transparent_100%)]" />
          {/* Glowing Ambient Orbs */}
          <div className="absolute -top-40 -right-40 w-[30rem] h-[30rem] rounded-full bg-[var(--brand)]/10 blur-[100px]" />
          <div className="absolute top-1/2 -left-40 w-[24rem] h-[24rem] rounded-full bg-purple-500/10 blur-[100px]" />
        </div>

      <div className="container relative pt-4 pb-8 sm:pt-6 sm:pb-12 lg:pt-10 lg:pb-20">
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-start lg:mt-6">
            <div className="space-y-3 sm:space-y-5">
              <Badge className="bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/20 hover:bg-[var(--brand)]/15">
                <Zap className="w-3 h-3 mr-1" /> {settings?.general?.heroBadge || "New Arrivals 2025"}
              </Badge>
              <h1 
                className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight whitespace-pre-line animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-700"
              >
                {heroTitle}
              </h1>
              <p 
                className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-backwards"
              >
                {heroDescription}
              </p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <Link href="/products">
                  <Button size="lg" className="bg-[var(--brand)] text-white hover:opacity-90 gap-2">
                    <ShoppingBag className="w-4 h-4" /> Shop Now
                  </Button>
                </Link>
                <Link href="/products?featured=true">
                  <Button size="lg" variant="outline" className="gap-2">
                    View Deals <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 pt-1 sm:pt-2">
                <div>
                  <p className="font-display font-bold text-xl sm:text-2xl">{settings?.general?.statsProductCount || (storeStats as any)?.productCount || 0}+</p>
                  <p className="text-xs text-muted-foreground">Products</p>
                </div>
                <div className="w-px h-6 sm:h-8 bg-border" />
                <div>
                  <p className="font-display font-bold text-xl sm:text-2xl">{settings?.general?.statsCustomerCount || (storeStats as any)?.customerCount || 0}+</p>
                  <p className="text-xs text-muted-foreground">Happy Customers</p>
                </div>
                <div className="w-px h-6 sm:h-8 bg-border" />
                <div>
                  <p className="font-display font-bold text-xl sm:text-2xl">{settings?.general?.statsAvgRating || (storeStats as any)?.avgRating || "4.9"}★</p>
                  <p className="text-xs text-muted-foreground">Avg. Rating</p>
                </div>
              </div>
            </div>

            {/* ── RIGHT CARD ZONE ────────────────────────────────────────────────── */}
          <div 
            className="relative flex h-[280px] sm:h-[350px] md:h-[450px] lg:h-[500px] xl:h-[600px] w-full items-center justify-center mt-6 sm:mt-8 lg:mt-0 touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
              {/* Ambient Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] h-[24rem] rounded-full bg-[var(--brand)]/10 blur-[100px] pointer-events-none" />

            {activeBanners.map((banner, index) => {
              const total = activeBanners.length;
              const offset = (index - activeIndex + total) % total;
              let positionClass = "opacity-0 scale-75 pointer-events-none z-0";
                let animDelay = "0s";

                // Position engine: Configures layout based on total cards rendered
                if (total === 1) {
                if (offset === 0) positionClass = "z-20 scale-100 opacity-100";
                } else if (total === 2) {
                if (offset === 0) { positionClass = "z-20 scale-100 translate-x-4 sm:translate-x-8 -translate-y-4 sm:-translate-y-6 opacity-100"; animDelay = "0s"; }
                else if (offset === 1) { positionClass = "z-10 scale-90 -translate-x-8 sm:-translate-x-12 translate-y-6 sm:translate-y-10 opacity-95"; animDelay = "1.5s"; }
                } else {
                if (offset === 0) { positionClass = "z-30 scale-100 translate-x-0 translate-y-0 opacity-100"; animDelay = "0s"; }
                else if (offset === 1) { positionClass = "z-20 scale-90 -translate-x-12 sm:-translate-x-28 translate-y-8 sm:translate-y-16 opacity-95"; animDelay = "1s"; }
                else if (offset === 2) { positionClass = "z-10 scale-90 translate-x-12 sm:translate-x-28 -translate-y-8 sm:-translate-y-16 opacity-90"; animDelay = "2s"; }
                }

                return (
                  <div
                    key={banner.id}
                  className={`absolute bg-card rounded-3xl shadow-2xl p-3 sm:p-4 w-[280px] sm:w-[320px] lg:w-[340px] xl:w-[440px] transition-all duration-700 ease-in-out hover:!z-40 hover:!scale-105 border border-border/50 group ${positionClass}`}
                    style={{ animation: `float 6s ease-in-out infinite`, animationDelay: animDelay }}
                  >
                    <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-muted mb-4 border border-border/30 relative">
                      <img 
                        src={banner.image} 
                        alt={banner.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        fetchPriority={index === 0 ? "high" : "auto"}
                        decoding="async"
                      />
                    </div>
                    <div className="space-y-1 px-1 text-center">
                    <h3 className="font-display font-bold text-base sm:text-lg xl:text-xl leading-tight group-hover:text-[var(--brand)] transition-colors">{banner.title}</h3>
                      {banner.description && (
                      <p className="text-xs sm:text-sm xl:text-base text-muted-foreground line-clamp-2">{banner.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </section>

      {/* ── Features bar ─────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-card">
        <div className="container py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(settings?.general?.features || [
              { icon: "Truck", title: "Free Shipping", desc: `Orders over ${settings?.shipping?.freeShippingThreshold ? formatPrice(settings.shipping.freeShippingThreshold) : formatPrice(50000)}` },
              { icon: "Shield", title: "2-Year Warranty", desc: "On all products" },
              { icon: "RefreshCw", title: "30-Day Returns", desc: "Hassle-free returns" },
              { icon: "Award", title: "Certified Products", desc: "100% authentic hardware" },
            ]).map((f: any, idx: number) => {
              const Icon = dynamicIconMap[f.icon] || CheckCircle;
              return (
                <Link key={idx} href={`/about#feature-${idx}`}>
                  <div className="flex items-center gap-3 p-2 -m-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group">
                    <div className="w-10 h-10 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--brand)]/20 transition-colors">
                      <Icon className="w-5 h-5 text-[var(--brand)] group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold group-hover:text-[var(--brand)] transition-colors">{f.title}</p>
                      <p className="text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Brand Marquee ─────────────────────────────────────────────────── */}
      <section className="py-10 border-b border-border bg-background overflow-hidden flex flex-col justify-center">
        <div className="relative flex w-full overflow-hidden">
          {/* Left and Right fade overlays for a seamless look */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          
          {/* Hover pauses the animation to let users read */}
          <div className="flex w-max items-center animate-marquee hover:[animation-play-state:paused] py-4" style={{ willChange: 'transform' }}>
            {/* Render the list 4 times so it loops perfectly seamlessly even on ultra-wide screens */}
            {[...displayBrands, ...displayBrands, ...displayBrands, ...displayBrands].map((brand, idx) => {
              const iconSlug = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
              return (
                <Link key={idx} href={`/products?brand=${encodeURIComponent(brand)}`} className="mx-3 block">
                  <div className="group relative overflow-hidden rounded-2xl bg-card border border-border hover:border-[var(--brand)]/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 w-40 sm:w-48 h-32 cursor-pointer">
                    {/* Logo filling the card */}
                    <div className="absolute inset-0 flex items-center justify-center p-6 pb-10">
                      <img
                        src={`https://cdn.simpleicons.org/${iconSlug}`}
                        alt={`${brand} logo`}
                        className="w-full h-full object-contain opacity-40 grayscale contrast-0 dark:brightness-200 group-hover:opacity-100 group-hover:grayscale-0 group-hover:contrast-100 dark:group-hover:brightness-100 transition-all duration-500"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        loading="lazy"
                    decoding="async"
                      />
                    </div>
                    
                    {/* Gradient fade on the lower side */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Text at the bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                      <span className="font-display font-bold text-sm tracking-widest text-foreground uppercase relative z-10 flex items-center justify-center gap-1 transition-colors group-hover:text-[var(--brand)]">
                        {brand} <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────────────────── */}
      <section className="py-10 sm:py-12 lg:py-16">
        <div className="container">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8 gap-2">
            <div>
              <p className="text-xs sm:text-sm font-medium text-[var(--brand)] mb-0.5 sm:mb-1">Browse by Category</p>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold">Shop by Category</h2>
            </div>
            <Link href="/products" className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground hover:text-[var(--brand)] transition-colors whitespace-nowrap">
              View all <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {loadingCategories ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-full aspect-[16/9] rounded-3xl" />
          ))
        ) : (Array.isArray(dbCategories) ? dbCategories : []).filter((c: any) => c.featured && c.active !== false).map((cat: any, i: number) => {
              const style = categoryGradients[i % categoryGradients.length];
              
              const Icon = cat.icon ? dynamicIconMap[cat.icon] || Package : (cat.name.toLowerCase().includes('laptop') ? Monitor : cat.name.toLowerCase().includes('desktop') ? Cpu : Headphones);
              return (
              <Link key={i} href={`/products?category=${cat.slug}`}>
                <div className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${style.gradient} border border-border hover:border-[var(--brand)]/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer`}>
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={cat.imageUrl || "/assets/placeholder.png"}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 lg:p-5">
                    <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center mb-1.5 sm:mb-2.5 ${style.iconColor}`}>
                      <Icon className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                    </div>
                    <h3 className="font-display font-bold text-sm sm:text-base lg:text-lg">{cat.name}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{cat.description}</p>
                    <div className="flex items-center gap-1 mt-1.5 sm:mt-2 text-[var(--brand)] text-xs sm:text-sm font-medium">
                      Shop now <ArrowRight className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            )})}
          </div>
        </div>
      </section>

      {/* ── Featured Products ─────────────────────────────────────────────── */}
      <section className="py-12 sm:py-16 lg:py-20 relative bg-muted/30 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute -left-40 top-40 w-96 h-96 bg-[var(--brand)]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="container relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8 gap-2">
            <div>
              <p className="text-xs sm:text-sm font-medium text-[var(--brand)] mb-0.5 sm:mb-1">Hand-picked for you</p>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold">Featured Products</h2>
            </div>
            <Link href="/products?featured=true" className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground hover:text-[var(--brand)] transition-colors whitespace-nowrap">
              View all <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Link>
          </div>

          {loadingFeatured ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-border">
                  <Skeleton className="aspect-[4/3]" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-8 w-full mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : featuredProducts && featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 sm:py-16 text-muted-foreground">
              <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-30" />
              <p className="text-sm sm:text-base">No featured products yet. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Latest Products ───────────────────────────────────────────────── */}
      <section className="py-12 sm:py-16 lg:py-20 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute -right-40 bottom-40 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="container relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8 gap-2">
            <div>
              <p className="text-xs sm:text-sm font-medium text-[var(--brand)] mb-0.5 sm:mb-1">Just arrived</p>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold">Latest Products</h2>
            </div>
            <Link href="/products" className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground hover:text-[var(--brand)] transition-colors whitespace-nowrap">
              View all <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Link>
          </div>

          {loadingLatest ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-border">
                  <Skeleton className="aspect-[4/3]" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-8 w-full mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : latestProducts && latestProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {latestProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 sm:py-16 text-muted-foreground">
              <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-30" />
              <p className="text-sm sm:text-base">No products yet. Products will appear here once added.</p>
              <Link href="/admin">
                <Button className="mt-3 sm:mt-4 bg-[var(--brand)] text-white hover:opacity-90 text-sm">Go to Admin Panel</Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Shop by Lifestyle ─────────────────────────────────────────────────── */}
      <section id="shop-by-lifestyle" className="py-12 sm:py-16 lg:py-20 scroll-mt-20">
        <div className="container">
          <div className="text-center mb-6 sm:mb-10">
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold">A Laptop for Every Lifestyle</h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-1.5 sm:mt-2 max-w-2xl mx-auto">
              Whether you're a creative professional, a hardcore gamer, or a student, find the perfect machine tailored to your needs.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            {lifestyles.map((lifestyle: any) => {
              const Icon = dynamicIconMap[lifestyle.icon] || Package;
              return (
                <Link key={lifestyle.title} href={lifestyle.link} className="block">
                  <div className="group relative overflow-hidden rounded-2xl bg-card border border-border hover:border-[var(--brand)]/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-32 sm:h-36 lg:h-40 cursor-pointer">
                    {/* Massive Icon filling the background */}
                    <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 pb-10 sm:pb-12">
                      <Icon className="w-full h-full opacity-10 group-hover:opacity-30 group-hover:scale-110 transition-all duration-500 text-foreground group-hover:text-[var(--brand)]" strokeWidth={1.5} />
                    </div>
                    
                    {/* Gradient fade on the lower side */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent opacity-90 group-hover:from-[var(--brand)]/90 group-hover:via-[var(--brand)]/30 group-hover:opacity-100 transition-all duration-500" />
                    
                    {/* Text at the bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5 text-center flex flex-col items-center justify-end">
                      <h3 className="font-display font-bold text-xs sm:text-sm lg:text-base tracking-widest text-foreground uppercase relative z-10 flex items-center justify-center gap-1 transition-colors group-hover:text-white">
                        {lifestyle.title} <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                      </h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 relative z-10 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 px-2 line-clamp-1 group-hover:text-white/80">
                        {lifestyle.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Location / Map ─────────────────────────────────────────────────── */}
      <section ref={mapSectionRef} className="py-10 sm:py-12 lg:py-16 bg-muted/30 border-t border-border">
        <div className="container">
          <div className="text-center mb-10">
            <p className="text-sm font-medium text-[var(--brand)] mb-1">Come visit us</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">Our Store Location</h2>
            <p className="text-muted-foreground mt-2">{settings?.general?.address || "123 Innovation Drive, Suite 100, Tech City"}</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            {/* Map Column */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-border shadow-lg bg-muted relative min-h-[400px]">
              {isMapVisible ? (
                <>
                  <iframe
                    title="Store Location Map"
                    className="absolute inset-0 w-full h-full border-0 grayscale-[15%] contrast-[1.1] dark:invert dark:hue-rotate-180"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(settings?.general?.address || "Nairobi, Kenya")}&t=m&z=15&output=embed`}
                  />
                  {/* Professional Floating Store Name Tag */}
                  <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-700 pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-[var(--brand)]/10 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5 text-[var(--brand)]" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground leading-none">{storeName}</p>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1 flex items-center gap-1.5">
                        {isStoreOpen ? (
                          <><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" /> Walk-ins Welcome</>
                        ) : (
                          <><span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" /> Currently Closed</>
                        )}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <Skeleton className="absolute inset-0 w-full h-full" />
              )}
            </div>
            
            {/* Hours Column */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div>
                 <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-4">
                   <Clock className="w-5 h-5 text-[var(--brand)]" /> Opening Hours
                 </h3>
                 <ul className="space-y-3 text-sm">
                   {(settings?.general?.openingHours || [
                     { label: "Mon - Fri", value: "9:00 AM - 8:00 PM" },
                     { label: "Saturday", value: "10:00 AM - 6:00 PM" },
                     { label: "Sunday", value: "Closed" }
                   ]).map((hour: any, idx: number, arr: any[]) => (
                     <li key={idx} className={`flex justify-between ${idx < arr.length - 1 ? "border-b border-border pb-2" : ""}`}>
                       <span className="text-muted-foreground">{hour.label}</span>
                       <span className={`font-medium ${hour.value.toLowerCase() === "closed" ? "text-[var(--brand)]" : ""}`}>
                         {hour.value}
                       </span>
                     </li>
                   ))}
                 </ul>
              </div>
              <div className="border-t border-border pt-6 mt-6">
                 <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(settings?.general?.address || "123 Innovation Drive, Suite 100, Tech City")}`} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full gap-2 bg-[var(--brand)] text-white hover:opacity-90 transition-all shadow-md hover:shadow-lg h-12 text-base font-semibold">
                    <Navigation className="w-4 h-4" /> Get Directions
                  </Button>
                 </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 relative overflow-hidden bg-zinc-950 dark:bg-zinc-900 border-t border-border mt-6 sm:mt-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] bg-[var(--brand)]/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="container relative z-10 text-center text-white">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            {ctaTitle}
          </h2>
          <p className="text-zinc-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            {ctaDescription}
          </p>
          <Link href="/products">
            <Button size="lg" className="bg-[var(--brand)] text-white hover:opacity-90 font-semibold gap-2 h-12 px-8 rounded-full text-base transition-transform hover:scale-105 shadow-lg">
              <ShoppingBag className="w-5 h-5" /> Start Shopping
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Recently Viewed ──────────────────────────────────────────────── */}
      {recentProducts.length > 0 && (
        <section className="py-10 sm:py-12 lg:py-16 bg-muted/20 border-t border-border">
          <div className="container">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-sm font-medium text-[var(--brand)] mb-1">Pick up where you left off</p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold">Recently Viewed</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {recentProducts.slice(0, 4).map((product) => (
                <ProductCard key={`recent-${product.id}`} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Floating Announcement Sticker ─────────────────────────────────── */}
      {latestAnnouncement && !dismissedAnnouncements.includes(latestAnnouncement.id) && (
        <div className="fixed bottom-6 right-6 z-50 w-[calc(100%-3rem)] sm:w-80 bg-gradient-to-br from-card to-[var(--brand)]/10 backdrop-blur-xl border border-[var(--brand)]/20 hover:border-[var(--brand)]/50 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-500 group transition-colors">
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); dismissAnnouncement(latestAnnouncement.id); }} 
            className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/70 text-white rounded-full transition-colors z-20"
            aria-label="Dismiss announcement"
            title="Dismiss announcement"
          >
            <X className="w-4 h-4" />
          </button>
          
          {/* Dynamic Content Wrapper (Link or Div) */}
          {(() => {
            const content = (
              <div className="relative z-10">
                {latestAnnouncement.image && (
                  <div className="relative h-36 w-full overflow-hidden">
                    <img 
                      src={latestAnnouncement.image} 
                      alt={latestAnnouncement.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      loading="lazy" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <h4 className="absolute bottom-3 left-4 right-8 font-display font-bold text-white text-lg leading-tight drop-shadow-md">{latestAnnouncement.title}</h4>
                  </div>
                )}
                <div className="p-5">
                  {!latestAnnouncement.image && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--brand)]/10 flex items-center justify-center shrink-0">
                        <Megaphone className="w-4 h-4 text-[var(--brand)]" />
                      </div>
                      <h4 className="font-display font-bold text-sm leading-tight">{latestAnnouncement.title}</h4>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground leading-relaxed">{latestAnnouncement.content}</p>
                  {latestAnnouncement.linkUrl && (
                    <div className="mt-3 flex items-center gap-1 text-sm font-semibold text-[var(--brand)] group-hover:translate-x-1 transition-transform">
                      Learn more <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>
            );
            
            return latestAnnouncement.linkUrl ? (
              <a href={latestAnnouncement.linkUrl} className="block cursor-pointer">
                {content}
              </a>
            ) : content;
          })()}
        </div>
      )}

      <Footer />
    </div>
  );
}
