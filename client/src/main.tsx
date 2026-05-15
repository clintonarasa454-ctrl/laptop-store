import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// ─── Preload cached assets immediately to prevent loading state ───
// This runs synchronously before React renders, avoiding the "box" loader
if (typeof document !== "undefined") {
  const cachedFavicon = localStorage.getItem("store_favicon_cache");
  if (cachedFavicon) {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = cachedFavicon;
  }

  const cachedStoreName = localStorage.getItem("store_name_cache");
  if (cachedStoreName) {
    document.title = cachedStoreName;
  }

  const cachedPrimaryColor = localStorage.getItem("store_primary_color");
  if (cachedPrimaryColor) {
    document.documentElement.style.setProperty("--brand", cachedPrimaryColor);
  }

  const cachedLogo = localStorage.getItem("store_logo_cache");
  if (cachedLogo) {
    const preloadLink = document.createElement("link");
    preloadLink.rel = "preload";
    preloadLink.as = "image";
    preloadLink.href = cachedLogo;
    document.head.appendChild(preloadLink);
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Cache data for 5 minutes globally
      gcTime: 1000 * 60 * 60, // Keep inactive data in memory for 1 hour
      refetchOnWindowFocus: false, // Don't refetch when switching tabs
      retry: 1, // Only retry failed requests once
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Check if the user was trying to access an admin or manager route
  if (window.location.pathname.startsWith('/manager') || window.location.pathname.startsWith('/admin')) {
    // Do not force a hard redirect for admin/manager routes. 
    // AdminLayout natively handles unauthenticated states and renders its own login UI.
    return;
  } else {
    window.location.href = getLoginUrl();
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      // @ts-ignore
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
