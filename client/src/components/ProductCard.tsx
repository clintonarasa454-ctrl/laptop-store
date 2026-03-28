import { useAuth } from "@/pages/useAuth";
import { trpc } from "@/lib/trpc";
import { addToGuestCart, formatPrice } from "@/lib/cart";
import { ShoppingCart, Star, Zap, Scale } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { toggleCompare, getCompareList } from "@/lib/ux";

interface Product {
  id: number;
  name: string;
  slug: string;
  price: string;
  comparePrice?: string | null;
  images: unknown;
  rating?: string | null;
  reviewCount?: number | null;
  brand?: string | null;
  stock: number;
  featured?: boolean | null;
  shortDescription?: string | null;
  tags?: unknown;
}

interface ProductCardProps {
  product: Product;
  onCartUpdate?: () => void;
}

export default function ProductCard({ product, onCartUpdate }: ProductCardProps) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const upsertCart = trpc.cart.upsert.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      toast.success("Added to cart!");
      onCartUpdate?.();
    },
    onError: () => toast.error("Failed to add to cart"),
  });

  const { data: wishlist } = trpc.wishlist.get.useQuery(undefined, { enabled: isAuthenticated });
  const isWishlisted = wishlist?.some(w => w.product.id === product.id);
  const toggleWishlist = trpc.wishlist.toggle.useMutation({
    onSuccess: (data) => {
      utils.wishlist.get.invalidate();
      toast.success(data.added ? "Added to wishlist" : "Removed from wishlist");
    }
  });

  const [isComparing, setIsComparing] = useState(false);
  useEffect(() => {
    const check = () => setIsComparing(!!getCompareList().find((p: any) => p.id === product.id));
    check();
    window.addEventListener("compareUpdated", check);
    return () => window.removeEventListener("compareUpdated", check);
  }, [product.id]);

  const images = (product.images as string[]) ?? [];
  const image = images[0] ?? "/assets/placeholder.png";
  const tags = (Array.isArray(product.tags) ? product.tags : []) as string[];
  const comparePrice = product.comparePrice ? parseFloat(product.comparePrice) : 0;
  const price = parseFloat(product.price);
  const discount = comparePrice > price ? Math.round((1 - price / comparePrice) * 100) : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock === 0) return;
    if (isAuthenticated) {
      upsertCart.mutate({ productId: product.id, quantity: 1 });
    } else {
      addToGuestCart(product, 1);
      window.dispatchEvent(new Event("guestCartUpdated"));
      toast.success("Added to cart!");
      onCartUpdate?.();
    }
  };

  return (
    <Link href={`/products/${product.slug}`}>
      <div 
        className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 hover:border-[var(--brand)]/40 transition-all duration-300 cursor-pointer h-full flex flex-col"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}
        onMouseEnter={() => utils.products.bySlug.prefetch({ slug: product.slug })}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1.5">
            {product.featured && (
              <Badge className="bg-[var(--brand)] text-white text-[10px] px-1.5 py-0.5 gap-0.5">
                <Zap className="w-2.5 h-2.5" /> Featured
              </Badge>
            )}
            {discount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                -{discount}%
              </Badge>
            )}
          </div>
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <span className="text-sm font-medium text-muted-foreground">Out of Stock</span>
            </div>
          )}
          
          {/* Compare Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const added = toggleCompare(product);
              if (added === false && !isComparing) {
                toast.error("You can only compare up to 4 products at once.");
              } else if (added) {
                toast.success("Added to comparison");
              }
            }}
            className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-md border transition-all z-10 ${
              isComparing 
                ? "bg-[var(--brand)] border-[var(--brand)] text-white shadow-md" 
                : "bg-background/80 border-border text-muted-foreground hover:text-foreground hover:bg-background"
            }`}
            title={isComparing ? "Remove from Compare" : "Compare Product"}
          >
            <Scale className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1 gap-2">
          {product.brand && (
            <p className="text-xs text-[var(--brand)] font-medium uppercase tracking-wide">{product.brand}</p>
          )}
          <h3 className="font-display font-semibold text-sm leading-snug line-clamp-2 group-hover:text-[var(--brand)] transition-colors">
            {product.name}
          </h3>
          {product.shortDescription && (
            <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{product.shortDescription}</p>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground/80 font-medium whitespace-nowrap">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Rating */}
          {product.rating && parseFloat(product.rating) > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-3 h-3 ${
                      star <= Math.round(parseFloat(product.rating!))
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">({product.reviewCount ?? 0})</span>
            </div>
          )}

          {/* Price & Cart */}
          <div className="flex items-end justify-between mt-auto pt-2 gap-2">
            <div className="flex flex-col items-start gap-0.5">
              <span className="font-display font-bold text-base leading-none">{formatPrice(product.price)}</span>
              {product.comparePrice && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(product.comparePrice)}
                </span>
              )}
              {discount > 0 && (
                <span className="text-[10px] font-bold text-destructive tracking-wide">Save {discount}%</span>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleAddToCart}
              disabled={product.stock === 0 || upsertCart.isPending}
              className="bg-[var(--brand)] text-white hover:opacity-90 h-8 px-3 gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span className="text-xs">Add</span>
            </Button>
          </div>

          {/* Stock indicator */}
          {product.stock > 0 && product.stock <= 5 && (
            <p className="text-[10px] text-orange-500 font-medium">Only {product.stock} left!</p>
          )}
        </div>
      </div>
    </Link>
  );
}
