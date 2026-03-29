import { useAuth } from "@/pages/useAuth";
import { trpc } from "@/lib/trpc";
import { formatPrice, clearGuestCart, getGuestCart } from "@/lib/cart";
import {
  Check,
  ChevronRight,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  Smartphone,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { KENYA_COUNTIES } from "@/lib/kenya-locations";

type Step = "shipping" | "review" | "payment";
type PaymentMethod = "mpesa" | "paypal" | "stripe";

interface ShippingForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  county: string;
  city: string;
  postalCode: string;
  country: string;
  saveAddress: boolean;
}

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: "shipping", label: "Shipping", icon: MapPin },
  { id: "review", label: "Review", icon: Package },
  { id: "payment", label: "Payment", icon: CreditCard },
];

const CITIES_BY_COUNTRY: Record<string, string[]> = {
  "United States": ["New York", "Los Angeles", "Chicago", "Houston", "Miami", "Other"],
  "Kenya": ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Other"],
  "United Kingdom": ["London", "Manchester", "Birmingham", "Edinburgh", "Glasgow", "Other"],
  "Canada": ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Other"],
  "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Other"],
  "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth", "Other"],
  "Nigeria": ["Lagos", "Abuja", "Kano", "Ibadan", "Port Harcourt", "Other"],
  "Germany": ["Berlin", "Munich", "Frankfurt", "Hamburg", "Cologne", "Other"],
  "France": ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Other"],
};

