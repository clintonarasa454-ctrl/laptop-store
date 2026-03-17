import { trpc } from "@/lib/trpc";
import { Filter, Package, Search, SlidersHorizontal, X, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
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
  const tagParam = params.get("tag") ?? undefined;
  const validSorts = ["newest", "price_asc", "price_desc"];
  const sortByParam = validSorts.includes(params.get("sortBy") || "") ? (params.get("sortBy") as any) : "newest";

  const [search, setSearch] = useState(searchParam ?? "");
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string | undefined>(brandParam);
  const [minPrice, setMinPrice] = useState<string>(minPriceParam);
  const [maxPrice, setMaxPrice] = useState<string>(maxPriceParam);
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">(sortByParam);
  const [tagFilter, setTagFilter] = useState<string | undefined>(tagParam);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  const { data: categories } = trpc.categories.list.useQuery();
  const { data: settings } = trpc.settings.public.useQuery({ keys: ["brands", "general"] });
  const activeCategories = categories ? categories.filter(c => (c as any).active !== false) : [];
  const orderedCategories = [...activeCategories].sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));
  const rootCategories = orderedCategories.filter(c => !(c as any).parentId);
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
            // Deep compare to prevent React state update loops
            setSelectedCategories((prev) => {
              if (prev.length === ids.length && prev.every((v, i) => v === ids[i])) return prev;
              return ids;
            });
      setIsInitialized(true);
    }
  }, [categories, categoriesParam, categorySlug]);

  // Reset pagination when any filter changes
  useEffect(() => {
    setVisibleCount(12);
  }, [search, selectedCategories, selectedBrand, minPrice, maxPrice, sortBy, tagFilter]);

  // Sync search URL param to state when navigating from Navbar
  useEffect(() => {
    setSearch(searchParam ?? "");
  }, [searchParam]);

  // Sync tag URL param to state
  useEffect(() => {
    setTagFilter(tagParam);
  }, [tagParam]);

  // Sync state to URL seamlessly
  useEffect(() => {
    if (!isInitialized) return;
    
    const currentParams = new URLSearchParams(searchString);
    const newParams = new URLSearchParams();
    
    if (search) newParams.set("search", search);
    
    // Read featured directly from current URL so we don't need it in dependencies
    if (currentParams.get("featured") === "true") newParams.set("featured", "true");
    
    if (selectedBrand) newParams.set("brand", selectedBrand);
    if (minPrice) newParams.set("minPrice", minPrice);
    if (maxPrice) newParams.set("maxPrice", maxPrice);
    if (sortBy !== "newest") newParams.set("sortBy", sortBy);
    if (tagFilter) newParams.set("tag", tagFilter);
    
    if (categories) {
      if (selectedCategories.length > 0) {
        const slugs = categories
          .filter(c => selectedCategories.includes(c.id))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map(c => c.slug);
        if (slugs.length > 0) newParams.set("categories", slugs.join(","));
      }
    } else {
      const pCats = currentParams.get("categories");
      const pCat = currentParams.get("category");
      if (pCats) newParams.set("categories", pCats);
      else if (pCat) newParams.set("category", pCat);
    }

    const qs = newParams.toString();
    
    // Bulletproof deep comparison
    let hasChanges = false;
    const newKeys = Array.from(newParams.keys());
    const currentKeys = Array.from(currentParams.keys());
    
    if (newKeys.length !== currentKeys.length) {
      hasChanges = true;
    } else {
      for (const key of newKeys) {
        if (newParams.get(key) !== currentParams.get(key)) {
          hasChanges = true;
          break;
        }
      }
    }

    if (hasChanges) {
      const newUrl = qs ? `${location}?${qs}` : location;
      const currentUrl = searchString ? `${location}?${searchString}` : location;
      // Only push if the full URL string actually differs
      if (currentUrl !== newUrl) {
        setLocation(newUrl, { replace: true });
      }
    }
  }, [isInitialized, search, selectedCategories, selectedBrand, minPrice, maxPrice, sortBy, tagFilter, categories, location, searchString, setLocation]);

  // Include child categories if a parent is selected
  const categoryIdsToFetch = selectedCategories.length > 0 ? selectedCategories.flatMap(id => {
    const children = categories?.filter(c => (c as any).parentId === id).map(c => c.id) || [];
    return [id, ...children];
  }) : undefined;

  const { data: products, isLoading } = trpc.products.list.useQuery({
    search: search || undefined,
    featured: featuredParam || undefined,
    tag: tagFilter || undefined,
    categoryId: categoryIdsToFetch,
    limit: 100,
  });

  // Identify if we are viewing exactly one category that has children
  const currentCategoryId = selectedCategories.length === 1 ? selectedCategories[0] : undefined;
  const currentCategory = categories?.find(c => c.id === currentCategoryId);
  const subCategories = currentCategory ? orderedCategories.filter(c => (c as any).parentId === currentCategory.id) : [];

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
  if (tagFilter) {
    activeFilters.push({ id: "tag", label: `Tag: ${tagFilter}`, onRemove: () => setTagFilter(undefined) });
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
          <aside className={`${filtersOpen ? "block" : "hidden"} lg:block w-full lg:w-56 shrink-0 space-y-6`}>
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
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                    selectedCategories.length === 0 ? "bg-[var(--brand)]/10 text-[var(--brand)] font-semibold shadow-sm" : "text-muted-foreground font-medium hover:bg-[var(--brand)]/5 hover:text-[var(--brand)]"
                  }`}
                >
                  All Categories
                </button>
              {rootCategories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                const children = orderedCategories.filter(c => (c as any).parentId === cat.id);
                return (
                  <div key={cat.id} className="pt-1">
                    <button
                      onClick={() => setSelectedCategories((prev) => isSelected ? prev.filter((id) => id !== cat.id) : [...prev, cat.id])}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                        isSelected ? "bg-[var(--brand)]/10 text-[var(--brand)] font-semibold shadow-sm" : "text-foreground font-medium hover:bg-[var(--brand)]/5 hover:text-[var(--brand)]"
                      }`}
                    >
                      <span>{cat.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                    {children.length > 0 && (
                      <div className="flex flex-col gap-0.5 ml-3 pl-3 border-l-2 border-border/50 mt-1 mb-2">
                        {children.map(child => {
                          const isChildSelected = selectedCategories.includes(child.id);
                          return (
                            <button
                              key={child.id}
                              onClick={() => setSelectedCategories((prev) => isChildSelected ? prev.filter((id) => id !== child.id) : [...prev, child.id])}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                                isChildSelected ? "bg-[var(--brand)]/10 text-[var(--brand)] font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              }`}
                            >
                              <span>{child.name}</span>
                              {isChildSelected && <Check className="w-3.5 h-3.5 text-[var(--brand)]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>

            {/* Price Range */}
            <div>
              <h3 className="font-display font-semibold text-sm mb-3">Price Range</h3>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-muted-foreground text-xs font-medium">{currency}</span>
                  </div>
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full h-10 pl-8 pr-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all shadow-sm"
                  />
                </div>
                <span className="text-muted-foreground">-</span>
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-muted-foreground text-xs font-medium">{currency}</span>
                  </div>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full h-10 pl-8 pr-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all shadow-sm"
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
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                    !selectedBrand ? "bg-[var(--brand)]/10 text-[var(--brand)] font-semibold shadow-sm" : "text-muted-foreground font-medium hover:bg-[var(--brand)]/5 hover:text-[var(--brand)]"
                  }`}
                >
                  <span>All Brands</span>
                  {!selectedBrand && <Check className="w-3.5 h-3.5 text-[var(--brand)]" />}
                </button>
                {availableBrands.map((brand: string) => (
                  <button
                    key={brand}
                    onClick={() => setSelectedBrand(brand)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                      selectedBrand === brand ? "bg-[var(--brand)]/10 text-[var(--brand)] font-semibold shadow-sm" : "text-foreground font-medium hover:bg-[var(--brand)]/5 hover:text-[var(--brand)]"
                    }`}
                  >
                    <span>{brand}</span>
                    {selectedBrand === brand && <Check className="w-3.5 h-3.5 text-[var(--brand)]" />}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Product grid */}
          <div className="flex-1 min-w-0">
            {/* Sub-categories Grid */}
            {subCategories.length > 0 && !isLoading && !search && (
              <div className="mb-8">
                <h3 className="font-display font-semibold text-lg mb-4">Shop by Subcategory</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {subCategories.map(subCat => (
                    <Link key={subCat.id} href={`/products?category=${subCat.slug}`}>
                      <div className="group relative overflow-hidden rounded-xl border border-border bg-card hover:border-[var(--brand)]/40 hover:shadow-lg transition-all duration-300 cursor-pointer">
                        <div className="aspect-[16/9] sm:aspect-[2/1] bg-muted overflow-hidden flex items-center justify-center">
                          {subCat.imageUrl ? (
                            <img src={subCat.imageUrl} alt={subCat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <Package className="w-8 h-8 text-muted-foreground opacity-20 group-hover:scale-110 transition-transform duration-500" />
                          )}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent pointer-events-none" />
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-center pointer-events-none">
                          <h4 className="font-medium text-sm group-hover:text-[var(--brand)] transition-colors">{subCat.name}</h4>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

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
