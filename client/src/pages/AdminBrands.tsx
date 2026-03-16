import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

export default function AdminBrands() {
  const { data: dbBrands, isLoading } = trpc.admin.getSetting.useQuery({ key: "brands" });
  const updateSetting = trpc.admin.updateSetting.useMutation();
  const utils = trpc.useUtils();

  // Default fallback if no brands are saved yet
  const defaultBrands = ["Samsung", "Dell", "HP", "Lenovo", "Asus"];
  const [brands, setBrands] = useState<string[]>(defaultBrands);
  const [newBrand, setNewBrand] = useState("");

  useEffect(() => {
    if (dbBrands && Array.isArray(dbBrands)) {
      setBrands(dbBrands);
    }
  }, [dbBrands]);

  const handleSave = async (updatedBrands: string[]) => {
    try {
      await updateSetting.mutateAsync({ key: "brands", value: updatedBrands });
      utils.admin.getSetting.invalidate({ key: "brands" });
      utils.settings.public.invalidate();
      toast.success("Brands updated successfully");
    } catch (error) {
      toast.error("Failed to update brands");
    }
  };

  const addBrand = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBrand.trim();
    if (!trimmed) return;
    
    if (brands.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
      return toast.error("This brand already exists");
    }
    
    const updated = [...brands, trimmed];
    setBrands(updated);
    setNewBrand("");
    handleSave(updated);
  };

  const removeBrand = (brandToRemove: string) => {
    if (!confirm(`Are you sure you want to remove ${brandToRemove}?`)) return;
    const updated = brands.filter(b => b !== brandToRemove);
    setBrands(updated);
    handleSave(updated);
  };

  return (
    <AdminLayout activeTab="brands">
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-3xl font-bold">Brands Management</h2>
          <p className="text-muted-foreground mt-1">
            Add or remove brands that customers can filter by on the products page.
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={addBrand} className="flex gap-3 mb-8">
            <Input placeholder="E.g. Apple, Acer, MSI..." value={newBrand} onChange={(e) => setNewBrand(e.target.value)} className="max-w-xs" />
            <Button type="submit" disabled={!newBrand.trim() || updateSetting.isPending} className="gap-2 bg-[var(--brand)] text-white hover:opacity-90">
              <Plus size={16} /> Add Brand
            </Button>
          </form>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {brands.map((brand) => (
                <div key={brand} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card hover:border-[var(--brand)]/30 transition-colors">
                  <div className="flex items-center gap-2 font-medium"><Tag size={16} className="text-[var(--brand)]" />{brand}</div>
                  <Button variant="ghost" size="icon" onClick={() => removeBrand(brand)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 size={16} /></Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}