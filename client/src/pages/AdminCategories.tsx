import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Plus, Edit2, Trash2, Image as ImageIcon, Loader2, GripVertical, Upload, X, Zap, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function AdminCategories() {
  const { data: categories, isLoading } = trpc.categories.list.useQuery();
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [orderedCategories, setOrderedCategories] = useState<any[]>([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (categories) {
      setOrderedCategories([...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    }
  }, [categories]);

  const createPresignedUrl = trpc.admin.createPresignedUrl.useMutation();

  const upsertCategory = trpc.admin.upsertCategory.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      closeForm();
      toast.success("Category saved!");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteCategory = trpc.admin.deleteCategory.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      toast.success("Category deleted!");
    },
    onError: (err) => toast.error(err.message),
  });

  const reorderCategories = trpc.admin.reorderCategories.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
    },
  });

  const openForm = (category?: any) => {
    if (category) {
      setFormData({ ...category });
    } else {
      setFormData({ name: "", slug: "", description: "", imageUrl: "", featured: false, active: true, parentId: null });
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData({});
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    try {
      const toastId = toast.loading(`Uploading ${file.name}...`);
      const { uploadUrl, publicUrl } = await createPresignedUrl.mutateAsync({ filename: file.name, contentType: file.type });
      
      if (uploadUrl && publicUrl) {
        const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!res.ok) throw new Error("S3 Upload Failed");
        setFormData((prev: any) => ({ ...prev, imageUrl: publicUrl }));
        toast.success("Image uploaded successfully!", { id: toastId });
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          setFormData((prev: any) => ({ ...prev, imageUrl: event.target?.result as string }));
          toast.success("Image processed locally!", { id: toastId });
        };
        reader.readAsDataURL(file);
      }
    } catch (err) { toast.error("Failed to upload image."); }
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Name is required");

    upsertCategory.mutate({
      id: formData.id,
      name: formData.name,
      slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      description: formData.description || undefined,
      imageUrl: formData.imageUrl || undefined,
      featured: formData.featured,
      active: formData.active ?? true,
      parentId: formData.parentId,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this category? Products assigned to it might lose their category reference!")) {
      deleteCategory.mutate({ id });
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    // By setting the dragged index inside a setTimeout, the browser captures the 
    // normal card for the cursor "drag ghost", but instantly styles the spot 
    // left behind as a dashed placeholder!
    setTimeout(() => setDraggedItemIndex(index), 0);
  };

  const handleDragEnter = (index: number) => {
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newOrdered = [...orderedCategories];
    const draggedItem = newOrdered[draggedItemIndex];
    newOrdered.splice(draggedItemIndex, 1);
    newOrdered.splice(index, 0, draggedItem);
    setDraggedItemIndex(index);
    setOrderedCategories(newOrdered);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    const ids = orderedCategories.map(c => c.id);
    reorderCategories.mutate({ ids });
  };

  return (
    <AdminLayout activeTab="categories">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Categories Management</h2>
            <p className="text-muted-foreground mt-1">
              Organize your products into categories
            </p>
          </div>
          <Button onClick={() => openForm()} className="gap-2 bg-[var(--brand)] text-white hover:opacity-90">
            <Plus size={18} />
            Add Category
          </Button>
        </div>

        {/* Categories Grid */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orderedCategories.map((cat, index) => (
              <Card 
                key={cat.id} 
                className={`p-4 flex flex-col cursor-move transition-all duration-300 ${
                  draggedItemIndex === index 
                    ? "opacity-40 border-2 border-dashed border-[var(--brand)] bg-muted scale-[0.98] shadow-inner" 
                : "hover:border-[var(--brand)]/50 shadow-sm"
            } ${cat.active === false ? "opacity-60 bg-muted/30" : ""}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
              >
                <div className="flex items-center justify-between mb-2 opacity-50">
                  <GripVertical size={16} />
                  <span className="text-xs font-mono">Order: {index + 1}</span>
                </div>
                <div className="aspect-[2/1] bg-secondary rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                  {cat.imageUrl ? (
                    <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={40} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                {cat.parentId && <span className="text-muted-foreground font-normal text-lg">↳</span>}
                    <h3 className="font-semibold text-lg">{cat.name}</h3>
                    {cat.featured && <Badge variant="secondary" className="text-[10px] py-0 h-5 bg-[var(--brand)]/10 text-[var(--brand)] hover:bg-[var(--brand)]/20 border-[var(--brand)]/20"><Zap className="w-3 h-3 mr-1" /> Featured</Badge>}
                {cat.active === false && <Badge variant="secondary" className="text-[10px] py-0 h-5"><EyeOff className="w-3 h-3 mr-1" /> Hidden</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mb-2">/{cat.slug}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{cat.description || "No description provided."}</p>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => openForm(cat)}>
                    <Edit2 size={16} /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(cat.id)} className="text-destructive hover:bg-destructive/10">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </Card>
            ))}
            {categories?.length === 0 && <p className="col-span-full text-center text-muted-foreground py-10">No categories found</p>}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg shadow-xl">
              <form onSubmit={handleSave} className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">
                    {formData.id ? "Edit Category" : "Add Category"}
                  </h3>
                  <Button type="button" variant="ghost" size="sm" onClick={closeForm}>✕</Button>
                </div>
                <div className="space-y-4">
              <div className="space-y-2">
                <Label>Parent Category</Label>
                <Select value={formData.parentId ? String(formData.parentId) : "none"} onValueChange={(val) => setFormData({ ...formData, parentId: val === "none" ? null : parseInt(val) })}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="None (Top Level Category)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Top Level Category)</SelectItem>
                    {categories?.filter(c => c.id !== formData.id && !(c as any).parentId).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">
                  <strong>Tip:</strong> Leave this as "None" to make this a Top-Level (Parent) Category. Select an existing category to nest this as a Sub-Category.
                </p>
              </div>
                  <div className="space-y-2"><Label>Category Name *</Label><Input required value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Laptops" /></div>
                  <div className="space-y-2"><Label>Slug (URL friendly)</Label><Input value={formData.slug || ""} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="e.g. laptops (auto-generated if empty)" /></div>
                  <div className="space-y-2">
                    <Label>Category Image</Label>
                    <div 
                      className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors relative"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        className="hidden" 
                        ref={fileInputRef} 
                        accept="image/*" 
                        onChange={handleFileUpload} 
                      />
                      {formData.imageUrl ? (
                        <div className="relative w-full h-32">
                          <img src={formData.imageUrl} alt="Category preview" className="w-full h-full object-cover rounded-md" />
                          <Button 
                            type="button"
                            variant="destructive" 
                            size="icon" 
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, imageUrl: "" }); }}
                          >
                            <X size={12} />
                          </Button>
                        </div>
                      ) : (
                        <div className="py-2">
                          <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to upload image</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG up to 2MB</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <Label className="cursor-pointer">Featured on Homepage</Label>
                    <Switch checked={formData.featured} onCheckedChange={(c) => setFormData({ ...formData, featured: c })} />
                  </div>
              <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <Label className="cursor-pointer">Active (Visible)</Label>
                <Switch checked={formData.active ?? true} onCheckedChange={(c) => setFormData({ ...formData, active: c })} />
              </div>
                  <div className="space-y-2"><Label>Description</Label><Textarea value={formData.description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Category description" rows={3}/></div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
                  <Button type="submit" disabled={upsertCategory.isPending} className="bg-[var(--brand)] text-white hover:opacity-90 min-w-24">
                    {upsertCategory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}