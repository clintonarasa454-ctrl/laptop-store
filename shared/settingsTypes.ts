/**
 * Settings Types
 * Defines the structure of all settings keys used in the application
 */

export interface GeneralSettings {
  storeName?: string;
  storeDescription?: string;
  address?: string;
  currency?: string;
  logoUrl?: string;
  heroTitle?: string;
  heroDescription?: string;
  ctaTitle?: string;
  ctaDescription?: string;
  heroBadge?: string;
  floatingBadge1?: { icon: string; title: string; desc: string };
  floatingBadge2?: { icon: string; title: string; desc: string };
  features?: { icon: string; title: string; desc: string }[];
  statsProductCount?: number;
  statsCustomerCount?: number;
  statsAvgRating?: string;
  lifestyles?: { name: string; slug: string; image: string }[];
  openingHours?: { day: string; open: string; close: string }[];
  contactEmail?: string;
}

export interface AppearanceSettings {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
  promoBannerColor?: string;
  emailButtonColor?: string;
  emailBackgroundColor?: string;
}

export interface ShippingSettings {
  freeShippingThreshold?: number | string;
  standardShippingCost?: number | string;
  standardFee?: number | string;
  expressShippingCost?: number | string;
  expressDelivery?: number | string;
  shippingMethod?: string;
}

export interface EmailSettings {
  orderConfirmation?: boolean;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPassword?: string;
  orderConfirmationMessage?: string;
  productImageWidth?: number;
  emailButtonColor?: string;
  emailBackgroundColor?: string;
}

export interface PaymentMethodsSettings {
  paypal?: {
    enabled: boolean;
    mode: "sandbox" | "production";
  };
  mpesa?: {
    enabled: boolean;
    shortCode?: string;
  };
  stripe?: {
    enabled: boolean;
    mode: "test" | "production";
  };
  cod?: {
    enabled: boolean;
  };
}

export interface BrandsSettings {
  [key: number]: string;
}

export interface SocialSettings {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  tiktok?: string;
}

export interface AISettings {
  enabled?: boolean;
  model?: string;
  apiKey?: string;
}

export type SettingsKeys = "general" | "appearance" | "shipping" | "email" | "payment_methods" | "brands" | "social" | "ai" | "ai_knowledge";

export interface SettingsResponse {
  general?: GeneralSettings;
  appearance?: AppearanceSettings;
  shipping?: ShippingSettings;
  email?: EmailSettings;
  payment_methods?: PaymentMethodsSettings;
  brands?: string[];
  social?: SocialSettings;
  ai?: AISettings;
  ai_knowledge?: Record<string, any>;
  [key: string]: any;
}
