import { useState, useEffect } from "react";
import { Loader2, Package } from "lucide-react";

interface StoreLoaderProps {
  fullScreen?: boolean;
}

export default function StoreLoader({ fullScreen = false }: StoreLoaderProps) {
  // Read logo synchronously from localStorage — no API call needed in a loading spinner
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    try {
      return localStorage?.getItem("store_logo_cache") ?? null;
    } catch {
      return null;
    }
  });

  // If localStorage wasn't available on first render (SSR-like environments), 
  // check again after mount and fetch from API as fallback for first-time visitors
  useEffect(() => {
    if (!logoUrl) {
      const cached = localStorage?.getItem("store_logo_cache");
      if (cached) {
        setLogoUrl(cached);
      } else {
        // Fallback: Fetch settings from public endpoint for first-time visitors
        // This ensures the custom logo appears even before the main app loads
        const input = encodeURIComponent(JSON.stringify({ keys: ["appearance"] }));
        fetch(`/api/trpc/settings.public?input=${input}`)
          .then(res => res.json())
          .then(data => {
            if (data?.appearance?.logoUrl) {
              setLogoUrl(data.appearance.logoUrl);
              // Cache it for future loads
              try {
                localStorage.setItem("store_logo_cache", data.appearance.logoUrl);
              } catch {}
            }
          })
          .catch(() => {
            // Silently fail - will just show the fallback icon
          });
      }
    }
  }, [logoUrl]);

  return (
    <div className={`flex flex-col items-center justify-center bg-background z-50 ${fullScreen ? "fixed inset-0 h-screen w-screen" : "h-full w-full min-h-[200px]"}`}>
      {logoUrl ? (
        <img src={logoUrl} alt="Loading..." className="h-16 w-auto animate-pulse object-contain" />
      ) : (
        <Package className="h-12 w-12 text-[var(--brand)] animate-pulse" />
      )}
      <div className="flex items-center gap-2 mt-6 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm font-medium tracking-wide">Loading...</span>
      </div>
    </div>
  );
}