// This file is part of the laptop-store project.
// Licensed under the MIT License.

import { trpc } from "@/lib/trpc";
import { Cpu, Mail, MapPin, Phone, Facebook, Instagram, Twitter, Youtube, Linkedin } from "lucide-react";
import { Link } from "wouter";

function TiktokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

export default function Footer() {
  const { data: settings } = trpc.settings.public.useQuery({ keys: ["general", "appearance", "social"] });
  
  const general = settings?.general || {};
  const appearance = settings?.appearance || {};
  const social = settings?.social || {};
  
  const storeName = general.storeName || (typeof localStorage !== 'undefined' ? localStorage.getItem("store_name_cache") : null) || "Store";
  const storeDesc = general.storeDescription || "Your premier destination for cutting-edge computers, laptops, and accessories. Quality hardware for every need.";
  const address = general.address || "123 Innovation Drive, Suite 100, Tech City";
  const phone = general.phone || "+1 (555) 123-4567";
  const email = general.contactEmail || "support@company.com";
  const logoUrl = appearance.logoUrl ?? (typeof localStorage !== 'undefined' ? localStorage.getItem("store_logo_cache") : null);
  
  const socialLinks = [
    { id: "twitter", url: social.twitter },
    { id: "facebook", url: social.facebook },
    { id: "instagram", url: social.instagram },
    { id: "youtube", url: social.youtube },
    { id: "linkedin", url: social.linkedin },
    { id: "tiktok", url: social.tiktok },
  ].filter(s => s.url);

  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="container py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              {logoUrl && (
                <img src={logoUrl} alt={storeName} className="h-8 object-contain" />
              )}
              <span className="font-display font-bold text-lg tracking-tight">
                {storeName}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {storeDesc}
            </p>
            <div className="flex gap-3">
              {socialLinks.map((s) => {
                let Icon = null;
                switch (s.id) {
                  case 'facebook': Icon = Facebook; break;
                  case 'instagram': Icon = Instagram; break;
                  case 'twitter': Icon = Twitter; break;
                  case 'youtube': Icon = Youtube; break;
                  case 'linkedin': Icon = Linkedin; break;
                  case 'tiktok': Icon = TiktokIcon; break;
                }
                return (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-md bg-muted hover:bg-[var(--brand)] hover:text-white flex items-center justify-center text-muted-foreground transition-all duration-300 hover:scale-110 hover:-translate-y-1 hover:shadow-md"
                  >
                    <span className="sr-only">{s.id}</span>
                    {Icon ? <Icon className="w-4 h-4" /> : <div className="w-4 h-4 rounded-sm bg-current opacity-60" />}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Shop */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-sm">Shop</h4>
            <ul className="space-y-2.5">
              {[
                { label: "About Us", href: "/about" },
                { label: "All Products", href: "/products" },
                { label: "Laptops", href: "/products?category=laptops" },
                { label: "Desktops", href: "/products?category=desktops" },
                { label: "Accessories", href: "/products?category=accessories" },
                { label: "Deals & Offers", href: "/products?featured=true" },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-[var(--brand)] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-sm">Account</h4>
            <ul className="space-y-2.5">
              {[
                { label: "My Dashboard", href: "/dashboard" },
                { label: "My Orders", href: "/dashboard/orders" },
                { label: "Track Order", href: "/track-order" },
                { label: "Saved Addresses", href: "/dashboard/addresses" },
                { label: "Account Settings", href: "/dashboard" },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-[var(--brand)] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-sm">Contact</h4>
            <ul className="space-y-3">
              <li className="text-sm text-muted-foreground">
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2.5 hover:text-[var(--brand)] transition-colors">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[var(--brand)]" />
                  <span>{address}</span>
                </a>
              </li>
              <li className="text-sm text-muted-foreground">
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2.5 hover:text-[var(--brand)] transition-colors">
                  <Phone className="w-4 h-4 shrink-0 text-[var(--brand)]" />
                  <span>{phone}</span>
                </a>
              </li>
              <li className="text-sm text-muted-foreground">
                <a href={`mailto:${email}`} className="flex items-center gap-2.5 hover:text-[var(--brand)] transition-colors">
                  <Mail className="w-4 h-4 shrink-0 text-[var(--brand)]" />
                  <span>{email}</span>
                </a>
              </li>
            </ul>
            <div className="pt-2">
              <div className="space-y-1">
                {(general.openingHours || [
                  { label: "Mon - Fri", value: "9:00 AM - 8:00 PM" },
                  { label: "Saturday", value: "10:00 AM - 6:00 PM" },
                ]).map((hour: any, idx: number) => (
                  <p key={idx} className="text-xs text-muted-foreground">
                    <span className="font-medium">{hour.label}:</span> {hour.value}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {storeName}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
              <Link key={item} href={`/legal/${item.toLowerCase().replace(/ /g, '-')}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
