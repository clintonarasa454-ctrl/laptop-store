import { useEffect, Suspense, lazy } from "react";
import { flushSync } from "react-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartSyncProvider } from "@/components/CartSyncContext";
import { AuthProvider } from "@/pages/useAuth";
import { AIWorkflowProvider } from "@/contexts/AIWorkflowContext";
import Home from "./pages/Home";
import { trpc } from "@/lib/trpc";
import StoreLoader from "@/components/StoreLoader";

const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const About = lazy(() => import("./pages/About"));
const Cart = lazy(() => import("./pages/Cart"));
const CheckoutAuth = lazy(() => import("./pages/CheckoutAuth"));
const Auth = lazy(() => import("./pages/Auth"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const OrderTracking = lazy(() => import("./components/OrderTracking"));
const PaypalReturn = lazy(() => import("./pages/PaypalReturn"));

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminProducts = lazy(() => import("./pages/AdminProducts"));
const AdminBrands = lazy(() => import("./pages/AdminBrands"));
const AdminCategories = lazy(() => import("./pages/AdminCategories"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
const AdminCustomers = lazy(() => import("./pages/AdminCustomers"));
const AdminDrivers = lazy(() => import("./pages/AdminDrivers"));
const AdminContent = lazy(() => import("./pages/AdminContent"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminAI = lazy(() => import("./pages/AdminAI"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const CompareWidget = lazy(() => import("./components/CompareWidget"));

// Apply cached settings immediately to prevent flickering on load
if (typeof window !== "undefined") {
  const cachedStoreName = localStorage.getItem("store_name_cache");
  if (cachedStoreName) {
    document.title = cachedStoreName;
  }
  
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
  
  const cachedPrimaryColor = localStorage.getItem("store_primary_color");
  if (cachedPrimaryColor) {
    document.documentElement.style.setProperty("--brand", cachedPrimaryColor);
  }
  
  const cachedPromoColor = localStorage.getItem("store_promo_color");
  if (cachedPromoColor) {
    document.documentElement.style.setProperty("--promo-banner", cachedPromoColor);
  }

  const cachedStoreDesc = localStorage.getItem("store_description_cache");
  if (cachedStoreDesc) {
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", cachedStoreDesc);
  }
}

function GlobalSettings() {
  const { data: settings } = trpc.settings.public.useQuery({ keys: ["appearance", "general"] });

  useEffect(() => {
    // 1. Apply Primary Theme Color
    if (settings?.appearance?.primaryColor) {
      document.documentElement.style.setProperty("--brand", settings.appearance.primaryColor);
      localStorage.setItem("store_primary_color", settings.appearance.primaryColor);
    }
    if (settings?.appearance?.promoBannerColor) {
      document.documentElement.style.setProperty("--promo-banner", settings.appearance.promoBannerColor);
      localStorage.setItem("store_promo_color", settings.appearance.promoBannerColor);
    }
    // 2. Apply Custom Favicon
    if (settings?.appearance?.faviconUrl !== undefined) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      if (settings.appearance.faviconUrl) {
        link.href = settings.appearance.faviconUrl;
        localStorage.setItem("store_favicon_cache", settings.appearance.faviconUrl);
      } else {
        link.href = "/favicon.ico";
        localStorage.removeItem("store_favicon_cache");
      }
    }
    // 3. Apply Browser Tab Title
    if (settings?.general?.storeName) {
      document.title = settings.general.storeName;
      localStorage.setItem("store_name_cache", settings.general.storeName);
    }
    // 4. Cache Store Description for SEO
    if (settings?.general?.storeDescription) {
      localStorage.setItem("store_description_cache", settings.general.storeDescription);
    }
    // 4. Cache Logo URL for UI components
    if (settings?.appearance?.logoUrl !== undefined) {
      if (settings.appearance.logoUrl) {
        localStorage.setItem("store_logo_cache", settings.appearance.logoUrl);
      } else {
        localStorage.removeItem("store_logo_cache");
      }
    }
    // 5. Apply Currency to Local Storage for the formatter
    if (settings?.general?.currency) {
      localStorage.setItem("store_currency", settings.general.currency);
      window.dispatchEvent(new Event("currencyUpdated"));
    }

    // 6. Fetch Live Exchange Rates (Base USD)
    const fetchRates = async () => {
      try {
        const cachedTime = localStorage.getItem("store_exchange_time");
        // Cache the rates for 24 hours so we don't spam the API and slow down load times
        if (cachedTime && Date.now() - parseInt(cachedTime) < 86400000) return; 
        const res = await fetch("https://open.er-api.com/v6/latest/KES");
        const data = await res.json();
        if (data?.rates) {
          localStorage.setItem("store_exchange_rates", JSON.stringify(data.rates));
          localStorage.setItem("store_exchange_time", Date.now().toString());
          window.dispatchEvent(new Event("currencyUpdated"));
        }
      } catch (e) {
        console.error("Failed to fetch exchange rates:", e);
      }
    };
    fetchRates();
  }, [settings]);

  return null;
}

function PageTracker() {
  const [location] = useLocation();
  const track = trpc.store.trackPageView.useMutation();
  useEffect(() => {
    track.mutate({ path: location });
  }, [location]);
  return null;
}

function Router() {
  return (
    <Suspense fallback={<StoreLoader fullScreen />}>
      <Switch>
        <Route key="home" path="/" component={Home} />
        <Route key="products" path="/products" component={Products} />
        <Route key="product-detail" path="/products/:slug" component={ProductDetail} />
        <Route key="about" path="/about" component={About} />
        <Route key="cart" path="/cart" component={Cart} />
        <Route key="checkout-auth" path="/checkout/auth" component={CheckoutAuth} />
        <Route key="auth" path="/auth" component={Auth} />
        <Route key="verify-email" path="/verify-email" component={VerifyEmail} />
        <Route key="checkout" path="/checkout" component={Checkout} />
        <Route key="order-confirmation" path="/order-confirmation/:orderNumber" component={OrderConfirmation} />
        <Route key="dashboard" path="/dashboard/:tab?" component={Dashboard} />
        <Route key="track-order-form" path="/track-order" component={OrderTracking} />
        <Route key="track-order-result" path="/track-order/:orderNumber" component={OrderTracking} />
        <Route key="dashboard-order" path="/dashboard/:tab/:orderId" component={Dashboard} />
        <Route key="paypal-return" path="/paypal-return" component={PaypalReturn} />
        <Route key="driver-dashboard" path="/driver-portal" component={DriverDashboard} />
        <Route key="admin-dashboard" path="/admin" component={AdminDashboard} />
        <Route key="admin-analytics" path="/admin/analytics" component={AdminAnalytics} />
        <Route key="admin-products" path="/admin/products" component={AdminProducts} />
        <Route key="admin-brands" path="/admin/brands" component={AdminBrands} />
        <Route key="admin-categories" path="/admin/categories" component={AdminCategories} />
        <Route key="admin-orders" path="/admin/orders" component={AdminOrders} />
        <Route key="admin-payments" path="/admin/payments" component={AdminPayments} />
        <Route key="admin-customers" path="/admin/customers" component={AdminCustomers} />
        <Route key="admin-drivers" path="/admin/drivers" component={AdminDrivers} />
        <Route key="admin-content" path="/admin/content" component={AdminContent} />
        <Route key="admin-notifications" path="/admin/notifications" component={AdminNotifications} />
        <Route key="admin-settings" path="/admin/settings" component={AdminSettings} />
        <Route key="admin-ai" path="/admin/ai" component={AdminAI} />
        <Route key="not-found-404" path="/404" component={NotFound} />
        <Route key="not-found" component={NotFound} />
      </Switch>
      <CompareWidget />
    </Suspense>
  );
}

const aroundNav = (navigate: any, to: string, options: any) => {
  if (!document.startViewTransition || !options?.transition) {
    navigate(to, options);
    return;
  }
  document.startViewTransition(() => {
    flushSync(() => {
      navigate(to, options);
    });
  });
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <AIWorkflowProvider>
              <WouterRouter>
                <GlobalSettings />
                <PageTracker />
                <Toaster />
                <Router />
              </WouterRouter>
            </AIWorkflowProvider>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
