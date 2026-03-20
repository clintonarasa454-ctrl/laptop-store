import { trpc } from "@/lib/trpc";
import {
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
} from "lucide-react";
import { dynamicIconMap } from "@/lib/iconMap";
import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";
import StoreLoader from "@/components/StoreLoader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapView } from "@/components/Map";

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
  const { data: featuredProducts, isLoading: loadingFeatured } = trpc.products.list.useQuery(
    { featured: true, limit: 8 },
    { staleTime: 1000 * 60 * 5 } // Cache for 5 minutes
  );
  const { data: latestProducts, isLoading: loadingLatest } = trpc.products.list.useQuery(
    { limit: 8 },
    { staleTime: 1000 * 60 * 5 }
  );
  const { data: banners, isLoading: loadingBanners } = trpc.content.banners.useQuery(undefined, { staleTime: 1000 * 60 * 5 });
  const { data: promotions, isLoading: loadingPromotions } = trpc.content.promotions.useQuery(undefined, { staleTime: 1000 * 60 * 5 });
  const { data: dbCategories, isLoading: loadingCategories } = trpc.categories.list.useQuery(undefined, { 
    staleTime: 1000 * 60 * 60 // Cache categories for 1 full hour
  });
  const { data: storeStats, isLoading: loadingStats } = trpc.store.stats.useQuery(undefined, { staleTime: 1000 * 60 * 5 });
  const { data: settings, isLoading: loadingSettings } = trpc.settings.public.useQuery(
    { keys: ["shipping", "general", "brands"] },
    { 
      staleTime: Infinity, // Settings rarely change; cache indefinitely per user session
      gcTime: Infinity 
    }
  );
  const { data: announcements, isLoading: loadingAnnouncements } = trpc.content.announcements.useQuery(undefined, { 
    staleTime: 1000 * 60 * 5 
  });

  const activeAnnouncements = announcements?.filter(a => a.active) || [];
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

  const orderedBanners = banners ? [...banners].sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0)) : [];
  const mainBanner = orderedBanners?.[0];
  const activeBanners = orderedBanners?.filter(b => b.active) || [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const mapSectionRef = useRef<HTMLElement>(null);
  const [isMapVisible, setIsMapVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsMapVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" } // Pre-load the map slightly before it scrolls into view
    );
    if (mapSectionRef.current) observer.observe(mapSectionRef.current);
    return () => observer.disconnect();
  }, []);
  
  useEffect(() => {
    if (activeBanners.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % activeBanners.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [activeBanners.length, isHovered]);

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
  };

  const heroTitle = settings?.general?.heroTitle || "Premium Tech, Exceptional Performance";
  const heroDescription = settings?.general?.heroDescription || "Discover the latest laptops, desktops, and accessories from the world's leading brands. Built for professionals, creators, and gamers.";
  const ctaTitle = settings?.general?.ctaTitle || "Ready to Upgrade Your Setup?";
  const ctaDescription = settings?.general?.ctaDescription || "Join thousands of satisfied customers. Shop the latest tech with confidence — free shipping on orders over $500.";

  const badge1 = settings?.general?.floatingBadge1 || { icon: "Shield", title: "Verified Quality", desc: "All products certified" };
  const badge2 = settings?.general?.floatingBadge2 || { icon: "Truck", title: "Fast Delivery", desc: "2–5 business days" };
  const Badge1Icon = dynamicIconMap[badge1.icon] || Shield;
  const Badge2Icon = dynamicIconMap[badge2.icon] || Truck;
  
  const displayBrands = settings?.brands && settings.brands.length > 0 ? settings.brands : ["Samsung", "Dell", "HP", "Lenovo", "Asus", "Apple", "Acer"];

  const lifestyles = settings?.general?.lifestyles || fallbackLifestyles;

  // Only block the initial page render for absolutely critical data
  const isPageLoading = loadingSettings || loadingBanners || loadingCategories;

  if (isPageLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <StoreLoader />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
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
      {promotions && promotions.length > 0 && (
        <div 
          className="text-white py-2.5 px-4 text-center text-sm font-medium relative z-10"
          style={{ backgroundColor: "var(--promo-banner, var(--brand))" }}
        >
          <div className="container flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {promotions.map((p) => (
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

      <div className="container relative pt-6 pb-12 lg:pt-10 lg:pb-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start lg:mt-6">
            <div className="space-y-5">
              <Badge className="bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/20 hover:bg-[var(--brand)]/15">
                <Zap className="w-3 h-3 mr-1" /> {settings?.general?.heroBadge || "New Arrivals 2025"}
              </Badge>
              <h1 
                className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight whitespace-pre-line animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-700"
              >
                {heroTitle}
              </h1>
              <p 
                className="text-lg text-muted-foreground leading-relaxed max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-backwards"
              >
                {heroDescription}
              </p>
              <div className="flex flex-wrap gap-3">
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
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-2">
                <div>
                  <p className="font-display font-bold text-2xl">{settings?.general?.statsProductCount || storeStats?.productCount || 0}+</p>
                  <p className="text-xs text-muted-foreground">Products</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                  <p className="font-display font-bold text-2xl">{settings?.general?.statsCustomerCount || storeStats?.customerCount || 0}+</p>
                  <p className="text-xs text-muted-foreground">Happy Customers</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                  <p className="font-display font-bold text-2xl">{settings?.general?.statsAvgRating || storeStats?.avgRating || "4.9"}★</p>
                  <p className="text-xs text-muted-foreground">Avg. Rating</p>
                </div>
              </div>
            </div>

            {/* ── RIGHT CARD ZONE ────────────────────────────────────────────────── */}
          <div 
            className="relative flex h-[350px] sm:h-[450px] lg:h-[500px] xl:h-[600px] w-full items-center justify-center mt-8 lg:mt-0 touch-pan-y"
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
                      <img src={banner.image} alt={banner.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
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
              { icon: "Truck", title: "Free Shipping", desc: `On orders over $${settings?.shipping?.freeShippingThreshold || 500}` },
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
          <div className="flex w-max items-center animate-marquee hover:[animation-play-state:paused] py-4">
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
      <section className="py-16">
        <div className="container">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-sm font-medium text-[var(--brand)] mb-1">Browse by Category</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold">Shop by Category</h2>
            </div>
            <Link href="/products" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-[var(--brand)] transition-colors">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {(dbCategories || []).filter((c: any) => c.featured && c.active !== false).map((cat: any, i: number) => {
              const style = categoryGradients[i % categoryGradients.length];
              
              const Icon = cat.icon ? dynamicIconMap[cat.icon] || Package : (cat.name.toLowerCase().includes('laptop') ? Monitor : cat.name.toLowerCase().includes('desktop') ? Cpu : Headphones);
              return (
              <Link key={i} href={`/products?category=${cat.slug}`}>
                <div className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${style.gradient} border border-border hover:border-[var(--brand)]/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer`}>
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={cat.imageUrl || "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80"}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
                      loading="lazy"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <div className={`w-9 h-9 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center mb-2.5 ${style.iconColor}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <h3 className="font-display font-bold text-lg">{cat.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{cat.description}</p>
                    <div className="flex items-center gap-1 mt-2 text-[var(--brand)] text-sm font-medium">
                      Shop now <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            )})}
          </div>
        </div>
      </section>

      {/* ── Featured Products ─────────────────────────────────────────────── */}
      <section className="py-20 relative bg-muted/30 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute -left-40 top-40 w-96 h-96 bg-[var(--brand)]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="container relative z-10">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-sm font-medium text-[var(--brand)] mb-1">Hand-picked for you</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold">Featured Products</h2>
            </div>
            <Link href="/products?featured=true" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-[var(--brand)] transition-colors">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {loadingFeatured ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No featured products yet. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Latest Products ───────────────────────────────────────────────── */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute -right-40 bottom-40 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="container relative z-10">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-sm font-medium text-[var(--brand)] mb-1">Just arrived</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold">Latest Products</h2>
            </div>
            <Link href="/products" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-[var(--brand)] transition-colors">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {loadingLatest ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {latestProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No products yet. Products will appear here once added.</p>
              <Link href="/admin">
                <Button className="mt-4 bg-[var(--brand)] text-white hover:opacity-90">Go to Admin Panel</Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Shop by Lifestyle ─────────────────────────────────────────────────── */}
      <section id="shop-by-lifestyle" className="py-20 scroll-mt-20">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-bold">A Laptop for Every Lifestyle</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Whether you're a creative professional, a hardcore gamer, or a student, find the perfect machine tailored to your needs.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {lifestyles.map((lifestyle: any) => {
              const Icon = dynamicIconMap[lifestyle.icon] || Package;
              return (
                <Link key={lifestyle.title} href={lifestyle.link} className="block">
                  <div className="group relative overflow-hidden rounded-2xl bg-card border border-border hover:border-[var(--brand)]/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-36 sm:h-40 cursor-pointer">
                    {/* Massive Icon filling the background */}
                    <div className="absolute inset-0 flex items-center justify-center p-6 pb-12">
                      <Icon className="w-full h-full opacity-10 group-hover:opacity-30 group-hover:scale-110 transition-all duration-500 text-foreground group-hover:text-[var(--brand)]" strokeWidth={1.5} />
                    </div>
                    
                    {/* Gradient fade on the lower side */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent opacity-90 group-hover:from-[var(--brand)]/90 group-hover:via-[var(--brand)]/30 group-hover:opacity-100 transition-all duration-500" />
                    
                    {/* Text at the bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-5 text-center flex flex-col items-center justify-end">
                      <h3 className="font-display font-bold text-sm sm:text-base tracking-widest text-foreground uppercase relative z-10 flex items-center justify-center gap-1 transition-colors group-hover:text-white">
                        {lifestyle.title} <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 relative z-10 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 px-2 line-clamp-1 group-hover:text-white/80">
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
      <section ref={mapSectionRef} className="py-16 bg-muted/30 border-t border-border">
        <div className="container">
          <div className="text-center mb-10">
            <p className="text-sm font-medium text-[var(--brand)] mb-1">Come visit us</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">Our Store Location</h2>
            <p className="text-muted-foreground mt-2">{settings?.general?.address || "123 Tech Avenue, Silicon Valley, CA 94025"}</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            {/* Map Column */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-border shadow-lg">
              {isMapVisible ? (
              <MapView 
                className="h-[400px]" 
                options={{ styles: darkMapStyle }}
                onMapReady={(map) => {
                  if (window.google) {
                    const geocoder = new window.google.maps.Geocoder();
                    geocoder.geocode({ address: settings?.general?.address || "123 Tech Avenue, Silicon Valley, CA 94025" }, (results, status) => {
                      if (status === "OK" && results?.[0]) {
                        map.setCenter(results[0].geometry.location);
                        
                        let markerContent;
                        if (settings?.appearance?.logoUrl) {
                          markerContent = document.createElement('div');
                          markerContent.className = "bg-card border-2 border-[var(--brand)] shadow-xl rounded-full flex items-center justify-center overflow-hidden w-12 h-12 relative z-10";
                          const img = document.createElement('img');
                          img.src = settings.appearance.logoUrl;
                          img.className = "w-full h-full object-contain p-1.5";
                          markerContent.appendChild(img);
                        }

                        new window.google.maps.marker.AdvancedMarkerElement({
                          map,
                          position: results[0].geometry.location,
                          title: settings?.general?.storeName || "Store",
                          content: markerContent,
                        });
                      }
                    });
                  }
                }}
              />
              ) : (
                <Skeleton className="h-[400px] w-full" />
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
                 <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings?.general?.address || "123 Tech Avenue, Silicon Valley, CA 94025")}`} target="_blank" rel="noopener noreferrer">
                   <Button variant="outline" className="w-full gap-2 hover:bg-[var(--brand)] hover:text-white transition-colors">
                     Get Directions <ArrowRight className="w-4 h-4" />
                   </Button>
                 </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden bg-zinc-950 dark:bg-zinc-900 border-t border-border mt-10">
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
