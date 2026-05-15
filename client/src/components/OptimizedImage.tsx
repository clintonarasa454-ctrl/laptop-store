import React, { useState, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
  onLoad?: () => void;
  priority?: boolean;
}

/**
 * OptimizedImage Component
 * 
 * Features:
 * - Lazy loading for images outside viewport
 * - Responsive image resizing
 * - Blur placeholder while loading
 * - Image preload detection
 * 
 * Usage:
 * <OptimizedImage 
 *   src="/images/product.jpg" 
 *   alt="Product" 
 *   width={400}
 *   height={500}
 *   className="w-full h-auto"
 * />
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = "w-full h-auto",
  placeholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  onLoad,
  priority = false,
}: OptimizedImageProps) {
  // If it's a priority image (like a banner), bypass the initial opacity-0 state to prevent fade-in delays
  const [isLoaded, setIsLoaded] = useState(priority);
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  // Intersection Observer for lazy loading
  const [isVisible, setIsVisible] = useState(priority);
  const ref = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (ref.current?.complete) {
      setIsLoaded(true);
    }

    if (priority) return;
    if (!ref.current) return;

    // Check if browser supports Intersection Observer
    if (!('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' } // Load images 300px before they're in viewport
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    // Try alternative CDN or fallback on error
    const fallbackSrc = src.replace('cdn.', 'backup-cdn.');
    if (fallbackSrc !== imgSrc) {
      setImgSrc(fallbackSrc);
    }
  };

  return (
    <div className="overflow-hidden relative bg-gray-100">
      <img
        ref={ref}
        src={isVisible ? imgSrc : placeholder}
        alt={alt}
        width={width}
        height={height}
        className={`${className} transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        decoding="async"
      />
      
      {/* Loading skeleton with pulse animation while image is loading */}
      {!isLoaded && isVisible && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
      )}
      
      {/* Error fallback */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-gray-400 text-xs">Image unavailable</div>
        </div>
      )}
    </div>
  );
}

/**
 * Responsive Image Container
 * 
 * Optimized for different screen sizes:
 * - Mobile: Small optimized image
 * - Tablet: Medium image  
 * - Desktop: Full size
 * 
 * Usage:
 * <ResponsiveProductImage 
 *   src="/products/laptop"
 *   alt="Laptop Pro"
 * />
 */
export function ResponsiveProductImage({
  src,
  alt,
  className = '',
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  // Generate sizes for responsive delivery
  const sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";
  
  // Image variants for different screen sizes
  const srcSet = `
    ${src}?w=300&h=300&fit=crop 300w,
    ${src}?w=600&h=600&fit=crop 600w,
    ${src}?w=1200&h=1200&fit=crop 1200w
  `;

  return (
    <picture>
      <source media="(max-width: 640px)" srcSet={`${src}?w=400&h=400&fit=crop&fm=webp`} type="image/webp" />
      <source media="(max-width: 1024px)" srcSet={`${src}?w=600&h=600&fit=crop&fm=webp`} type="image/webp" />
      <source srcSet={`${src}?w=800&h=800&fit=crop&fm=webp`} type="image/webp" />
      
      <OptimizedImage
        src={src}
        alt={alt}
        className={`w-full h-auto object-cover ${className}`}
        priority={priority}
      />
    </picture>
  );
}

export default OptimizedImage;