export default function Checkout() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<Step>("shipping");
  const [shipping, setShipping] = useState<ShippingForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
  county: "",
    city: "",
    postalCode: "",
    country: "United States",
    saveAddress: false,
  });

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length === 0) return "";
    const cc = numbers.slice(0, 1);
    const area = numbers.slice(1, 4);
    const prefix = numbers.slice(4, 7);
    const line = numbers.slice(7, 11);
    let res = `+${cc}`;
    if (numbers.length > 1) res += ` (${area}`;
    if (numbers.length > 4) res += `) ${prefix}`;
    if (numbers.length > 7) res += `-${line}`;
    return res;
  };

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  
  const [isExpress, setIsExpress] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{code: string, amount: number} | null>(null);

  const { data: cartItems, isLoading: cartLoading } = trpc.cart.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: savedAddresses } = trpc.addresses.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: settings } = trpc.settings.public.useQuery(
    { keys: ["payment_methods", "shipping", "general"] },
    { staleTime: Infinity }
  );
  const activePaymentMethods = settings?.payment_methods || { mpesa: true, paypal: true, stripe: true };
  
  const availableMethods = [
    { id: "stripe" as PaymentMethod, label: "Credit / Debit Card", sub: "Visa, Mastercard, Amex", icon: CreditCard },
    { id: "mpesa" as PaymentMethod, label: "M-Pesa", sub: "Mobile money payment", icon: Smartphone },
    { id: "paypal" as PaymentMethod, label: "PayPal", sub: "Pay with your PayPal account", icon: Package },
  ].filter((method) => activePaymentMethods[method.id] !== false);

  const placeOrder = trpc.checkout.placeOrder.useMutation({
    onSuccess: (data) => {
      setOrderId(data.orderId);
      setOrderNumber(data.orderNumber);
      setStep("payment");
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (availableMethods.length > 0 && !availableMethods.find((m) => m.id === paymentMethod)) {
      setPaymentMethod(availableMethods[0].id);
    }
  }, [activePaymentMethods, paymentMethod, availableMethods]);

  if (authLoading || cartLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center py-20">
          <div>
            <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <h2 className="font-display text-xl font-bold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-4">Add some products before checking out.</p>
            <Button onClick={() => navigate("/products")} className="bg-[var(--brand)] text-white hover:opacity-90">
              Browse Products
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const freeThreshold = settings?.shipping?.freeShippingThreshold ? parseFloat(settings.shipping.freeShippingThreshold) : 50000;
  const standardFee = settings?.shipping?.standardFee ? parseFloat(settings.shipping.standardFee) : 50;
  const expressFee = settings?.shipping?.expressDelivery ? parseFloat(settings.shipping.expressDelivery) : 100;

  const subtotal = cartItems.reduce((s, i) => s + parseFloat(i.product.price) * i.quantity, 0);
  const baseShipping = subtotal >= freeThreshold ? 0 : standardFee;
  const shippingCost = isExpress ? expressFee : baseShipping;
  const discountAmount = appliedDiscount ? subtotal * 0.1 : 0; // 10% discount logic
  const total = Math.max(0, subtotal + shippingCost - discountAmount);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipping.firstName || !shipping.lastName || (!isAuthenticated && !shipping.email) || !shipping.phone || !shipping.address || !shipping.city || !shipping.country) {
      toast.error("Please fill in all required fields");
      return;
    }
    setStep("review");
  };

  const handlePlaceOrder = () => {
    placeOrder.mutate({
      shippingFullName: `${shipping.firstName} ${shipping.lastName}`.trim(),
      shippingPhone: shipping.phone,
      shippingAddress: shipping.address,
      shippingCounty: shipping.country === "Kenya" ? shipping.county : undefined,
      shippingCity: shipping.city,
      shippingPostalCode: shipping.postalCode || undefined,
      shippingCountry: shipping.country,
      shippingEmail: isAuthenticated ? undefined : shipping.email,
      guestCartItems: isAuthenticated ? undefined : getGuestCart(),
      paymentMethod,
      isExpress,
      discountCode: appliedDiscount?.code,
      saveAddress: shipping.saveAddress,
    });
  };

  const loadAddress = (addr: typeof savedAddresses extends (infer T)[] | undefined ? T : never) => {
    if (!addr) return;
    const parts = addr.fullName.split(" ");
    setShipping((s) => ({
      ...s,
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
      phone: addr.phone,
      county: (addr as any).county || "",
      address: addr.addressLine,
      city: addr.city,
      postalCode: addr.postalCode ?? "",
      country: addr.country,
    }));
  };

  const availableCities = CITIES_BY_COUNTRY[shipping.country] || [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="container py-8 flex-1">
        {/* Step indicator */}
        <div className="flex items-center justify-center mb-10">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center gap-2 ${i <= stepIndex ? "text-[var(--brand)]" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                  i < stepIndex
                    ? "bg-[var(--brand)] border-[var(--brand)] text-white"
                    : i === stepIndex
                    ? "border-[var(--brand)] text-[var(--brand)]"
                    : "border-border text-muted-foreground"
                }`}>
                  {i < stepIndex ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className="hidden sm:block text-sm font-medium">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 sm:w-20 h-0.5 mx-2 transition-colors ${i < stepIndex ? "bg-[var(--brand)]" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Step 1: Shipping */}
            {step === "shipping" && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="font-display text-lg font-bold mb-5 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[var(--brand)]" /> Shipping Information
                </h2>

                {/* Saved addresses */}
                {savedAddresses && savedAddresses.length > 0 && (
                  <div className="mb-5">
                    <p className="text-sm font-medium mb-2">Saved Addresses</p>
                    <div className="space-y-2">
                      {savedAddresses.map((addr) => (
                        <button
                          key={addr.id}
                          onClick={() => loadAddress(addr)}
                          className="w-full text-left p-3 rounded-lg border border-border hover:border-[var(--brand)]/50 hover:bg-[var(--brand)]/5 transition-colors text-sm"
                        >
                          <p className="font-medium">{addr.fullName}</p>
                          <p className="text-muted-foreground text-xs">{addr.addressLine}, {addr.city}, {addr.country}</p>
                        </button>
                      ))}
                    </div>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-card px-3 text-xs text-muted-foreground">or enter new address</span>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleShippingSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={shipping.firstName}
                        onChange={(e) => setShipping((s) => ({ ...s, firstName: e.target.value }))}
                        placeholder="First Name"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={shipping.lastName}
                        onChange={(e) => setShipping((s) => ({ ...s, lastName: e.target.value }))}
                        placeholder="Last Name"
                        required
                      />
                    </div>
                  </div>

                  {!isAuthenticated && (
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={shipping.email}
                        onChange={(e) => setShipping((s) => ({ ...s, email: e.target.value }))}
                        placeholder="For order receipts and tracking"
                        required
                      />
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        value={shipping.phone}
                        onChange={(e) => setShipping((s) => ({ ...s, phone: formatPhone(e.target.value) }))}
                        placeholder="e.g. +1 (555) 123-4567"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="address">Delivery Address *</Label>
                      <Input
                        id="address"
                        value={shipping.address}
                        onChange={(e) => setShipping((s) => ({ ...s, address: e.target.value }))}
                        placeholder="e.g. 123 Business Parkway, Suite 200"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="country">Country *</Label>
                      <Select
                        value={shipping.country}
                        onValueChange={(val) => setShipping((s) => ({ ...s, country: val, county: "", city: "" }))}
                      >
                        <SelectTrigger id="country"><SelectValue placeholder="Select country" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Kenya">Kenya</SelectItem>
                          <SelectItem value="United States">United States</SelectItem>
                          <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                          <SelectItem value="Canada">Canada</SelectItem>
                          <SelectItem value="Australia">Australia</SelectItem>
                          <SelectItem value="South Africa">South Africa</SelectItem>
                          <SelectItem value="Nigeria">Nigeria</SelectItem>
                          <SelectItem value="Germany">Germany</SelectItem>
                          <SelectItem value="France">France</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {shipping.country === "Kenya" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="county">County *</Label>
                        <Select value={shipping.county} onValueChange={(val) => setShipping((s) => ({ ...s, county: val, city: "" }))} required>
                          <SelectTrigger id="county"><SelectValue placeholder="Select county" /></SelectTrigger>
                          <SelectContent>
                            {Object.keys(KENYA_COUNTIES).sort().map((county) => (
                              <SelectItem key={county} value={county}>{county}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="city">City / Town *</Label>
                      {shipping.country === "Kenya" && shipping.county && KENYA_COUNTIES[shipping.county] ? (
                        <Select value={shipping.city} onValueChange={(val) => setShipping((s) => ({ ...s, city: val }))} required>
                          <SelectTrigger id="city"><SelectValue placeholder="Select city/town" /></SelectTrigger>
                          <SelectContent>
                            {KENYA_COUNTIES[shipping.county].map((city) => (
                              <SelectItem key={city} value={city}>{city}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input id="city" value={shipping.city} onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))} placeholder="e.g. Westlands" required />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        value={shipping.postalCode}
                        onChange={(e) => setShipping((s) => ({ ...s, postalCode: e.target.value }))}
                        placeholder="10001"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shipping.saveAddress}
                      onChange={(e) => setShipping((s) => ({ ...s, saveAddress: e.target.checked }))}
                      className="rounded border-input"
                    />
                    <span className="text-sm text-muted-foreground">Save this address for future orders</span>
                  </label>

                  <Button type="submit" className="w-full bg-[var(--brand)] text-white hover:opacity-90 gap-2 mt-2">
                    Continue to Review <ChevronRight className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            )}

            {/* Step 2: Review */}
            {step === "review" && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="font-display text-lg font-bold mb-5 flex items-center gap-2">
                  <Package className="w-5 h-5 text-[var(--brand)]" /> Order Review
                </h2>

                {/* Shipping summary */}
                <div className="bg-muted/40 rounded-lg p-4 mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">Shipping To</p>
                    <button onClick={() => setStep("shipping")} className="text-xs text-[var(--brand)] hover:underline">Edit</button>
                  </div>
                  <p className="text-sm">{shipping.firstName} {shipping.lastName}</p>
                  <p className="text-sm text-muted-foreground">{shipping.address}, {shipping.city}{shipping.postalCode ? `, ${shipping.postalCode}` : ""}, {shipping.country}</p>
                  <p className="text-sm text-muted-foreground">{shipping.phone}</p>
                </div>

                {/* Items */}
                <div className="space-y-3 mb-5">
                  {cartItems.map((item) => {
                    const images = (item.product.images as string[]) ?? [];
                    return (
                      <div key={item.productId} className="flex gap-3 items-center">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                          <img
                            src={images[0] ?? "/assets/placeholder.png"}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-semibold shrink-0">
                          {formatPrice(parseFloat(item.product.price) * item.quantity)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Express Delivery Toggle */}
                <div className="mb-6 p-4 border border-[var(--brand)]/30 rounded-xl bg-[var(--brand)]/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5 text-[var(--brand)]" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Express Delivery</p>
                      <p className="text-xs text-muted-foreground">
                        Get your order faster for {formatPrice(expressFee)}
                      </p>
                    </div>
                  </div>
                  <Switch checked={isExpress} onCheckedChange={setIsExpress} />
                </div>

                {/* Payment method selection */}
                <div className="mb-5">
                  <p className="text-sm font-semibold mb-3">Select Payment Method</p>
                  <div className="grid gap-2">
                  {availableMethods.map((method) => (
                      <label
                        key={method.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          paymentMethod === method.id ? "border-[var(--brand)] bg-[var(--brand)]/5" : "border-border hover:border-[var(--brand)]/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value={method.id}
                          checked={paymentMethod === method.id}
                          onChange={() => setPaymentMethod(method.id)}
                          className="sr-only"
                        />
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${paymentMethod === method.id ? "bg-[var(--brand)]/10" : "bg-muted"}`}>
                          <method.icon className={`w-4 h-4 ${paymentMethod === method.id ? "text-[var(--brand)]" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{method.label}</p>
                          <p className="text-xs text-muted-foreground">{method.sub}</p>
                        </div>
                        {paymentMethod === method.id && (
                          <Check className="w-4 h-4 text-[var(--brand)] ml-auto" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("shipping")} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={handlePlaceOrder}
                    disabled={placeOrder.isPending}
                    className="flex-1 bg-[var(--brand)] text-white hover:opacity-90 gap-2"
                  >
                    {placeOrder.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Placing Order...</>
                    ) : (
                      <>Place Order <ChevronRight className="w-4 h-4" /></>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === "payment" && orderId && orderNumber && (
              <PaymentStep
                orderId={orderId}
                orderNumber={orderNumber}
                paymentMethod={paymentMethod}
                total={total}
                shippingPhone={shipping.phone}
                onSuccess={() => {
                  clearGuestCart();
                  utils.cart.get.invalidate();
                  navigate(`/order-confirmation/${orderNumber}`);
                }}
              />
            )}
          </div>

          {/* Order summary sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-display font-semibold text-sm">Order Summary</h3>
              <div className="space-y-2 text-sm">
                {cartItems.map((item) => (
                  <div key={item.productId} className="flex justify-between">
                    <span className="text-muted-foreground truncate mr-2">{item.product.name} ×{item.quantity}</span>
                    <span className="font-medium shrink-0">{formatPrice(parseFloat(item.product.price) * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className={shippingCost === 0 ? "text-green-600" : ""}>{shippingCost === 0 ? "Free" : formatPrice(shippingCost)}</span>
                  </div>
                  {appliedDiscount && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Discount ({appliedDiscount.code})</span>
                      <span>-{formatPrice(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-display font-bold text-base pt-1 border-t border-border">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>
              </div>

              {/* Discount Code Input */}
              <div className="border-t border-border pt-4 mt-4">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Promo code (e.g. WELCOME10)" 
                    value={discountCode} 
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())} 
                    disabled={!!appliedDiscount}
                    className="h-10 text-sm"
                  />
                  <Button 
                    variant={appliedDiscount ? "destructive" : "secondary"} 
                    className="h-10 px-4"
                    onClick={() => {
                      if (appliedDiscount) {
                        setAppliedDiscount(null);
                        setDiscountCode("");
                        toast.info("Discount removed");
                      } else {
                        if (discountCode === "WELCOME10") {
                          setAppliedDiscount({ code: "WELCOME10", amount: subtotal * 0.1 });
                          toast.success("Discount applied!");
                        } else {
                          toast.error("Invalid or expired discount code");
                        }
                      }
                    }}
                  >
                    {appliedDiscount ? "Remove" : "Apply"}
                  </Button>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

// ─── Payment Step Component ───────────────────────────────────────────────────
function PaymentStep({
  orderId,
  orderNumber,
  paymentMethod,
  total,
  shippingPhone,
  onSuccess,
}: {
  orderId: number;
  orderNumber: string;
  paymentMethod: PaymentMethod;
  total: number;
  shippingPhone: string;
  onSuccess: () => void;
}) {
  const [mpesaPhone, setMpesaPhone] = useState(shippingPhone);
  const [mpesaCheckoutId, setMpesaCheckoutId] = useState<string | null>(null);
  const [cardData, setCardData] = useState({ number: "", expiry: "", cvv: "", firstName: "", lastName: "" });
  const [processing, setProcessing] = useState(false);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [paypalUrl, setPaypalUrl] = useState<string | null>(null);

  const initiateMpesa = trpc.checkout.initiateMpesa.useMutation({
    onSuccess: (data) => {
      setMpesaCheckoutId(data.checkoutRequestId);
      toast.success(data.message);
    },
    onError: (err) => toast.error(err.message),
  });

  const verifyMpesa = trpc.checkout.verifyMpesa.useMutation({
    onSuccess: () => onSuccess(),
    onError: (err) => toast.error(err.message),
  });

  const initiatePaypal = trpc.checkout.initiatePaypal.useMutation({
    onSuccess: (data) => {
      setPaypalOrderId(data.paypalOrderId);
      if (data.approvalUrl) {
        setPaypalUrl(data.approvalUrl);
      }
      toast.success(data.message);
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmPaypal = trpc.checkout.confirmPaypal.useMutation({
    onSuccess: () => onSuccess(),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PAYPAL_SUCCESS" && event.data.orderId === orderId.toString()) {
        confirmPaypal.mutate({ orderId, paypalOrderId: event.data.token });
      } else if (event.data?.type === "PAYPAL_CANCEL") {
        setPaypalOrderId(null);
        setPaypalUrl(null);
        toast.error("PayPal checkout was cancelled");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [orderId, confirmPaypal.mutate]);

  const processCard = trpc.checkout.processCard.useMutation({
    onSuccess: () => onSuccess(),
    onError: (err) => toast.error(err.message),
  });

  const isLoading = initiateMpesa.isPending || verifyMpesa.isPending || initiatePaypal.isPending || confirmPaypal.isPending || processCard.isPending;

  const formatCardNumber = (val: string) =>
    val.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim().slice(0, 19);

  const formatExpiry = (val: string) =>
    val.replace(/\D/g, "").replace(/^(\d{2})(\d)/, "$1/$2").slice(0, 5);

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="font-display text-lg font-bold mb-2 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-[var(--brand)]" /> Complete Payment
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        Order <span className="font-mono font-medium text-foreground">{orderNumber}</span> — Total: <span className="font-bold">{formatPrice(total)}</span>
      </p>

      {/* M-Pesa */}
      {paymentMethod === "mpesa" && (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-5 h-5 text-green-600" />
              <p className="font-semibold text-green-700 dark:text-green-400">M-Pesa STK Push</p>
            </div>
            <p className="text-sm text-green-600 dark:text-green-500">
              Enter your M-Pesa phone number. You'll receive a prompt to enter your PIN.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>M-Pesa Phone Number</Label>
            <Input
              value={mpesaPhone}
              onChange={(e) => setMpesaPhone(e.target.value)}
              placeholder="+254 712 345 678"
              disabled={!!mpesaCheckoutId}
            />
          </div>

          {!mpesaCheckoutId ? (
            <Button
              onClick={() => initiateMpesa.mutate({ orderId, phone: mpesaPhone })}
              disabled={isLoading || !mpesaPhone}
              className="w-full bg-green-600 text-white hover:bg-green-700 gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
              Send STK Push
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-center">
                <p className="font-medium">STK Push sent!</p>
                <p className="text-muted-foreground text-xs mt-1">Check your phone and enter your M-Pesa PIN</p>
              </div>
              <Button
                onClick={() => verifyMpesa.mutate({ orderId, checkoutRequestId: mpesaCheckoutId })}
                disabled={isLoading}
                className="w-full bg-[var(--brand)] text-white hover:opacity-90 gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                I've Completed Payment
              </Button>
            </div>
          )}
        </div>
      )}

      {/* PayPal */}
      {paymentMethod === "paypal" && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="font-semibold text-blue-700 dark:text-blue-400 mb-1">PayPal Checkout</p>
            <p className="text-sm text-blue-600 dark:text-blue-500">
              {paypalOrderId 
                ? "Please complete the payment in the newly opened window."
                : "You'll be redirected to PayPal to complete your payment securely."}
            </p>
          </div>
          
          {!paypalOrderId ? (
            <Button
              onClick={() => {
                // 1. Open the window synchronously to bypass the popup blocker!
                const popup = window.open("", "PayPal", "width=500,height=750");
                if (popup) popup.document.write("<h3 style='font-family:sans-serif; text-align:center; margin-top:40px; color:#666;'>Securely connecting to PayPal...</h3>");
                
                // 2. Fetch the URL and inject it into the already-open window
                initiatePaypal.mutate({ orderId }, {
                  onSuccess: (data) => {
                    if (popup && data.approvalUrl) {
                      popup.location.href = data.approvalUrl;
                    } else if (popup) {
                      popup.close();
                    }
                    if (!data.approvalUrl) {
                      toast.error("Could not obtain PayPal checkout link");
                      setPaypalOrderId(null);
                    }
                  },
                  onError: () => {
                    if (popup) popup.close();
                  }
                });
              }}
              disabled={isLoading}
              className="w-full bg-[#003087] text-white hover:bg-[#002070] gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Pay with PayPal — {formatPrice(total)}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-center">
                <p className="font-medium">PayPal Order Created!</p>
                <p className="text-muted-foreground text-xs mt-1">Please complete the payment in the popup window. This page will automatically update when finished.</p>
              </div>

              {paypalUrl && (
                <Button
                  onClick={() => window.open(paypalUrl, "PayPal", "width=500,height=750")}
                  className="w-full bg-[#003087] text-white hover:bg-[#002070] gap-2 mb-4"
                >
                  Open PayPal Window
                </Button>
              )}

              <Button
                onClick={() => confirmPaypal.mutate({ orderId, paypalOrderId })}
                disabled={isLoading}
                className="w-full bg-[var(--brand)] text-white hover:opacity-90 gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                I've Completed Payment (Manual Verify)
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setPaypalOrderId(null); setPaypalUrl(null); }}
                className="w-full text-xs text-muted-foreground"
              >
                Cancel and try again
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Stripe / Card */}
      {paymentMethod === "stripe" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>First Name</Label>
              <Input
                value={cardData.firstName}
                onChange={(e) => setCardData((d) => ({ ...d, firstName: e.target.value }))}
                placeholder="First Name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input
                value={cardData.lastName}
                onChange={(e) => setCardData((d) => ({ ...d, lastName: e.target.value }))}
                placeholder="Last Name"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Card Number</Label>
            <Input
              value={cardData.number}
              onChange={(e) => setCardData((d) => ({ ...d, number: formatCardNumber(e.target.value) }))}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input
                value={cardData.expiry}
                onChange={(e) => setCardData((d) => ({ ...d, expiry: formatExpiry(e.target.value) }))}
                placeholder="MM/YY"
                maxLength={5}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CVV</Label>
              <Input
                value={cardData.cvv}
                onChange={(e) => setCardData((d) => ({ ...d, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                placeholder="123"
                maxLength={4}
                type="password"
              />
            </div>
          </div>
          <Button
            onClick={() =>
              processCard.mutate({
                orderId,
                cardNumber: cardData.number.replace(/\s/g, ""),
                expiry: cardData.expiry,
                cvv: cardData.cvv,
                cardholderName: `${cardData.firstName} ${cardData.lastName}`.trim(),
              })
            }
            disabled={isLoading || !cardData.number || !cardData.expiry || !cardData.cvv || !cardData.firstName || !cardData.lastName}
            className="w-full bg-[var(--brand)] text-white hover:opacity-90 gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Pay {formatPrice(total)} Securely
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            🔒 Your payment information is encrypted and secure
          </p>
        </div>
      )}
    </div>
  );
}
