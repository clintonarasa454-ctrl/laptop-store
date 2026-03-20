import { useEffect, Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import About from "./pages/About";
import Cart from "./pages/Cart";
import CheckoutAuth from "./pages/CheckoutAuth";
import Auth from "./pages/Auth";
import VerifyEmail from "./pages/VerifyEmail";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import Dashboard from "./pages/Dashboard";
import PaypalReturn from "./pages/PaypalReturn";
import { trpc } from "@/lib/trpc";
import StoreLoader from "@/components/StoreLoader";

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminProducts = lazy(() => import("./pages/AdminProducts"));
const AdminBrands = lazy(() => import("./pages/AdminBrands"));
const AdminCategories = lazy(() => import("./pages/AdminCategories"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
const AdminCustomers = lazy(() => import("./pages/AdminCustomers"));
const AdminContent = lazy(() => import("./pages/AdminContent"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));

// Apply cached settings immediately to prevent flickering on load
if (typeof window !== "undefined") {
  const cachedStoreName = localStorage.getItem("nexus_store_name");
  if (cachedStoreName) {
    document.title = cachedStoreName;
  }
  
  const cachedFavicon = localStorage.getItem("nexus_favicon_url");
  if (cachedFavicon) {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = cachedFavicon;
  }
  
  const cachedPrimaryColor = localStorage.getItem("nexus_primary_color");
  if (cachedPrimaryColor) {
    document.documentElement.style.setProperty("--brand", cachedPrimaryColor);
  }
  
  const cachedPromoColor = localStorage.getItem("nexus_promo_banner_color");
  if (cachedPromoColor) {
    document.documentElement.style.setProperty("--promo-banner", cachedPromoColor);
  }
}

function GlobalSettings() {
  const { data: settings } = trpc.settings.public.useQuery({ keys: ["appearance", "general"] });

  useEffect(() => {
    // 1. Apply Primary Theme Color
    if (settings?.appearance?.primaryColor) {
      document.documentElement.style.setProperty("--brand", settings.appearance.primaryColor);
      localStorage.setItem("nexus_primary_color", settings.appearance.primaryColor);
    }
    if (settings?.appearance?.promoBannerColor) {
      document.documentElement.style.setProperty("--promo-banner", settings.appearance.promoBannerColor);
      localStorage.setItem("nexus_promo_banner_color", settings.appearance.promoBannerColor);
    }
    // 2. Apply Custom Favicon
    if (settings?.appearance?.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = settings.appearance.faviconUrl;
      localStorage.setItem("nexus_favicon_url", settings.appearance.faviconUrl);
    }
    // 3. Apply Browser Tab Title
    if (settings?.general?.storeName) {
      document.title = settings.general.storeName;
      localStorage.setItem("nexus_store_name", settings.general.storeName);
    }
    // 4. Cache Logo URL for UI components
    if (settings?.appearance?.logoUrl !== undefined) {
      if (settings.appearance.logoUrl) {
        localStorage.setItem("nexus_logo_url", settings.appearance.logoUrl);
      } else {
        localStorage.removeItem("nexus_logo_url");
      }
    }
    // 5. Apply Currency to Local Storage for the formatter
    if (settings?.general?.currency) {
      localStorage.setItem("nexus_currency", settings.general.currency);
    }
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
        <Route key="dashboard-order" path="/dashboard/:tab/:orderId" component={Dashboard} />
        <Route key="paypal-return" path="/paypal-return" component={PaypalReturn} />
        <Route key="admin-dashboard" path="/admin" component={AdminDashboard} />
        <Route key="admin-analytics" path="/admin/analytics" component={AdminAnalytics} />
        <Route key="admin-products" path="/admin/products" component={AdminProducts} />
        <Route key="admin-brands" path="/admin/brands" component={AdminBrands} />
        <Route key="admin-categories" path="/admin/categories" component={AdminCategories} />
        <Route key="admin-orders" path="/admin/orders" component={AdminOrders} />
        <Route key="admin-payments" path="/admin/payments" component={AdminPayments} />
        <Route key="admin-customers" path="/admin/customers" component={AdminCustomers} />
        <Route key="admin-content" path="/admin/content" component={AdminContent} />
        <Route key="admin-settings" path="/admin/settings" component={AdminSettings} />
        <Route key="not-found-404" path="/404" component={NotFound} />
        <Route key="not-found" component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <GlobalSettings />
          <PageTracker />
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
