import { trpc } from "@/lib/trpc";
import { Filter, Package, Search, SlidersHorizontal, X, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/cart";

export default function Products() {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const categorySlug = params.get("category") ?? undefined;
  const categoriesParam = params.get("categories") ?? undefined;
  const searchParam = params.get("search") ?? undefined;
  const featuredParam = params.get("featured") === "true";
  const brandParam = params.get("brand") ?? undefined;
  const minPriceParam = params.get("minPrice") ?? "";
  const maxPriceParam = params.get("maxPrice") ?? "";
  const sortByParam = (params.get("sortBy") as any) ?? "newest";

  const [search, setSearch] = useState(searchParam ?? "");
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | undefined>(brandParam);
  const [minPrice, setMinPrice] = useState<string>(minPriceParam);
  const [maxPrice, setMaxPrice] = useState<string>(maxPriceParam);
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">(sortByParam);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  const { data: categories } = trpc.categories.list.useQuery();
  const { data: settings } = trpc.settings.public.useQuery({ keys: ["brands", "general"] });
  const orderedCategories = categories ? [...categories].sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0)) : [];
  const availableBrands = settings?.brands || ["Samsung", "Dell", "HP", "Lenovo", "Asus"];
  const currency = settings?.general?.currency || "$";

  useEffect(() => {
    if (categories) {
      let ids: number[] = [];
      if (categoriesParam) {
        const slugs = categoriesParam.split(",");
        ids = categories.filter(c => slugs.includes(c.slug)).map(c => c.id);
      } else if (categorySlug) {
        const cat = categories.find(c => c.slug === categorySlug);
        if (cat) ids = [cat.id];
      }
      setSelectedCategories(ids);
    }
  }, [categories, categoriesParam, categorySlug]);

  // Reset pagination when any filter changes
  useEffect(() => {
    setVisibleCount(12);
  }, [search, selectedCategories, selectedBrand, minPrice, maxPrice, sortBy]);

  // Sync search URL param to state when navigating from Navbar
  useEffect(() => {
    setSearch(searchParam ?? "");
  }, [searchParam]);

  // Sync state to URL seamlessly
  useEffect(() => {
    const newParams = new URLSearchParams();
    if (search) newParams.set("search", search);
    if (featuredParam) newParams.set("featured", "true");
    if (selectedBrand) newParams.set("brand", selectedBrand);
    if (minPrice) newParams.set("minPrice", minPrice);
    if (maxPrice) newParams.set("maxPrice", maxPrice);
    if (sortBy !== "newest") newParams.set("sortBy", sortBy);
    
    if (orderedCategories && selectedCategories.length > 0) {
      const slugs = orderedCategories.filter(c => selectedCategories.includes(c.id)).map(c => c.slug);
      if (slugs.length > 0) newParams.set("categories", slugs.join(","));
    }

    const qs = newParams.toString();
    
    // Robust comparison to prevent infinite loop
    const currentParams = new URLSearchParams(searchString);
    currentParams.sort();
    newParams.sort();
    
    if (currentParams.toString() !== newParams.toString()) {
      setLocation(qs ? `${location}?${qs}` : location, { replace: true });
    }
  }, [search, selectedCategories, selectedBrand, minPrice, maxPrice, sortBy, categories, location, searchString, setLocation, featuredParam]);

  const { data: products, isLoading } = trpc.products.list.useQuery({
    search: search || undefined,
    featured: featuredParam || undefined,
    limit: 100,
  });

  const sorted = [...(products ?? [])]
    .filter((p) => selectedCategories.length === 0 || selectedCategories.includes(p.categoryId))
    .filter((p) => !selectedBrand || p.brand?.toLowerCase() === selectedBrand.toLowerCase())
    .filter((p) => {
      const price = parseFloat(p.price);
      const min = minPrice !== "" ? parseFloat(minPrice) : 0;
      const max = maxPrice !== "" ? parseFloat(maxPrice) : Infinity;
      return price >= min && price <= max;
    })
    .filter((p) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return p.name.toLowerCase().includes(s) || 
             (p.brand && p.brand.toLowerCase().includes(s));
    })
    .sort((a, b) => {
      if (sortBy === "price_asc") return parseFloat(a.price) - parseFloat(b.price);
      if (sortBy === "price_desc") return parseFloat(b.price) - parseFloat(a.price);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  type ActiveFilter = { id: string; label: string; onRemove: () => void };
  const activeFilters: ActiveFilter[] = [];

  if (search) {
    activeFilters.push({ id: "search", label: `"${search}"`, onRemove: () => setSearch("") });
  }
  if (featuredParam) {
    activeFilters.push({ id: "featured", label: "Featured", onRemove: () => window.location.href = "/products" });
  }
  if (selectedBrand) {
    activeFilters.push({ id: "brand", label: `Brand: ${selectedBrand}`, onRemove: () => setSelectedBrand(undefined) });
  }
  selectedCategories.forEach((catId) => {
    const catName = orderedCategories.find((c) => c.id === catId)?.name;
    if (catName) {
      activeFilters.push({
        id: `cat-${catId}`,
        label: catName,
        onRemove: () => setSelectedCategories((prev) => prev.filter((id) => id !== catId)),
      });
    }
  });
  if (minPrice || maxPrice) {
    activeFilters.push({
      id: "price",
      label: `Price: ${formatPrice(minPrice || 0)} - ${maxPrice ? formatPrice(maxPrice) : "∞"}`,
      onRemove: () => { setMinPrice(""); setMaxPrice(""); },
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Page header */}
      <div className="border-b border-border bg-card">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold">
                {featuredParam 
                  ? "Featured Deals" 
                  : selectedCategories.length === 1 
                    ? orderedCategories.find((c) => c.id === selectedCategories[0])?.name ?? "Products" 
                    : selectedCategories.length > 1 
                      ? "Multiple Categories"
                      : search 
                        ? `Search: "${search}"` 
                        : "All Products"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {sorted.length} product{sorted.length !== 1 ? "s" : ""} found
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
              <Button variant="outline" size="sm" onClick={() => setFiltersOpen(!filtersOpen)} className="gap-1.5 lg:hidden">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
              </Button>
            </div>
          </div>

          {/* Active filters */}
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-muted-foreground">Active:</span>
              {activeFilters.map((f) => (
                <Badge key={f.id} variant="secondary" className="gap-1 text-xs">
                  {f.label}
                  <button onClick={f.onRemove}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container py-8 flex-1">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar filters */}
          <aside className={`${filtersOpen ? "block" : "hidden"} lg:block w-56 shrink-0 space-y-6`}>
            {/* Search */}
            <div>
              <h3 className="font-display font-semibold text-sm mb-3">Search</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full h-9 pl-9 pr-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Categories */}
            <div>
              <h3 className="font-display font-semibold text-sm mb-3">Category</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategories([])}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedCategories.length === 0 ? "bg-[var(--brand)]/10 text-[var(--brand)] font-medium" : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  All Categories
                </button>
                {orderedCategories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategories((prev) =>
                          isSelected ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                        );
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                        isSelected ? "bg-[var(--brand)]/10 text-[var(--brand)] font-medium" : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <span>{cat.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price Range */}
            <div>
              <h3 className="font-display font-semibold text-sm mb-3">Price Range</h3>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">{currency}</span>
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full h-9 pl-10 pr-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <span className="text-muted-foreground">-</span>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">{currency}</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full h-9 pl-10 pr-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            {/* Brands */}
            <div>
              <h3 className="font-display font-semibold text-sm mb-3">Brand</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedBrand(undefined)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${!selectedBrand ? "bg-[var(--brand)]/10 text-[var(--brand)] font-medium" : "hover:bg-muted text-muted-foreground"}`}
                >
                  All Brands
                </button>
                {availableBrands.map((brand: string) => (
                  <button
                    key={brand}
                    onClick={() => setSelectedBrand(brand)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedBrand === brand ? "bg-[var(--brand)]/10 text-[var(--brand)] font-medium" : "hover:bg-muted text-muted-foreground"}`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Product grid */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 9 }).map((_, i) => (
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
            ) : sorted.length > 0 ? (
              <>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {sorted.slice(0, visibleCount).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {visibleCount < sorted.length && (
                  <div className="mt-10 flex justify-center">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setVisibleCount((prev) => prev + 12)}
                      className="min-w-[200px] bg-background hover:bg-muted font-medium border-border"
                    >
                      Load More Products
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 flex flex-col items-center">
                <div className="relative w-48 h-48 mb-6 flex items-center justify-center">
                  <div className="absolute inset-0 bg-[var(--brand)]/10 rounded-full blur-3xl animate-pulse" />
                  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground relative z-10">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" className="text-[var(--brand)]/20" fill="currentColor"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                    <circle cx="12" cy="12" r="6" fill="var(--background)" stroke="currentColor" strokeWidth="1.5"/>
                    <line x1="16" y1="16" x2="20" y2="20" strokeWidth="2" className="text-[var(--brand)]"/>
                    <path d="M10 10l4 4m0-4l-4 4" strokeWidth="1.5" className="text-muted-foreground"/>
                  </svg>
                </div>
                <h3 className="font-display font-semibold text-2xl mb-2">No products found</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">We couldn't find anything matching your current filters. Try broadening your search or clearing some filters.</p>
                <Button
                  className="bg-[var(--brand)] text-white hover:opacity-90 min-w-[160px]"
                  onClick={() => { 
                    setSearch(""); 
                    setSelectedCategories([]); 
                    setSelectedBrand(undefined);
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
