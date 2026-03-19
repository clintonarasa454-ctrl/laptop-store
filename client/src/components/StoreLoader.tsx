import { trpc } from "@/lib/trpc";
import { Package } from "lucide-react";

interface StoreLoaderProps {
  fullScreen?: boolean;
}

export default function StoreLoader({ fullScreen = false }: StoreLoaderProps) {
  // Instantly fetches from cache since we set staleTime: Infinity globally for settings
  const { data: settings } = trpc.settings.public.useQuery({ keys: ["appearance"] });
  const logoUrl = settings?.appearance?.logoUrl;

  const LoaderContent = (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative w-20 h-20 flex items-center justify-center">
        {/* Outer spinning ring */}
        <div className="absolute inset-0 rounded-full border-4 border-muted border-t-[var(--brand)] animate-spin" />
        
        {/* Inner pulsing logo/icon */}
        <div className="animate-pulse flex items-center justify-center w-full h-full p-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Loading..." className="w-full h-full object-contain" />
          ) : (
            <Package className="w-8 h-8 text-[var(--brand)]" />
          )}
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse tracking-widest uppercase">
        Loading...
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        {LoaderContent}
      </div>
    );
  }

  return LoaderContent;
}