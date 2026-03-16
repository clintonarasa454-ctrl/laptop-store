import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { clearGuestCart, getGuestCart } from "@/lib/cart";
import { Lock, Package, ShieldCheck, User } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

export default function CheckoutAuth() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const syncCart = trpc.cart.syncFromGuest.useMutation({
    onSuccess: () => {
      clearGuestCart();
      utils.cart.get.invalidate();
      navigate("/checkout");
    },
  });

  useEffect(() => {
    if (!loading && isAuthenticated) {
      // User just logged in — sync guest cart then proceed
      const guestCart = getGuestCart();
      if (guestCart.length > 0) {
        syncCart.mutate(guestCart);
      } else {
        navigate("/checkout");
      }
    }
  }, [isAuthenticated, loading]);

  if (loading || syncCart.isPending) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Setting up your checkout...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

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
              onClick={() => (window.location.href = getLoginUrl("/checkout"))}
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

          <p className="text-xs text-center text-muted-foreground mt-4">
            Your cart items are saved and will be waiting for you after sign-in.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
