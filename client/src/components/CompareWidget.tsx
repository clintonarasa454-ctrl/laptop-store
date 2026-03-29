import { useState, useEffect } from "react";
import { getCompareList, toggleCompare } from "@/lib/ux";
import { X, Scale, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { formatPrice } from "@/lib/cart";

export default function CompareWidget() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setItems(getCompareList());
    update();
    window.addEventListener("compareUpdated", update);
    return () => window.removeEventListener("compareUpdated", update);
  }, []);

  if (items.length === 0) {
    if (open) setOpen(false);
    return null;
  }

  // Extract all unique spec keys across all compared products
  const allSpecs = new Set<string>();
  items.forEach(item => {
    if (item.specifications) {
      Object.keys(item.specifications).forEach(k => allSpecs.add(k));
    }
  });
  const specKeys = Array.from(allSpecs);

  return (
    <>
      {/* Floating Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] bg-card border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-4 flex items-center justify-between animate-in slide-in-from-bottom-full duration-500">
        <div className="container flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="hidden sm:flex items-center gap-2 text-[var(--brand)] font-semibold text-sm">
              <Scale className="w-5 h-5" /> Compare ({items.length}/4)
            </div>
            <div className="flex gap-2">
              {items.map(item => (
                <div key={item.id} className="relative w-12 h-12 rounded-md bg-muted border border-border overflow-hidden group">
                  <img src={item.images?.[0] || "/assets/placeholder.png"} className="w-full h-full object-cover" alt="" />
                  <button onClick={() => toggleCompare(item)} className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {items.length < 4 && (
                <div className="w-12 h-12 rounded-md border-2 border-dashed border-border flex items-center justify-center text-muted-foreground opacity-50">
                  +
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("store_compare_list"); window.dispatchEvent(new Event("compareUpdated")); }}>
              Clear All
            </Button>
            <Button onClick={() => setOpen(true)} className="bg-[var(--brand)] text-white hover:opacity-90 shadow-md">
              Compare Products
            </Button>
          </div>
        </div>
      </div>

      {/* Compare Matrix Modal */}
      {open && (
        <div className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm p-4 sm:p-8 flex flex-col">
          <div className="bg-card border border-border rounded-xl shadow-2xl flex-1 flex flex-col overflow-hidden max-w-7xl mx-auto w-full animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-xl font-display font-bold flex items-center gap-2"><Scale className="w-5 h-5 text-[var(--brand)]" /> Product Specifications</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="w-5 h-5" /></Button>
            </div>
            <div className="flex-1 overflow-auto p-0 relative">
              <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                <thead>
                  <tr>
                    <th className="p-4 border-b border-r border-border bg-muted/30 w-48 sticky left-0 z-20 shadow-[1px_0_0_var(--border)]" />
                    {items.map(item => (
                      <th key={item.id} className="p-5 border-b border-border min-w-[250px] align-top bg-card relative group">
                        <button onClick={() => toggleCompare(item)} className="absolute top-2 right-2 p-1.5 bg-destructive/10 text-destructive rounded-md opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                        <img src={item.images?.[0] || "/assets/placeholder.png"} className="w-32 h-32 object-contain mb-4 mx-auto" />
                        <p className="font-semibold text-base mb-1 text-foreground">{item.name}</p>
                        <p className="font-bold text-lg text-[var(--brand)]">{formatPrice(item.price)}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-muted/10">
                    <td className="p-4 border-b border-r border-border font-semibold bg-muted/30 sticky left-0 z-20 shadow-[1px_0_0_var(--border)]">Brand</td>
                    {items.map(item => <td key={item.id} className="p-4 border-b border-border font-medium">{item.brand || "—"}</td>)}
                  </tr>
                  {specKeys.map(key => (
                    <tr key={key} className="hover:bg-muted/30">
                      <td className="p-4 border-b border-r border-border font-semibold bg-muted/10 sticky left-0 z-20 shadow-[1px_0_0_var(--border)] capitalize">{key}</td>
                      {items.map(item => <td key={item.id} className="p-4 border-b border-border text-muted-foreground">{item.specifications?.[key] || "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}