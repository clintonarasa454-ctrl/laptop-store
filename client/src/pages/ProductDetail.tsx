import { useAuth } from "@/pages/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { addToGuestCart, formatPrice } from "@/lib/cart";
import {
  ArrowLeft,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Heart,
  Package,
  Plus,
  Shield,
  ShoppingCart,
  Star,
  Truck,
  XCircle,
  Zap,
  Share2,
} from "lucide-react";
import { dynamicIconMap } from "@/lib/iconMap";
import { useState, useEffect, useMemo } from "react";
import { addRecentlyViewed, getRecentlyViewed } from "@/lib/ux";
import { Link, useParams } from "wouter";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: settings } = trpc.settings.public.useQuery(
    { keys: ["general", "shipping"] },
    { staleTime: Infinity }
  );

  const { data: product, isLoading } = trpc.products.bySlug.useQuery(
    { slug: slug! },
    { staleTime: 1000 * 60 * 5 } // Cache for 5 minutes
  );
  const { data: categories } = trpc.categories.list.useQuery(undefined, { staleTime: 1000 * 60 * 60 });

  const categoryArray = (categories as any[]) || [];

  // Compute Cross-Navigation Categories (siblings or children)
  const { crossNavCategories, crossSellCategoryId, crossSellTitle, targetParentId } = useMemo(() => {
    const currentCat = categoryArray.find((c) => c.id === product?.categoryId);
    const targetParentId = currentCat?.parentId || currentCat?.id;
    
    const navCats = targetParentId 
      ? categoryArray.filter((c) => c.parentId === targetParentId && c.id !== currentCat?.id && c.active !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [];
      
    let sellId = product?.categoryId;
    let sellTitle = "Related Products";
    
    if (currentCat && (currentCat.slug.includes('laptop') || currentCat.slug.includes('desktop'))) {
      const accCat = categoryArray.find(c => c.slug.includes('access') || c.slug.includes('peripheral'));
      if (accCat) {
        sellId = accCat.id;
        sellTitle = "Recommended Accessories";
      }
    }
    
    return { crossNavCategories: navCats, crossSellCategoryId: sellId, crossSellTitle: sellTitle, targetParentId };
  }, [categoryArray, product?.categoryId]);

  const { data: relatedProducts } = trpc.products.list.useQuery(
    { categoryId: crossSellCategoryId, limit: 4 },
    { enabled: !!product && !!categories, staleTime: 1000 * 60 * 5 }
  );
  const { data: reviews, isLoading: loadingReviews } = trpc.products.reviews.useQuery(
    { productId: product?.id ?? 0 },
    { enabled: !!product, staleTime: 1000 * 60 * 5 }
  );

  const { data: wishlist } = trpc.wishlist.get.useQuery(undefined, { enabled: isAuthenticated });
  const isWishlisted = wishlist?.some(w => w.product.id === product?.id);
  const toggleWishlist = trpc.wishlist.toggle.useMutation({
    onSuccess: (data) => {
      utils.wishlist.get.invalidate();
      toast.success(data.added ? "Added to wishlist!" : "Removed from wishlist!");
    }
  });

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", body: "" });

  const upsertCart = trpc.cart.upsert.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      toast.success(`${product?.name} added to cart!`);
    },
    onError: () => toast.error("Failed to add to cart"),
  });

  const addReview = trpc.products.addReview.useMutation({
    onSuccess: () => {
      toast.success("Review submitted successfully!");
      setReviewForm({ rating: 5, title: "", body: "" });
      utils.products.reviews.invalidate({ productId: product?.id });
      utils.products.bySlug.invalidate({ slug: product?.slug });
    },
    onError: (err) => toast.error("Failed to submit review: " + err.message),
  });

  const submitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    addReview.mutate({
      productId: product.id,
      rating: reviewForm.rating,
      title: reviewForm.title,
      body: reviewForm.body,
    });
  };

  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  useEffect(() => {
    if (product) addRecentlyViewed(product);
    setRecentProducts(getRecentlyViewed().filter((p: any) => p.id !== product?.id));
  }, [product]);

  const images = product && Array.isArray(product.images) && product.images.length > 0 
    ? [...product.images] 
    : ["/assets/placeholder.png"];

  // --- SEO & Social Sharing ---
  useEffect(() => {
    if (!product) return;
    const storeName = settings?.general?.storeName || (typeof localStorage !== 'undefined' ? localStorage.getItem("store_name_cache") : null) || 'Store';
    document.title = `${product.name} | ${storeName}`;
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", product.shortDescription || product.description || `Buy ${product.name} at ${storeName}`);

    const ogTags = {
      "og:title": product.name,
      "og:description": product.shortDescription || product.description || "",
      "og:image": images[0],
      "og:url": window.location.href,
      "og:type": "product"
    };

    Object.entries(ogTags).forEach(([property, content]) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    });

    return () => { document.title = storeName; };
  }, [product, settings, images]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-8 flex-1">
          <div className="grid lg:grid-cols-2 gap-10">
            <Skeleton className="aspect-square rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center flex-1">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h2 className="font-display text-2xl font-bold mb-2">Product Not Found</h2>
          <p className="text-muted-foreground mb-6">The product you're looking for doesn't exist.</p>
          <Link href="/products">
            <Button className="bg-[var(--brand)] text-white hover:opacity-90">Browse Products</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const tags = (Array.isArray(product.tags) ? product.tags : []) as string[];
  const specs = (product.specifications as Record<string, string>) ?? {};
  const comparePrice = product.comparePrice ? parseFloat(product.comparePrice) : 0;
  const price = parseFloat(product.price);
  const discount = comparePrice > price ? Math.round((1 - price / comparePrice) * 100) : 0;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: product.shortDescription || `Check out ${product.name}`, url: window.location.href });
      } catch (err) { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    }
  };

  const handleAddToCart = () => {
    if (product.stock === 0) return;
    if (isAuthenticated) {
      upsertCart.mutate({ productId: product.id, quantity });
    } else {
      addToGuestCart(product, quantity);
      window.dispatchEvent(new Event("guestCartUpdated"));
      toast.success(`${product.name} added to cart!`);
    }
  };

  // --- Schema.org JSON-LD ---
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": images,
    "description": product.shortDescription || product.description || "",
    "sku": product.sku || product.id.toString(),
    "brand": {
      "@type": "Brand",
      "name": product.brand || settings?.general?.storeName || "Store"
    },
    "offers": {
      "@type": "Offer",
      "url": typeof window !== "undefined" ? window.location.href : "",
      "priceCurrency": settings?.general?.currency || "USD",
      "price": product.price,
      "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition"
    },
    ...(product.rating && parseFloat(product.rating) > 0 ? {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": product.rating,
        "reviewCount": product.reviewCount || 1
      }
    } : {})
  };

  return (
    <div className="min-h-screen flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      <div className="container py-6 flex-1">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/products" className="hover:text-foreground transition-colors">Products</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground truncate max-w-xs">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-10 mb-12">
          {/* Images */}
          <div className="space-y-3">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border">
              <img
                src={images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover"
                fetchPriority="high"
                decoding="async"
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImage((i) => (i - 1 + images.length) % images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-background transition-colors"
                    title="Previous image"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedImage((i) => (i + 1) % images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-background transition-colors"
                    title="Next image"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${
                      selectedImage === i ? "border-[var(--brand)]" : "border-border hover:border-[var(--brand)]/50"
                    }`}
                    title={`View image ${i + 1}`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                {product.brand && (
                  <p className="text-sm font-medium text-[var(--brand)] uppercase tracking-wide mb-1">{product.brand}</p>
                )}
                <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">{product.name}</h1>
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleShare} 
                className="shrink-0 rounded-full h-10 w-10 text-muted-foreground hover:text-foreground"
                title="Share product"
                aria-label="Share product"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Rating */}
            {product.rating && parseFloat(product.rating) > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= Math.round(parseFloat(product.rating!))
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">{product.rating}</span>
                <span className="text-sm text-muted-foreground">({product.reviewCount} reviews)</span>
              </div>
            )}

            {/* Price */}
            <div className="flex flex-col items-start gap-1">
              <span className="font-display text-3xl font-bold leading-none">{formatPrice(product.price)}</span>
              {product.comparePrice && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(product.comparePrice)}
                </span>
              )}
              {discount > 0 && (
                <span className="text-sm font-bold text-destructive">Save {discount}%</span>
              )}
            </div>

            {/* Short description */}
            {product.shortDescription && (
              <p className="text-muted-foreground leading-relaxed">{product.shortDescription}</p>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {tags.map((tag) => (
                  <Link key={tag} href={`/products?tag=${encodeURIComponent(tag)}`}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-[var(--brand)] hover:text-white transition-colors font-medium">#{tag}</Badge>
                  </Link>
                ))}
              </div>
            )}

            {/* Stock */}
            <div className="flex items-center gap-2">
              {product.stock > 0 ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600">
                    {product.stock <= 5 ? `Only ${product.stock} left in stock!` : "In Stock"}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">Out of Stock</span>
                </>
              )}
            </div>

            {/* Quantity & Add to Cart */}
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-input rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={quantity <= 1}
                  title="Decrease quantity"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center text-sm font-medium">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(Number(product.stock || 1), q + 1))}
                  className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={quantity >= Number(product.stock || 1)}
                  title="Increase quantity"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <Button
                onClick={handleAddToCart}
                disabled={product.stock === 0 || upsertCart.isPending}
                className="flex-1 bg-[var(--brand)] text-white hover:opacity-90 gap-2 h-10"
              >
                <ShoppingCart className="w-4 h-4" />
                {upsertCart.isPending ? "Adding..." : "Add to Cart"}
              </Button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {(settings?.general?.features || [
                { icon: "Truck", title: "Free Shipping", desc: settings?.shipping?.freeShippingThreshold ? `Orders over ${formatPrice(settings.shipping.freeShippingThreshold)}` : "Fast reliable delivery" },
                { icon: "Shield", title: "2-Year Warranty", desc: "Full coverage" },
                { icon: "Zap", title: "Fast Delivery", desc: "2–5 business days" },
              ]).slice(0, 3).map((b: any, idx: number) => {
                const Icon = dynamicIconMap[b.icon] || CheckCircle;
                return (
                  <Link key={idx} href={`/about#feature-${idx}`}>
                    <div className="text-center p-3 rounded-lg bg-muted/50 border border-border hover:border-[var(--brand)]/40 hover:shadow-sm transition-all cursor-pointer group h-full">
                      <Icon className="w-4 h-4 mx-auto mb-1 text-[var(--brand)] group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-medium group-hover:text-[var(--brand)] transition-colors">{b.title}</p>
                      <p className="text-[10px] text-muted-foreground">{b.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* SKU */}
            {product.sku && (
              <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
            )}
          </div>
        </div>

        {/* Tabs: Description, Specs, Reviews */}
        <Tabs defaultValue="description" className="mb-12">
          <TabsList className="mb-6 flex flex-wrap h-auto w-full justify-start md:w-fit">
            <TabsTrigger value="description">Description</TabsTrigger>
            {Object.keys(specs).length > 0 && <TabsTrigger value="specs">Specifications</TabsTrigger>}
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="description">
            <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
              {product.description ?? "No description available."}
            </div>
          </TabsContent>

          {Object.keys(specs).length > 0 && (
            <TabsContent value="specs">
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(specs).map(([key, value], i) => (
                      <tr key={key} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                        <td className="px-4 py-3 font-medium text-foreground w-1/3 border-r border-border">{key}</td>
                        <td className="px-4 py-3 text-muted-foreground">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          )}

          <TabsContent value="reviews">
            {isAuthenticated ? (
              <div className="bg-muted/30 border border-border rounded-xl p-5 mb-6">
                <h3 className="font-semibold mb-4">Write a Review</h3>
                <form onSubmit={submitReview} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Rating</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                          className="focus:outline-none"
                          title={`Rate ${star} stars`}
                          aria-label={`Rate ${star} stars`}
                        >
                          <Star className={`w-6 h-6 ${star <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-400/50"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Title</label>
                    <input
                      value={reviewForm.title}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                      placeholder="Brief summary of your review"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Review</label>
                    <textarea
                      value={reviewForm.body}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, body: e.target.value }))}
                      className="w-full p-3 text-sm rounded-md border border-input bg-background min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                      placeholder="What did you like or dislike?"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={addReview.isPending} className="bg-[var(--brand)] text-white hover:opacity-90 gap-2">
                    {addReview.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Submit Review
                  </Button>
                </form>
              </div>
            ) : (
              <div className="bg-muted/30 border border-border rounded-xl p-5 mb-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Log in to write a review for this product.</p>
                <Button variant="outline" size="sm" onClick={() => window.location.href = getLoginUrl(window.location.pathname)}>Log In</Button>
              </div>
            )}

            {loadingReviews ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" /></div>
            ) : reviews && reviews.length > 0 ? (
              <div className="space-y-4 mt-4">
                {reviews.map((r, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`w-3.5 h-3.5 ${star <= r.review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      <span className="font-medium text-sm">{r.user?.name || "Verified Customer"}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{new Date(r.review.createdAt).toLocaleDateString()}</span>
                    </div>
                    {r.review.title && <h4 className="font-semibold text-sm mb-1">{r.review.title}</h4>}
                    {r.review.body && <p className="text-sm text-muted-foreground">{r.review.body}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Star className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>No reviews yet. Be the first to review this product!</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Cross-Navigation: Other Subcategories */}
        {crossNavCategories.length > 0 && (
          <div className="mb-12">
            <h2 className="font-display text-xl font-bold mb-6">Explore More {categoryArray.find(c => c.id === targetParentId)?.name}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {crossNavCategories.slice(0, 4).map(subCat => (
                <Link key={subCat.id} href={`/products?category=${subCat.slug}`}>
                  <div className="group relative overflow-hidden rounded-xl border border-border bg-card hover:border-[var(--brand)]/40 hover:shadow-lg transition-all duration-300 cursor-pointer">
                    <div className="aspect-[16/9] sm:aspect-[2/1] bg-muted overflow-hidden flex items-center justify-center">
                      {subCat.imageUrl ? (
                        <img src={subCat.imageUrl} alt={subCat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" />
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

        {/* Related products */}
        {relatedProducts && relatedProducts.filter((p) => p.id !== product.id).length > 0 && (
          <div>
            <h2 className="font-display text-xl font-bold mb-6">{crossSellTitle}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {relatedProducts
                .filter((p) => p.id !== product.id)
                .slice(0, 4)
                .map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
            </div>
          </div>
        )}

        {/* Recently Viewed */}
        {recentProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="font-display text-xl font-bold mb-6 text-muted-foreground">Recently Viewed</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {recentProducts.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
