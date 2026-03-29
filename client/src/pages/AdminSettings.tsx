import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Save, Upload, X, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("general");
  const [generalSettings, setGeneralSettings] = useState({
    storeName: "Store",
    storeDescription: "Premium Computer & Laptop Store",
    contactEmail: "support@company.com",
    phone: "+1 (555) 000-0000",
    address: "123 Innovation Drive, Suite 100, Tech City",
    currency: "USD",
    timezone: "Africa/Nairobi",
    heroTitle: "Premium Tech, Exceptional Performance",
    heroDescription: "Discover the latest laptops, desktops, and accessories from the world's leading brands. Built for professionals, creators, and gamers.",
    heroImage: "",
    heroBadge: "New Arrivals 2025",
    ctaTitle: "Ready to Upgrade Your Setup?",
    ctaDescription: "Join thousands of satisfied customers. Shop the latest tech with confidence — free shipping on orders over $500.",
    statsProductCount: "",
    statsCustomerCount: "",
    statsAvgRating: "",
    features: [
      { icon: "Truck", title: "Free Shipping", desc: "On orders over $500", content: "We believe you shouldn't have to pay extra just to get your new tech delivered. That's why we offer fast, free standard shipping on all orders over $500. Your items will be securely packaged and delivered right to your doorstep within 3-5 business days." },
      { icon: "Shield", title: "2-Year Warranty", desc: "On all products", content: "Shop with peace of mind. Every product we sell is backed by a comprehensive 2-year warranty that covers manufacturer defects and hardware failures. If your device fails under normal use, we'll repair or replace it at no extra cost to you." },
      { icon: "RefreshCw", title: "30-Day Returns", desc: "Hassle-free returns", content: "Not completely satisfied with your purchase? No problem. We offer a hassle-free 30-day return policy. Simply return the item in its original condition and packaging for a full refund or exchange—no complicated questions asked." },
      { icon: "Award", title: "Certified Products", desc: "100% authentic hardware", content: "Quality and authenticity are our top priorities. We guarantee that all our products are 100% authentic, brand new, and sourced directly from official manufacturers and authorized distributors." },
    ],
    openingHours: [
      { label: "Mon - Fri", value: "9:00 AM - 8:00 PM" },
      { label: "Saturday", value: "10:00 AM - 6:00 PM" },
      { label: "Sunday", value: "Closed" },
    ],
    floatingBadge1: { icon: "Shield", title: "Verified Quality", desc: "All products certified" },
    floatingBadge2: { icon: "Truck", title: "Fast Delivery", desc: "2–5 business days" },
    lifestyles: [
      { title: "Creative & Technical", description: "For designers, developers, and artists.", icon: "Palette", color: "text-purple-500 bg-purple-500/10", link: "/products?tag=creative" },
      { title: "Professional", description: "For business, productivity, and meetings.", icon: "Briefcase", color: "text-blue-500 bg-blue-500/10", link: "/products?tag=professional" },
      { title: "Gaming", description: "For high-performance, immersive gaming.", icon: "Gamepad2", color: "text-red-500 bg-red-500/10", link: "/products?tag=gaming" },
      { title: "School & Hobbies", description: "For students, learning, and personal projects.", icon: "BookOpen", color: "text-green-500 bg-green-500/10", link: "/products?tag=student" },
      { title: "Entertainment", description: "For movies, music, and streaming.", icon: "Film", color: "text-yellow-500 bg-yellow-500/10", link: "/products?tag=entertainment" },
      { title: "Business", description: "For enterprise-level security and management.", icon: "Building", color: "text-gray-500 bg-gray-500/10", link: "/products?tag=business" },
    ],
  });

  const [appearanceSettings, setAppearanceSettings] = useState({
    primaryColor: "#0284c7",
    secondaryColor: "#0ea5e9",
    promoBannerColor: "#0369a1",
    logoUrl: "",
    faviconUrl: "",
    userTheme: "light",
    adminTheme: "light",
  });

  const [paymentSettings, setPaymentSettings] = useState({
    mpesaKey: "",
    mpesaSecret: "",
    mpesaShortcode: "",
    mpesaPasskey: "",
    mpesaEnv: "sandbox",
    paypalClientId: "",
    paypalSecret: "",
    stripePublishable: "",
    stripeSecret: "",
    codEnabled: false,
  });

  const [shippingSettings, setShippingSettings] = useState({
    standardFee: "50.00",
    expressDelivery: "100.00",
    freeShippingThreshold: "50000.00",
  });

  const [emailSettings, setEmailSettings] = useState({
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    orderConfirmation: true,
    shippingNotification: true,
    abandonedCartReminder: true,
    orderConfirmationMessage: "Thank you for your order. We are getting your items ready for shipment.",
    shippingNotificationMessage: "Great news! Your order has been shipped and is on its way to you.",
    productImageWidth: "40",
    emailBackgroundColor: "#ffffff",
    emailButtonColor: "#3b82f6",
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    loginAttemptLimit: "5",
    captchaEnabled: true,
    googleClientId: "",
    googleClientSecret: "",
    facebookAppId: "",
    facebookAppSecret: "",
  });

  const [socialSettings, setSocialSettings] = useState({
    facebook: "https://facebook.com/yourstore",
    instagram: "https://instagram.com/yourstore",
    twitter: "https://twitter.com/yourstore",
    linkedin: "https://linkedin.com/company/yourstore",
    youtube: "https://youtube.com/@yourstore",
    tiktok: "https://tiktok.com/@yourstore",
  });

  const [backupSettings, setBackupSettings] = useState({ schedule: "weekly" });

  const updateSetting = trpc.admin.updateSetting.useMutation();
  const utils = trpc.useUtils();

  const createPresignedUrl = trpc.admin.createPresignedUrl.useMutation();

  // Fetch initial settings from DB
  const { data: dbGeneral } = trpc.admin.getSetting.useQuery({ key: "general" });
  const { data: dbAppearance } = trpc.admin.getSetting.useQuery({ key: "appearance" });
  const { data: dbPayment } = trpc.admin.getSetting.useQuery({ key: "payment" });
  const { data: dbShipping } = trpc.admin.getSetting.useQuery({ key: "shipping" });
  const { data: dbEmail } = trpc.admin.getSetting.useQuery({ key: "email" });
  const { data: dbSecurity } = trpc.admin.getSetting.useQuery({ key: "security" });
  const { data: dbSocial } = trpc.admin.getSetting.useQuery({ key: "social" });
  const { data: dbBackup } = trpc.admin.getSetting.useQuery({ key: "backup" });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const heroImageInputRef = useRef<HTMLInputElement>(null);

  // Populate state once data is loaded (if it exists)
  useEffect(() => { 
    if (dbGeneral) {
      setGeneralSettings(prev => {
        const next = {
          ...prev,
          ...(dbGeneral as any),
          features: (dbGeneral as any).features || prev.features,
          openingHours: (dbGeneral as any).openingHours || prev.openingHours,
          heroImage: (dbGeneral as any).heroImage || prev.heroImage,
          floatingBadge1: (dbGeneral as any).floatingBadge1 || prev.floatingBadge1,
          floatingBadge2: (dbGeneral as any).floatingBadge2 || prev.floatingBadge2,
          lifestyles: (dbGeneral as any).lifestyles || prev.lifestyles,
        };
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    }
  }, [dbGeneral]);

  useEffect(() => { 
    if (dbAppearance) {
      setAppearanceSettings(prev => {
        const next = { ...prev, ...(dbAppearance as any) };
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    } 
  }, [dbAppearance]);

  useEffect(() => { 
    if (dbPayment) {
      setPaymentSettings(prev => {
        const next = { ...prev, ...(dbPayment as any) };
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    } 
  }, [dbPayment]);

  useEffect(() => { if (dbShipping) setShippingSettings(prev => JSON.stringify(prev) === JSON.stringify(dbShipping) ? prev : (dbShipping as any)); }, [dbShipping]);
  useEffect(() => { if (dbEmail) setEmailSettings(prev => JSON.stringify(prev) === JSON.stringify(dbEmail) ? prev : (dbEmail as any)); }, [dbEmail]);
  useEffect(() => { if (dbSecurity) setSecuritySettings(prev => JSON.stringify(prev) === JSON.stringify(dbSecurity) ? prev : (dbSecurity as any)); }, [dbSecurity]);
  useEffect(() => { if (dbSocial) setSocialSettings(prev => JSON.stringify(prev) === JSON.stringify(dbSocial) ? prev : (dbSocial as any)); }, [dbSocial]);
  useEffect(() => { if (dbBackup) setBackupSettings(prev => JSON.stringify(prev) === JSON.stringify(dbBackup) ? prev : (dbBackup as any)); }, [dbBackup]);

  const handleSave = async (key: string, data: any, label: string) => {
    try {
      await updateSetting.mutateAsync({ key, value: data });
      utils.admin.getSetting.invalidate({ key });
      utils.settings.public.invalidate();
      toast.success(`${label} settings saved successfully`);
    } catch (error) {
      toast.error(`Failed to save ${label} settings`);
    }
  };

  // Handle file uploads by converting them to secure Base64 strings
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: 'logoUrl' | 'faviconUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }
    // Security: restrict size to 2MB to prevent large blob storage issues
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB.");
      return;
    }

    let toastId: string | number | undefined;
    try {
      toastId = toast.loading("Uploading...");
      const { uploadUrl, publicUrl } = await createPresignedUrl.mutateAsync({ filename: file.name, contentType: file.type });
      
      if (uploadUrl && publicUrl) {
        const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!res.ok) throw new Error("S3 Upload Failed");
        setAppearanceSettings(prev => ({ ...prev, [key]: publicUrl }));
        toast.success("Uploaded successfully!", { id: toastId });
      } else {
        throw new Error("Failed to get presigned URL");
      }
    } catch (err) { toast.error("Failed to upload file", { id: toastId }); }

    if (key === 'logoUrl' && logoInputRef.current) logoInputRef.current.value = "";
    if (key === 'faviconUrl' && faviconInputRef.current) faviconInputRef.current.value = "";
  };

  // Handle general setting file uploads (like the Hero Image)
  const handleGeneralFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB.");
      return;
    }

    let toastId: string | number | undefined;
    try {
      toastId = toast.loading("Uploading...");
      const { uploadUrl, publicUrl } = await createPresignedUrl.mutateAsync({ filename: file.name, contentType: file.type });
      
      if (uploadUrl && publicUrl) {
        const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!res.ok) throw new Error("S3 Upload Failed");
        setGeneralSettings(prev => ({ ...prev, [key]: publicUrl }));
        toast.success("Uploaded successfully!", { id: toastId });
      } else {
        throw new Error("Failed to get presigned URL");
      }
    } catch (err) { toast.error("Failed to upload file", { id: toastId }); }

    if (e.target) e.target.value = "";
  };

  const handleDownloadBackup = async () => {
    try {
      const backupData = await utils.admin.exportDatabase.fetch();
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeStoreName = generalSettings.storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'store';
      a.download = `${safeStoreName}-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Database backup generated and downloaded");
    } catch (err) {
      toast.error("Failed to generate backup");
    }
  };

  return (
    <AdminLayout activeTab="settings">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold">Settings</h2>
          <p className="text-muted-foreground mt-1">
            Configure your store settings and preferences
          </p>
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
            <TabsTrigger value="shipping">Shipping</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">General Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Store Name</label>
                  <Input
                    value={generalSettings.storeName}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        storeName: e.target.value,
                      })
                    }
                  title="Store Name"
                  aria-label="Store Name"
                  placeholder="Store Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Store Description
                  </label>
                  <Textarea
                    value={generalSettings.storeDescription}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        storeDescription: e.target.value,
                      })
                    }
                  title="Store Description"
                  aria-label="Store Description"
                  placeholder="Store Description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Contact Email
                    </label>
                    <Input
                      type="email"
                      value={generalSettings.contactEmail}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          contactEmail: e.target.value,
                        })
                      }
                    title="Contact Email"
                    aria-label="Contact Email"
                  placeholder="support@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Phone</label>
                    <Input
                      value={generalSettings.phone}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          phone: e.target.value,
                        })
                      }
                    title="Phone Number"
                    aria-label="Phone Number"
                  placeholder="+1 (555)..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Address</label>
                  <Input
                    value={generalSettings.address}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        address: e.target.value,
                      })
                    }
                title="Store Address"
                aria-label="Store Address"
            placeholder="123 Innovation Drive..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium">Currency</label>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch("https://ipapi.co/json/");
                            const data = await res.json();
                            if (data.currency) {
                              setGeneralSettings({ ...generalSettings, currency: data.currency });
                              toast.success(`Currency detected: ${data.currency}`);
                            } else throw new Error("Currency not found in response");
                          } catch (err) {
                            toast.error("Failed to detect currency from IP");
                          }
                        }}
                        className="text-xs text-[var(--brand)] hover:underline"
                      >
                        Detect Auto
                      </button>
                    </div>
                    <Select
                      value={generalSettings.currency}
                      onValueChange={(val) =>
                        setGeneralSettings({
                          ...generalSettings,
                          currency: val,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {![
                          "USD", "KES", "EUR", "GBP", 
                          "UGX", "TZS", "ZAR", "NGN"
                        ].includes(generalSettings.currency) && generalSettings.currency ? (
                          <SelectItem value={generalSettings.currency}>{generalSettings.currency}</SelectItem>
                        ) : null}
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="KES">KES (Ksh)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="UGX">UGX (USh)</SelectItem>
                        <SelectItem value="TZS">TZS (TSh)</SelectItem>
                        <SelectItem value="ZAR">ZAR (R)</SelectItem>
                        <SelectItem value="NGN">NGN (₦)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium">Timezone</label>
                      <button
                        type="button"
                        onClick={() => {
                          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                          setGeneralSettings({ ...generalSettings, timezone: tz });
                          toast.success(`Timezone detected: ${tz}`);
                        }}
                        className="text-xs text-[var(--brand)] hover:underline"
                      >
                        Detect Auto
                      </button>
                    </div>
                    <Select
                      value={generalSettings.timezone}
                      onValueChange={(val) =>
                        setGeneralSettings({
                          ...generalSettings,
                          timezone: val,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {![
                          "UTC", "America/New_York", "America/Los_Angeles", "Europe/London", 
                          "Europe/Paris", "Africa/Nairobi", "Africa/Lagos", "Africa/Johannesburg", 
                          "Asia/Dubai", "Asia/Tokyo", "Australia/Sydney"
                        ].includes(generalSettings.timezone) && generalSettings.timezone ? (
                          <SelectItem value={generalSettings.timezone}>{generalSettings.timezone}</SelectItem>
                        ) : null}
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST/EDT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                        <SelectItem value="Europe/Paris">Europe/Paris (CET/CEST)</SelectItem>
                        <SelectItem value="Africa/Nairobi">Africa/Nairobi (EAT)</SelectItem>
                        <SelectItem value="Africa/Lagos">Africa/Lagos (WAT)</SelectItem>
                        <SelectItem value="Africa/Johannesburg">Africa/Johannesburg (SAST)</SelectItem>
                        <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                        <SelectItem value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-2 space-y-4">
                  <h4 className="font-medium text-base">Homepage Content</h4>
                  <div>
                    <label className="block text-sm font-medium mb-2">Hero Image</label>
                    <div 
                      className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors relative"
                      onClick={() => heroImageInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        className="hidden" 
                        ref={heroImageInputRef} 
                        accept="image/*" 
                        onChange={(e) => handleGeneralFileUpload(e, 'heroImage')} 
                    title="Upload hero image"
                    aria-label="Upload hero image"
                      />
                      {generalSettings.heroImage ? (
                        <div className="relative inline-block w-full max-w-sm">
                          <img src={generalSettings.heroImage} alt="Hero preview" className="w-full h-auto object-cover rounded-md border border-border" />
                          <Button 
                            type="button"
                            variant="destructive" 
                            size="icon" 
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGeneralSettings({ ...generalSettings, heroImage: "" });
                            }}
                        title="Remove hero image"
                        aria-label="Remove hero image"
                          >
                            <X size={12} />
                          </Button>
                        </div>
                      ) : (
                        <div className="py-2">
                          <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 2MB</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Hero Badge</label>
                    <Input
                      list="hero-badge-suggestions"
                      value={generalSettings.heroBadge || ""}
                      onChange={(e) =>
                        setGeneralSettings({ ...generalSettings, heroBadge: e.target.value })
                      }
                      placeholder="Type or select a badge..."
                    />
                    <datalist id="hero-badge-suggestions">
                      <option value="New Arrivals 2025" />
                      <option value="Flash Sale Today" />
                      <option value="Spring Collection 2026" />
                      <option value="Limited Edition" />
                      <option value="Bestsellers" />
                      <option value="Clearance Event" />
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Hero Title</label>
                    <Input
                      value={generalSettings.heroTitle}
                      onChange={(e) =>
                        setGeneralSettings({ ...generalSettings, heroTitle: e.target.value })
                      }
                  title="Hero Title"
                  aria-label="Hero Title"
                  placeholder="Hero Title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Hero Description</label>
                    <Textarea
                      value={generalSettings.heroDescription}
                      onChange={(e) =>
                        setGeneralSettings({ ...generalSettings, heroDescription: e.target.value })
                      }
                  title="Hero Description"
                  aria-label="Hero Description"
                  placeholder="Hero Description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">CTA Title</label>
                    <Input
                      value={generalSettings.ctaTitle}
                      onChange={(e) =>
                        setGeneralSettings({ ...generalSettings, ctaTitle: e.target.value })
                      }
                  title="CTA Title"
                  aria-label="CTA Title"
                  placeholder="CTA Title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">CTA Description</label>
                    <Textarea
                      value={generalSettings.ctaDescription}
                      onChange={(e) =>
                        setGeneralSettings({ ...generalSettings, ctaDescription: e.target.value })
                      }
                  title="CTA Description"
                  aria-label="CTA Description"
                  placeholder="CTA Description"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-2 space-y-4">
                  <div>
                    <h4 className="font-medium text-base">Homepage Statistics (Overrides)</h4>
                    <p className="text-xs text-muted-foreground mb-4">Leave empty to use actual database metrics automatically.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Products</label>
                      <Input
                        value={generalSettings.statsProductCount || ""}
                        placeholder="e.g. 500"
                        onChange={(e) =>
                          setGeneralSettings({ ...generalSettings, statsProductCount: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Customers</label>
                      <Input
                        value={generalSettings.statsCustomerCount || ""}
                        placeholder="e.g. 1000"
                        onChange={(e) =>
                          setGeneralSettings({ ...generalSettings, statsCustomerCount: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Avg. Rating</label>
                      <Input
                        value={generalSettings.statsAvgRating || ""}
                        placeholder="e.g. 4.9"
                        onChange={(e) =>
                          setGeneralSettings({ ...generalSettings, statsAvgRating: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-2 space-y-4">
                  <div>
                    <h4 className="font-medium text-base">Store Features (Hero Bar)</h4>
                    <p className="text-xs text-muted-foreground mb-4">Customize the 4 highlight features displayed under the main banner.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {generalSettings.features?.map((feat, idx) => (
                      <div key={idx} className="p-4 border border-border rounded-lg space-y-3 bg-secondary/30">
                        <h5 className="text-sm font-semibold mb-2">Feature {idx + 1}</h5>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Icon</label>
                          <Select
                            value={feat.icon}
                            onValueChange={(val) => {
                              const newFeatures = [...generalSettings.features];
                              newFeatures[idx] = { ...newFeatures[idx], icon: val };
                              setGeneralSettings({ ...generalSettings, features: newFeatures });
                            }}
                          >
                            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["Truck", "Shield", "RefreshCw", "Award", "Clock", "CreditCard", "Gift", "Headphones", "Heart", "MapPin", "Package", "Phone", "ShoppingBag", "Star", "ThumbsUp", "Zap", "CheckCircle", "Globe", "Monitor", "Cpu", "Smartphone"].map(icon => (
                                <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Title</label>
                      <Input value={feat.title} onChange={(e) => { const newFeatures = [...generalSettings.features]; newFeatures[idx] = { ...newFeatures[idx], title: e.target.value }; setGeneralSettings({ ...generalSettings, features: newFeatures }); }} className="bg-background" title={`Feature ${idx + 1} Title`} aria-label={`Feature ${idx + 1} Title`} placeholder={`Feature ${idx + 1} Title`} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Description</label>
                      <Input value={feat.desc} onChange={(e) => { const newFeatures = [...generalSettings.features]; newFeatures[idx] = { ...newFeatures[idx], desc: e.target.value }; setGeneralSettings({ ...generalSettings, features: newFeatures }); }} className="bg-background" title={`Feature ${idx + 1} Description`} aria-label={`Feature ${idx + 1} Description`} placeholder={`Feature ${idx + 1} Description`} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Detailed Content (About Page)</label>
                      <Textarea value={feat.content || ""} onChange={(e) => { const newFeatures = [...generalSettings.features]; newFeatures[idx] = { ...newFeatures[idx], content: e.target.value }; setGeneralSettings({ ...generalSettings, features: newFeatures }); }} className="bg-background" rows={3} title={`Feature ${idx + 1} Detailed Content`} aria-label={`Feature ${idx + 1} Detailed Content`} placeholder={`Feature ${idx + 1} Detailed Content`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-2 space-y-4">
                  <div>
                    <h4 className="font-medium text-base">Hero Floating Badges</h4>
                    <p className="text-xs text-muted-foreground mb-4">Customize the floating badges overlaid on the main hero image.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'floatingBadge1', label: 'Bottom Left Badge' },
                      { key: 'floatingBadge2', label: 'Top Right Badge' }
                    ].map((badge, idx) => (
                      <div key={idx} className="p-4 border border-border rounded-lg space-y-3 bg-secondary/30">
                        <h5 className="text-sm font-semibold mb-2">{badge.label}</h5>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Icon</label>
                          <Select
                            value={(generalSettings as any)[badge.key]?.icon}
                            onValueChange={(val) => {
                              setGeneralSettings({ ...generalSettings, [badge.key]: { ...(generalSettings as any)[badge.key], icon: val } });
                            }}
                          >
                            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["Truck", "Shield", "RefreshCw", "Award", "Clock", "CreditCard", "Gift", "Headphones", "Heart", "MapPin", "Package", "Phone", "ShoppingBag", "Star", "ThumbsUp", "Zap", "CheckCircle", "Globe", "Monitor", "Cpu", "Smartphone"].map(icon => (
                                <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Title</label>
                      <Input value={(generalSettings as any)[badge.key]?.title} onChange={(e) => { setGeneralSettings({ ...generalSettings, [badge.key]: { ...(generalSettings as any)[badge.key], title: e.target.value } }); }} className="bg-background" title={`${badge.label} Title`} aria-label={`${badge.label} Title`} placeholder="Badge Title" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Description</label>
                      <Input value={(generalSettings as any)[badge.key]?.desc} onChange={(e) => { setGeneralSettings({ ...generalSettings, [badge.key]: { ...(generalSettings as any)[badge.key], desc: e.target.value } }); }} className="bg-background" title={`${badge.label} Description`} aria-label={`${badge.label} Description`} placeholder="Badge Description" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-2 space-y-4">
                  <div>
                    <h4 className="font-medium text-base">Opening Hours</h4>
                    <p className="text-xs text-muted-foreground mb-4">Set your store's operating hours displayed on the map section.</p>
                  </div>
                  <div className="space-y-3">
                    {generalSettings.openingHours?.map((hour, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <Input
                          placeholder="Day (e.g. Mon - Fri)"
                          value={hour.label}
                          onChange={(e) => {
                            const newHours = [...generalSettings.openingHours];
                            newHours[idx] = { ...newHours[idx], label: e.target.value };
                            setGeneralSettings({ ...generalSettings, openingHours: newHours });
                          }}
                          className="w-1/3"
                      title="Day (e.g. Mon - Fri)"
                      aria-label="Day (e.g. Mon - Fri)"
                        />
                        <Input
                          placeholder="Hours (e.g. 9:00 AM - 8:00 PM)"
                          value={hour.value}
                          onChange={(e) => {
                            const newHours = [...generalSettings.openingHours];
                            newHours[idx] = { ...newHours[idx], value: e.target.value };
                            setGeneralSettings({ ...generalSettings, openingHours: newHours });
                          }}
                          className="flex-1"
                      title="Hours (e.g. 9:00 AM - 8:00 PM)"
                      aria-label="Hours (e.g. 9:00 AM - 8:00 PM)"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive shrink-0 hover:bg-destructive/10"
                          onClick={() => {
                            const newHours = generalSettings.openingHours.filter((_, i) => i !== idx);
                            setGeneralSettings({ ...generalSettings, openingHours: newHours });
                          }}
                      title="Remove hours row"
                      aria-label="Remove hours row"
                        >
                          <X size={16} />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setGeneralSettings({
                          ...generalSettings,
                          openingHours: [...(generalSettings.openingHours || []), { label: "", value: "" }]
                        });
                      }}
                      className="gap-2 mt-2"
                    >
                      <Plus size={16} /> Add Hours Row
                    </Button>
                  </div>
                </div>

              <Button onClick={() => handleSave("general", generalSettings, "General")} className="gap-2" disabled={updateSetting.isPending}>
                  {updateSetting.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Appearance Settings */}
          <TabsContent value="appearance" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Appearance Settings</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Primary Color
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearanceSettings.primaryColor}
                        onChange={(e) =>
                          setAppearanceSettings({
                            ...appearanceSettings,
                            primaryColor: e.target.value,
                          })
                        }
                        className="w-16 h-10"
                    title="Primary Color Picker"
                    aria-label="Primary Color Picker"
                      />
                      <Input
                        value={appearanceSettings.primaryColor}
                        onChange={(e) =>
                          setAppearanceSettings({
                            ...appearanceSettings,
                            primaryColor: e.target.value,
                          })
                        }
                    title="Primary Color Hex"
                    aria-label="Primary Color Hex"
                    placeholder="#000000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Secondary Color
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearanceSettings.secondaryColor}
                        onChange={(e) =>
                          setAppearanceSettings({
                            ...appearanceSettings,
                            secondaryColor: e.target.value,
                          })
                        }
                        className="w-16 h-10"
                    title="Secondary Color Picker"
                    aria-label="Secondary Color Picker"
                      />
                      <Input
                        value={appearanceSettings.secondaryColor}
                        onChange={(e) =>
                          setAppearanceSettings({
                            ...appearanceSettings,
                            secondaryColor: e.target.value,
                          })
                        }
                    title="Secondary Color Hex"
                    aria-label="Secondary Color Hex"
                    placeholder="#000000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Promo Banner Color
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearanceSettings.promoBannerColor || "#3b82f6"}
                        onChange={(e) =>
                          setAppearanceSettings({
                            ...appearanceSettings,
                            promoBannerColor: e.target.value,
                          })
                        }
                        className="w-16 h-10"
                    title="Promo Banner Color Picker"
                    aria-label="Promo Banner Color Picker"
                      />
                      <Input
                        value={appearanceSettings.promoBannerColor || "#3b82f6"}
                        onChange={(e) =>
                          setAppearanceSettings({
                            ...appearanceSettings,
                            promoBannerColor: e.target.value,
                          })
                        }
                    title="Promo Banner Color Hex"
                    aria-label="Promo Banner Color Hex"
                    placeholder="#3b82f6"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 mb-6 border-t border-border pt-6">
                  <label className="block text-sm font-medium mb-3">Live Theme Preview</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Light Mode Preview */}
                    <div className="border border-border rounded-xl overflow-hidden shadow-sm flex flex-col bg-white text-zinc-900 pointer-events-none select-none">
                      <div className="h-6 w-full flex items-center justify-center text-[10px] font-bold text-white tracking-widest" style={{ backgroundColor: appearanceSettings.promoBannerColor }}>
                        PROMO BANNER
                      </div>
                      <div className="p-5 flex-1">
                        <div className="flex items-center justify-between mb-5">
                          <div className="font-black tracking-tight text-lg">STORE</div>
                          <div className="flex gap-3 text-[10px] text-zinc-500 font-bold uppercase">
                            <span>Shop</span><span>About</span>
                          </div>
                        </div>
                        <h4 className="text-xl font-bold mb-1">Light Mode</h4>
                        <p className="text-xs text-zinc-500 mb-5">Preview of your brand colors on light backgrounds.</p>
                        <div className="flex gap-2">
                          <div className="px-4 py-2 rounded-md text-[11px] font-semibold text-white shadow-sm" style={{ backgroundColor: appearanceSettings.primaryColor }}>Primary Action</div>
                          <div className="px-4 py-2 rounded-md text-[11px] font-semibold text-white shadow-sm" style={{ backgroundColor: appearanceSettings.secondaryColor }}>Secondary</div>
                        </div>
                      </div>
                    </div>

                    {/* Dark Mode Preview */}
                    <div className="border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col bg-zinc-950 text-zinc-50 pointer-events-none select-none">
                      <div className="h-6 w-full flex items-center justify-center text-[10px] font-bold text-white tracking-widest" style={{ backgroundColor: appearanceSettings.promoBannerColor }}>
                        PROMO BANNER
                      </div>
                      <div className="p-5 flex-1">
                        <div className="flex items-center justify-between mb-5">
                          <div className="font-black tracking-tight text-lg text-white">STORE</div>
                          <div className="flex gap-3 text-[10px] text-zinc-400 font-bold uppercase">
                            <span>Shop</span><span>About</span>
                          </div>
                        </div>
                        <h4 className="text-xl font-bold mb-1 text-white">Dark Mode</h4>
                        <p className="text-xs text-zinc-400 mb-5">Preview of your brand colors on dark backgrounds.</p>
                        <div className="flex gap-2">
                          <div className="px-4 py-2 rounded-md text-[11px] font-semibold text-white shadow-sm" style={{ backgroundColor: appearanceSettings.primaryColor }}>Primary Action</div>
                          <div className="px-4 py-2 rounded-md text-[11px] font-semibold text-white shadow-sm" style={{ backgroundColor: appearanceSettings.secondaryColor }}>Secondary</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Logo</label>
                  <div 
                    className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors relative"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={logoInputRef} 
                      accept="image/*" 
                      onChange={(e) => handleFileUpload(e, 'logoUrl')} 
                    title="Upload logo"
                    aria-label="Upload logo"
                    />
                    {appearanceSettings.logoUrl ? (
                      <div className="relative inline-block">
                        <img src={appearanceSettings.logoUrl} alt="Logo preview" className="h-16 object-contain" />
                        <Button 
                          type="button"
                          variant="destructive" 
                          size="icon" 
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAppearanceSettings({ ...appearanceSettings, logoUrl: "" });
                          }}
                        title="Remove logo"
                        aria-label="Remove logo"
                        >
                          <X size={12} />
                        </Button>
                      </div>
                    ) : (
                      <div className="py-2">
                        <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG up to 2MB</p>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Favicon</label>
                  <div 
                    className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors relative"
                    onClick={() => faviconInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={faviconInputRef} 
                      accept="image/x-icon,image/png,image/svg+xml" 
                      onChange={(e) => handleFileUpload(e, 'faviconUrl')} 
                    title="Upload favicon"
                    aria-label="Upload favicon"
                    />
                    {appearanceSettings.faviconUrl ? (
                      <div className="relative inline-block">
                        <img src={appearanceSettings.faviconUrl} alt="Favicon preview" className="h-12 w-12 object-contain" />
                        <Button 
                          type="button"
                          variant="destructive" 
                          size="icon" 
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAppearanceSettings({ ...appearanceSettings, faviconUrl: "" });
                          }}
                        title="Remove favicon"
                        aria-label="Remove favicon"
                        >
                          <X size={12} />
                        </Button>
                      </div>
                    ) : (
                      <div className="py-2">
                        <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground mt-1">.ico, .png, .svg up to 2MB</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-border pt-6 mt-4">
                  <h4 className="font-medium mb-4">Theme Preferences</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Storefront Theme</label>
                      <Select
                        value={appearanceSettings.userTheme || "light"}
                        onValueChange={(val) =>
                          setAppearanceSettings({ ...appearanceSettings, userTheme: val })
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System (Auto)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1.5">Default theme for your customers.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Admin Panel Theme</label>
                      <Select
                        value={appearanceSettings.adminTheme || "light"}
                        onValueChange={(val) =>
                          setAppearanceSettings({ ...appearanceSettings, adminTheme: val })
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System (Auto)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1.5">Default theme for the admin dashboard.</p>
                    </div>
                  </div>
                </div>

                <Button onClick={() => handleSave("appearance", appearanceSettings, "Appearance")} className="gap-2" disabled={updateSetting.isPending}>
                  {updateSetting.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Payment Settings */}
          <TabsContent value="payment" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Payment Gateway Credentials</h3>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">M-Pesa</h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Consumer Key</label>
                        <Input
                          placeholder="Consumer Key"
                          type="password"
                          value={paymentSettings.mpesaKey}
                          onChange={(e) => setPaymentSettings({ ...paymentSettings, mpesaKey: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Consumer Secret</label>
                        <Input
                          placeholder="Consumer Secret"
                          type="password"
                          value={paymentSettings.mpesaSecret}
                          onChange={(e) => setPaymentSettings({ ...paymentSettings, mpesaSecret: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Business Shortcode</label>
                        <Input
                          placeholder="e.g. 174379"
                          value={paymentSettings.mpesaShortcode}
                          onChange={(e) => setPaymentSettings({ ...paymentSettings, mpesaShortcode: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Environment</label>
                        <Select
                          value={paymentSettings.mpesaEnv || "sandbox"}
                          onValueChange={(val) => setPaymentSettings({ ...paymentSettings, mpesaEnv: val })}
                        >
                          <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                            <SelectItem value="production">Production (Live)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">STK Passkey</label>
                      <Input
                        placeholder="STK Push Passkey"
                        type="password"
                        value={paymentSettings.mpesaPasskey}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, mpesaPasskey: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-6">
                  <h4 className="font-medium mb-3">PayPal</h4>
                  <div className="space-y-3">
                    <Input
                      placeholder="PayPal Client ID"
                      type="password"
                      value={paymentSettings.paypalClientId}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          paypalClientId: e.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="PayPal Secret"
                      type="password"
                      value={paymentSettings.paypalSecret}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          paypalSecret: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-6">
                  <h4 className="font-medium mb-3">Stripe</h4>
                  <div className="space-y-3">
                    <Input
                      placeholder="Stripe Publishable Key"
                      type="password"
                      value={paymentSettings.stripePublishable}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          stripePublishable: e.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="Stripe Secret Key"
                      type="password"
                      value={paymentSettings.stripeSecret}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          stripeSecret: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-6 mt-6 flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-foreground">Cash on Delivery (COD)</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Allow customers to pay in cash upon receiving their order.</p>
                  </div>
                  <Switch 
                    checked={paymentSettings.codEnabled} 
                    onCheckedChange={(c) => setPaymentSettings({ ...paymentSettings, codEnabled: c })} 
                title="Enable Cash on Delivery"
                aria-label="Enable Cash on Delivery"
                  />
                </div>

                <Button onClick={() => handleSave("payment", paymentSettings, "Payment")} className="gap-2" disabled={updateSetting.isPending}>
                  {updateSetting.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Credentials
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Shipping Settings */}
          <TabsContent value="shipping" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Shipping Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Standard Shipping Fee
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={shippingSettings.standardFee}
                    onChange={(e) =>
                      setShippingSettings({
                        ...shippingSettings,
                        standardFee: e.target.value,
                      })
                    }
                  title="Standard Shipping Fee"
                  aria-label="Standard Shipping Fee"
                  placeholder="10.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Express Delivery Fee
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={shippingSettings.expressDelivery}
                    onChange={(e) =>
                      setShippingSettings({
                        ...shippingSettings,
                        expressDelivery: e.target.value,
                      })
                    }
                  title="Express Delivery Fee"
                  aria-label="Express Delivery Fee"
                  placeholder="25.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Free Shipping Threshold
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={shippingSettings.freeShippingThreshold}
                    onChange={(e) =>
                      setShippingSettings({
                        ...shippingSettings,
                        freeShippingThreshold: e.target.value,
                      })
                    }
                  title="Free Shipping Threshold"
                  aria-label="Free Shipping Threshold"
                  placeholder="100.00"
                  />
                </div>
                <Button onClick={() => handleSave("shipping", shippingSettings, "Shipping")} className="gap-2" disabled={updateSetting.isPending}>
                  {updateSetting.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Email Settings */}
          <TabsContent value="email" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Email Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">SMTP Host</label>
              <Input value={emailSettings.smtpHost} onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })} title="SMTP Host" aria-label="SMTP Host" placeholder="smtp.example.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">SMTP Port</label>
                <Input value={emailSettings.smtpPort} onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })} title="SMTP Port" aria-label="SMTP Port" placeholder="587" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">SMTP User</label>
                <Input value={emailSettings.smtpUser} onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })} title="SMTP User" aria-label="SMTP User" placeholder="user@example.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">SMTP Password</label>
              <Input type="password" value={emailSettings.smtpPassword} onChange={(e) => setEmailSettings({ ...emailSettings, smtpPassword: e.target.value })} title="SMTP Password" aria-label="SMTP Password" placeholder="********" />
                </div>
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Order Confirmation Emails</label>
                    <Switch 
                      checked={emailSettings.orderConfirmation} 
                      onCheckedChange={(c) => setEmailSettings({ ...emailSettings, orderConfirmation: c })} 
                  title="Order Confirmation Emails"
                  aria-label="Order Confirmation Emails"
                    />
                  </div>
                  {emailSettings.orderConfirmation && (
                    <div className="pl-4 border-l-2 border-border mt-2 mb-4 space-y-2">
                      <label className="block text-xs font-medium text-muted-foreground">Custom Order Message</label>
                      <Textarea 
                        value={emailSettings.orderConfirmationMessage || ""} 
                        onChange={(e) => setEmailSettings({ ...emailSettings, orderConfirmationMessage: e.target.value })}
                        placeholder="Thank you for your order. We are getting your items ready for shipment."
                        rows={2}
                    title="Custom Order Message"
                    aria-label="Custom Order Message"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Shipping Notification Emails</label>
                    <Switch 
                      checked={emailSettings.shippingNotification} 
                      onCheckedChange={(c) => setEmailSettings({ ...emailSettings, shippingNotification: c })} 
                  title="Shipping Notification Emails"
                  aria-label="Shipping Notification Emails"
                    />
                  </div>
                  {emailSettings.shippingNotification && (
                    <div className="pl-4 border-l-2 border-border mt-2 mb-4 space-y-2">
                      <label className="block text-xs font-medium text-muted-foreground">Custom Shipping Message</label>
                      <Textarea 
                        value={emailSettings.shippingNotificationMessage || ""} 
                        onChange={(e) => setEmailSettings({ ...emailSettings, shippingNotificationMessage: e.target.value })}
                        placeholder="Great news! Your order has been shipped and is on its way to you."
                        rows={2}
                    title="Custom Shipping Message"
                    aria-label="Custom Shipping Message"
                      />
                    </div>
                  )}
              
              <div className="flex items-center justify-between pb-3 pt-3">
                <label className="text-sm font-medium">Product Image Width (px)</label>
                <Input 
                  type="number" 
                  value={emailSettings.productImageWidth || "40"} 
                  onChange={(e) => setEmailSettings({ ...emailSettings, productImageWidth: e.target.value })}
                  className="w-24 h-9"
                  title="Product Image Width"
                  placeholder="40"
                />
              </div>

              <div className="flex items-center justify-between pb-3 pt-3 border-t border-border mt-4">
                <label className="text-sm font-medium">Email Background Color</label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={emailSettings.emailBackgroundColor || "#ffffff"} 
                    onChange={(e) => setEmailSettings({ ...emailSettings, emailBackgroundColor: e.target.value })}
                    className="w-16 h-9 p-1"
                  />
                  <Input 
                    type="text" 
                    value={emailSettings.emailBackgroundColor || "#ffffff"} 
                    onChange={(e) => setEmailSettings({ ...emailSettings, emailBackgroundColor: e.target.value })}
                    className="w-24 h-9"
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pb-3 pt-3 border-t border-border mt-4">
                <label className="text-sm font-medium">Email Button Color</label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={emailSettings.emailButtonColor || "#3b82f6"} 
                    onChange={(e) => setEmailSettings({ ...emailSettings, emailButtonColor: e.target.value })}
                    className="w-16 h-9 p-1"
                  />
                  <Input 
                    type="text" 
                    value={emailSettings.emailButtonColor || "#3b82f6"} 
                    onChange={(e) => setEmailSettings({ ...emailSettings, emailButtonColor: e.target.value })}
                    className="w-24 h-9"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Abandoned Checkout Reminders (after 24h)</label>
                    <Switch 
                      checked={emailSettings.abandonedCartReminder} 
                      onCheckedChange={(c) => setEmailSettings({ ...emailSettings, abandonedCartReminder: c })} 
                  title="Abandoned Cart Reminder Emails"
                  aria-label="Abandoned Cart Reminder Emails"
                    />
                  </div>
                </div>
                <Button onClick={() => handleSave("email", emailSettings, "Email")} className="gap-2" disabled={updateSetting.isPending}>
                  {updateSetting.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Security Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                  <label className="text-sm font-medium">
                    Two-Factor Authentication
                  </label>
                  <Switch 
                    checked={securitySettings.twoFactorAuth} 
                    onCheckedChange={(c) => setSecuritySettings({ ...securitySettings, twoFactorAuth: c })} 
                title="Two-Factor Authentication"
                aria-label="Two-Factor Authentication"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Login Attempt Limit
                  </label>
                  <Input
                    type="number"
                    value={securitySettings.loginAttemptLimit}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, loginAttemptLimit: e.target.value })}
                title="Login Attempt Limit"
                aria-label="Login Attempt Limit"
                placeholder="5"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                  <label className="text-sm font-medium">Enable CAPTCHA</label>
                  <Switch 
                    checked={securitySettings.captchaEnabled} 
                    onCheckedChange={(c) => setSecuritySettings({ ...securitySettings, captchaEnabled: c })} 
                title="Enable CAPTCHA"
                aria-label="Enable CAPTCHA"
                  />
                </div>
                <div className="border-t border-border pt-6 mt-6">
                  <h4 className="font-medium mb-3">Google OAuth Login</h4>
                  <div className="space-y-3">
                    <Input
                      placeholder="Google Client ID"
                      value={securitySettings.googleClientId || ""}
                      onChange={(e) => setSecuritySettings({ ...securitySettings, googleClientId: e.target.value })}
                    />
                    <Input
                      placeholder="Google Client Secret"
                      type="password"
                      value={securitySettings.googleClientSecret || ""}
                      onChange={(e) => setSecuritySettings({ ...securitySettings, googleClientSecret: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave these blank to use the .env fallbacks or disable Google Login entirely.
                    </p>
                  </div>
                </div>
                <div className="border-t border-border pt-6 mt-6">
                  <h4 className="font-medium mb-3">Facebook OAuth Login</h4>
                  <div className="space-y-3">
                    <Input
                      placeholder="Facebook App ID"
                      value={securitySettings.facebookAppId || ""}
                      onChange={(e) => setSecuritySettings({ ...securitySettings, facebookAppId: e.target.value })}
                    />
                    <Input
                      placeholder="Facebook App Secret"
                      type="password"
                      value={securitySettings.facebookAppSecret || ""}
                      onChange={(e) => setSecuritySettings({ ...securitySettings, facebookAppSecret: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave these blank to use the .env fallbacks or disable Facebook Login entirely.
                    </p>
                  </div>
                </div>
                <Button onClick={() => handleSave("security", securitySettings, "Security")} className="gap-2" disabled={updateSetting.isPending}>
                  {updateSetting.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Social Media Settings */}
          <TabsContent value="social" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Social Media Links</h3>
              <div className="space-y-4">
                {Object.entries(socialSettings).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium mb-2 capitalize">
                      {key}
                    </label>
                    <Input
                      value={value}
                      onChange={(e) =>
                        setSocialSettings({
                          ...socialSettings,
                          [key]: e.target.value,
                        })
                      }
                    title={`${key} Link`}
                    aria-label={`${key} Link`}
                    placeholder={`https://${key}.com/yourstore`}
                    />
                  </div>
                ))}
                <Button onClick={() => handleSave("social", socialSettings, "Social")} className="gap-2" disabled={updateSetting.isPending}>
                  {updateSetting.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Backup Settings */}
          <TabsContent value="backup" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Backup & System</h3>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Create and manage database backups
                </p>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full" onClick={() => {
                    handleDownloadBackup();
                    toast.success("Manual backup triggered");
                  }}>
                    Create Manual Backup
                  </Button>
                  <Button variant="outline" className="w-full" onClick={handleDownloadBackup}>
                    Download Latest Backup
                  </Button>
                </div>
                <div className="border-t border-border pt-4">
                  <h4 className="font-medium mb-3">Auto Backup Schedule</h4>
                  <Select
                    value={backupSettings.schedule}
                    onValueChange={(val) => {
                      const updated = { schedule: val };
                      setBackupSettings(updated);
                      handleSave("backup", updated, "Backup");
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
