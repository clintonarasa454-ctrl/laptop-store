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
import { SettingsResponse } from "@shared/settingsTypes";
import { trpc } from "@/lib/trpc";
import StoreLoader from "@/components/StoreLoader";

const Home = lazy(() => import("./pages/Home"));
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
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminDrivers = lazy(() => import("./pages/AdminDrivers"));
const AdminVehicles = lazy(() => import("./pages/AdminVehicles"));
const AdminAssignments = lazy(() => import("./pages/AdminAssignments"));
const AdminContent = lazy(() => import("./pages/AdminContent"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminAI = lazy(() => import("./pages/AdminAI"));
const AdminWarehouses = lazy(() => import("./pages/AdminWarehouses"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const AdminAppeals = lazy(() => import("./pages/AdminAppeals"));
const AppealPage = lazy(() => import("./pages/AppealPage"));
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
  const { data: settingsData } = trpc.settings.public.useQuery({ keys: ["appearance", "general"] });
  const settings = settingsData as SettingsResponse;

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
      // Also store full general settings for exchange rate fetching logic
      localStorage.setItem("store_general_settings", JSON.stringify(settings.general));
      window.dispatchEvent(new Event("currencyUpdated"));
    }

    // 6. Fetch Live Exchange Rates (Base currency configured by admin)
    const fetchRates = async () => {
      try {
        // Get the admin-configured store currency
        const generalSettingsStr = localStorage.getItem("store_general_settings");
        const baseCurrency = generalSettingsStr
          ? JSON.parse(generalSettingsStr).currency || "KES"
          : "KES";

        const cachedTime = localStorage.getItem("store_exchange_time");
        const cachedCurrency = localStorage.getItem("store_exchange_base_currency");
        
        // Cache the rates for 24 hours, BUT invalidate immediately if the base currency changed
        if (cachedTime && cachedCurrency === baseCurrency && Date.now() - parseInt(cachedTime) < 86400000) return;

        // Fetch exchange rates using the admin-configured currency as base
        const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) {
          console.warn(`Exchange rates API returned ${res.status}: using cached rates if available`);
          return;
        }

        const data = await res.json();
        if (data?.rates && typeof data.rates === 'object') {
          localStorage.setItem("store_exchange_rates", JSON.stringify(data.rates));
          localStorage.setItem("store_exchange_time", Date.now().toString());
          localStorage.setItem("store_exchange_base_currency", baseCurrency);
          window.dispatchEvent(new Event("currencyUpdated"));
        } else {
          console.warn("Exchange rates API returned invalid data format");
        }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          console.warn("Exchange rates API request timeout (5s)");
        } else {
          console.warn("Failed to fetch exchange rates:", e);
        }
        // Gracefully continue - use cached rates if available
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
        <Route key="appeal" path="/appeal" component={AppealPage} />
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
        <Route key="manager-portal" path="/manager" component={AdminDashboard} />
        <Route key="admin-analytics" path="/admin/analytics" component={AdminAnalytics} />
        <Route key="admin-products" path="/admin/products" component={AdminProducts} />
        <Route key="admin-brands" path="/admin/brands" component={AdminBrands} />
        <Route key="admin-categories" path="/admin/categories" component={AdminCategories} />
        <Route key="admin-orders" path="/admin/orders" component={AdminOrders} />
        <Route key="admin-payments" path="/admin/payments" component={AdminPayments} />
        <Route key="admin-users" path="/admin/users" component={AdminUsers} />
        <Route key="admin-drivers" path="/admin/drivers" component={AdminDrivers} />
        <Route key="admin-vehicles" path="/admin/vehicles" component={AdminVehicles} />
        <Route key="admin-assignments" path="/admin/assignments" component={AdminAssignments} />
        <Route key="admin-content" path="/admin/content" component={AdminContent} />
        <Route key="admin-notifications" path="/admin/notifications" component={AdminNotifications} />
        <Route key="admin-settings" path="/admin/settings" component={AdminSettings} />
        <Route key="admin-appeals" path="/admin/appeals" component={AdminAppeals} />
        <Route key="admin-ai" path="/admin/ai" component={AdminAI} />
        <Route key="admin-warehouses" path="/admin/warehouses" component={AdminWarehouses} />

        {/* Manager routes - same components as admin */}
        <Route key="manager-analytics" path="/manager/analytics" component={AdminAnalytics} />
        <Route key="manager-products" path="/manager/products" component={AdminProducts} />
        <Route key="manager-brands" path="/manager/brands" component={AdminBrands} />
        <Route key="manager-categories" path="/manager/categories" component={AdminCategories} />
        <Route key="manager-orders" path="/manager/orders" component={AdminOrders} />
        <Route key="manager-payments" path="/manager/payments" component={AdminPayments} />
        <Route key="manager-users" path="/manager/users" component={AdminUsers} />
        <Route key="manager-drivers" path="/manager/drivers" component={AdminDrivers} />
        <Route key="manager-vehicles" path="/manager/vehicles" component={AdminVehicles} />
        <Route key="manager-assignments" path="/manager/assignments" component={AdminAssignments} />
        <Route key="manager-content" path="/manager/content" component={AdminContent} />
        <Route key="manager-notifications" path="/manager/notifications" component={AdminNotifications} />
        <Route key="manager-settings" path="/manager/settings" component={AdminSettings} />
        <Route key="manager-ai" path="/manager/ai" component={AdminAI} />
        <Route key="manager-warehouses" path="/manager/warehouses" component={AdminWarehouses} />
        
        {/* Catch-all for root level product slugs like /dell-g3 */}
        <Route key="product-detail-short" path="/:slug" component={ProductDetail} />
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
