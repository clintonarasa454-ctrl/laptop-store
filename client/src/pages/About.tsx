import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle } from "lucide-react";
import { dynamicIconMap } from "@/lib/iconMap";
import { useEffect } from "react";

export default function About() {
  const { data: settings } = trpc.settings.public.useQuery({ keys: ["general"] });
  const general = settings?.general || {};
  const storeName = general.storeName || "Store";

  const features = general.features || [
    { icon: "Truck", title: "Free Shipping", desc: "On orders over $500", content: "We offer fast, free standard shipping on all orders over $500. Your items will be securely packaged and delivered right to your doorstep within 3-5 business days." },
    { icon: "Shield", title: "2-Year Warranty", desc: "On all products", content: "Every product we sell is backed by a comprehensive 2-year warranty that covers manufacturer defects and hardware failures." },
    { icon: "RefreshCw", title: "30-Day Returns", desc: "Hassle-free returns", content: "We offer a hassle-free 30-day return policy. Simply return the item in its original condition and packaging for a full refund or exchange." },
    { icon: "Award", title: "Certified Products", desc: "100% authentic hardware", content: "We guarantee that all our products are 100% authentic, brand new, and sourced directly from official manufacturers." },
  ];

  // Smooth scroll to the specific feature if a hash is in the URL (e.g. #feature-1)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const element = document.querySelector(hash);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="container flex-1 py-12 lg:py-20 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="font-display text-4xl lg:text-5xl font-bold mb-4">About {storeName}</h1>
          <p className="text-lg text-muted-foreground">{general.storeDescription || "Your premier destination for cutting-edge technology."}</p>
        </div>
        <div className="space-y-8">
          {features.map((f: any, idx: number) => {
            const Icon = dynamicIconMap[f.icon] || CheckCircle;
            return (
              <div key={idx} id={`feature-${idx}`} className="bg-card border border-border rounded-3xl p-6 md:p-10 flex flex-col md:flex-row items-start gap-6 lg:gap-8 shadow-sm hover:shadow-xl transition-shadow duration-300">
                <div className="w-16 h-16 rounded-2xl bg-[var(--brand)]/10 flex items-center justify-center shrink-0"><Icon className="w-8 h-8 text-[var(--brand)]" /></div>
                <div><h2 className="text-2xl font-bold font-display mb-2">{f.title}</h2><h3 className="text-sm font-medium text-[var(--brand)] mb-4">{f.desc}</h3><p className="text-muted-foreground leading-relaxed text-base">{f.content || "Learn more about our incredible store features and how we prioritize your shopping experience."}</p></div>
              </div>
            );
          })}
        </div>
      </div>
      <Footer />
    </div>
  );
}