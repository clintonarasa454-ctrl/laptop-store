import { useState, useEffect, useMemo } from "react";
import { getCompareList, toggleCompare } from "@/lib/ux";
import { X, Scale, Trash2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { formatPrice } from "@/lib/cart";
import { trpc } from "@/lib/trpc";

export default function CompareWidget() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"specs" | "ai">("specs");
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const generateComparison = trpc.products.generateComparison.useMutation();

  useEffect(() => {
    const update = () => setItems(getCompareList());
    update();
    window.addEventListener("compareUpdated", update);
    return () => window.removeEventListener("compareUpdated", update);
  }, []);

  // Fetch AI comparison when tab changes to 'ai'
  useEffect(() => {
    if (tab === "ai" && !aiAnalysis && !isLoadingAI && items.length > 0) {
      loadAIComparison();
    }
  }, [tab]);

  const loadAIComparison = async () => {
    setIsLoadingAI(true);
    try {
      const result = await generateComparison.mutateAsync({
        products: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          brand: item.brand,
          specifications: item.specifications || {},
        })),
      });
      
      // Format the analysis object into a readable string
      const analysis = result.analysis;
      let formattedText = "";
      
      if (typeof analysis === 'string') {
        formattedText = analysis;
      } else if (analysis && typeof analysis === 'object') {
        const parts = [];
        if (analysis.quickVerdict) parts.push(`Quick Verdict:\n${analysis.quickVerdict}\n`);
        if (analysis.keyDifferences) parts.push(`Key Differences:\n${analysis.keyDifferences}\n`);
        if (analysis.recommendation) parts.push(`Recommendation:\n${analysis.recommendation}`);
        formattedText = parts.join("\n");
      }
      
      setAiAnalysis(formattedText || "Analysis complete.");
    } catch (error) {
      console.error("Failed to generate AI comparison:", error);
      setAiAnalysis("Failed to generate comparison analysis. Please try again.");
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Extract all unique spec keys across all compared products
  const specKeys = useMemo(() => {
    const allSpecs = new Set<string>();
    items.forEach(item => {
      if (item.specifications) {
        Object.keys(item.specifications).forEach(k => allSpecs.add(k));
      }
    });
    return Array.from(allSpecs);
  }, [items]);

  if (items.length === 0) {
    if (open) setOpen(false);
    return null;
  }

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
                  <button onClick={() => toggleCompare(item)} title="Remove from comparison" aria-label={`Remove ${item.name} from comparison`} className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center overflow-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-border flex justify-between items-center bg-muted/30 flex-shrink-0">
              <h2 className="text-xl font-display font-bold flex items-center gap-2"><Scale className="w-5 h-5 text-[var(--brand)]" /> Product Comparison</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="w-5 h-5" /></Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-border px-5 bg-card flex-shrink-0" role="tablist" aria-label="Comparison Views">
              <button
                role="tab"
                aria-selected={tab === "specs"}
                onClick={() => setTab("specs")}
                className={`px-5 py-3 font-semibold border-b-2 transition-colors ${tab === "specs"
                    ? "text-[var(--brand)] border-[var(--brand)]"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
              >
                Specifications
              </button>
              <button
                role="tab"
                aria-selected={tab === "ai"}
                onClick={() => setTab("ai")}
                className={`px-5 py-3 font-semibold border-b-2 transition-colors flex items-center gap-2 ${tab === "ai"
                    ? "text-[var(--brand)] border-[var(--brand)]"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
              >
                <Sparkles className="w-4 h-4" /> AI Analysis
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
              {tab === "specs" ? (
                // Specifications Table
                <div className="relative">
                  <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr>
                        <th className="p-4 border-b border-r border-border bg-muted/30 w-48 sticky left-0 top-0 z-20 shadow-[1px_0_0_var(--border)]" />
                        {items.map(item => (
                          <th key={item.id} className="p-5 border-b border-border min-w-[250px] align-top bg-card relative group">
                            <button onClick={() => toggleCompare(item)} className="absolute top-2 right-2 p-1.5 bg-destructive/10 text-destructive rounded-md opacity-0 group-hover:opacity-100 transition-opacity" title="Remove from comparison" aria-label={`Remove ${item.name} from comparison`}><Trash2 className="w-4 h-4" /></button>
                            <img src={item.images?.[0] || "/assets/placeholder.png"} className="w-32 h-32 object-contain mb-4 mx-auto" alt={item.name} />
                            <p className="font-semibold text-base mb-1 text-foreground line-clamp-2">{item.name}</p>
                            <p className="font-bold text-lg text-[var(--brand)]">{formatPrice(item.price)}</p>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-muted/10">
                        <td className="p-4 border-b border-r border-border font-semibold bg-muted/30 sticky left-0 z-10 shadow-[1px_0_0_var(--border)]">Brand</td>
                        {items.map(item => <td key={item.id} className="p-4 border-b border-border font-medium">{item.brand || "—"}</td>)}
                      </tr>
                      {specKeys.map(key => (
                        <tr key={key} className="hover:bg-muted/30">
                          <td className="p-4 border-b border-r border-border font-semibold bg-muted/10 sticky left-0 z-10 shadow-[1px_0_0_var(--border)] capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</td>
                          {items.map(item => (
                            <td key={item.id} className="p-4 border-b border-border text-foreground whitespace-normal break-words">
                              {item.specifications?.[key] ? (String(item.specifications[key]).length > 100 ? String(item.specifications[key]).substring(0, 100) + "..." : String(item.specifications[key])) : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                // AI Analysis Tab
                <div className="p-8">
                  {isLoadingAI ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                      <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
                      <p className="text-muted-foreground">Analyzing products with AI...</p>
                    </div>
                  ) : (
                    <div className="space-y-6 max-w-4xl">
                      <div className="bg-gradient-to-r from-[var(--brand)]/10 to-transparent p-6 rounded-lg border border-[var(--brand)]/20">
                        <div className="flex items-start gap-3 mb-4">
                          <Sparkles className="w-5 h-5 text-[var(--brand)] flex-shrink-0 mt-1" />
                          <h3 className="font-semibold text-lg">AI Product Analysis</h3>
                        </div>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <div className="text-foreground whitespace-pre-wrap leading-relaxed">
                            {aiAnalysis}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={loadAIComparison}
                          variant="outline"
                          className="gap-2"
                        >
                          <Sparkles className="w-4 h-4" /> Refresh Analysis
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}