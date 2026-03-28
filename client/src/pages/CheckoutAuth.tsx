import { useAuth } from "@/pages/useAuth";
import { getLoginUrl } from "@/const";
import { Lock, Package, ShieldCheck, User } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useCartSync } from "@/components/CartSyncContext";

export default function CheckoutAuth() {
  const { isAuthenticated, loading } = useAuth();
  const { isSyncing } = useCartSync();
  const [, navigate] = useLocation();

  useEffect(() => {
    // If authenticated and not syncing, proceed to checkout.
    // The AuthProvider handles the sync in the background.
    // We wait for `isSyncing` to be false to ensure a smooth transition
    // if a sync was in progress.
    if (!loading && isAuthenticated && !isSyncing) {
      navigate("/checkout", { replace: true });
    }
  }, [isAuthenticated, loading, isSyncing, navigate]);

  // Show a loading screen while auth state is loading, or if a cart sync is in progress.
  if (loading || (isAuthenticated && isSyncing)) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">
              {isSyncing ? "Syncing your cart..." : "Setting up your checkout..."}
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // If not loading and not authenticated, show the prompt page.
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-md mx-auto px-4">
          {/* Icon */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-[var(--brand)]" />
            </div>
            <h1 className="font-display text-2xl font-bold mb-2">Sign In to Continue</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              To complete your purchase and track your order delivery, please log in or create an account.
            </p>
          </div>

          {/* Benefits */}
          <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-3">
            <p className="text-sm font-semibold text-foreground">Why create an account?</p>
            {[
              { icon: Package, text: "Track your orders in real-time" },
              { icon: ShieldCheck, text: "Secure payment processing" },
              { icon: User, text: "Save addresses for faster checkout" },
            ].map((b) => (
              <div key={b.text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center shrink-0">
                  <b.icon className="w-3.5 h-3.5 text-[var(--brand)]" />
                </div>
                <span className="text-sm text-muted-foreground">{b.text}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              className="w-full bg-[var(--brand)] text-white hover:opacity-90 h-11 gap-2"
              onClick={() => (window.location.href = getLoginUrl("/checkout"))}
            >
              <User className="w-4 h-4" /> Sign In to Your Account
            </Button>
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => (window.location.href = getLoginUrl("/checkout", "register"))}
            >
              Create New Account
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => navigate("/cart")}
            >
              ← Back to Cart
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-border/50">
            <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={() => navigate("/checkout")}>
              Continue as Guest
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Your cart items are saved and will be waiting for you after sign-in.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
