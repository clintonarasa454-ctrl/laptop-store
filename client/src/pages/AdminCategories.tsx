import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Plus, Edit2, Trash2, Image as ImageIcon, Loader2, Upload, X, Zap, EyeOff, ChevronUp, ChevronDown, Layers, Package } from "lucide-react";
import { dynamicIconMap } from "@/lib/iconMap";
import { toast } from "sonner";

export default function AdminCategories() {
  const { data: categories, isLoading } = trpc.categories.list.useQuery();
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [orderedCategories, setOrderedCategories] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootCategories = orderedCategories.filter(c => !c.parentId);
  
  const iconOptions = ["Package", "Monitor", "Cpu", "Headphones", "Mouse", "Keyboard", "Smartphone", "Tablet", "Speaker", "Printer", "Camera", "Gamepad2", "Tv", "HardDrive", "BatteryCharging", "Cable", "Wifi", "Bluetooth"];

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

  const openForm = (category?: any, prefillParentId?: number) => {
    if (category) {
      setFormData({ ...category });
    } else {
      setFormData({ name: "", slug: "", description: "", imageUrl: "", icon: "", featured: false, active: true, parentId: prefillParentId || null });
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

    let toastId: string | number | undefined;
    try {
      toastId = toast.loading(`Uploading ${file.name}...`);
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
    } catch (err) { toast.error("Failed to upload image.", { id: toastId }); }
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Name is required");

    upsertCategory.mutate({
      id: formData.id,
      name: formData.name,
      slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      description: formData.description === "" ? null : formData.description,
      imageUrl: formData.imageUrl === "" ? null : formData.imageUrl,
      icon: formData.icon === "" || formData.icon === "none" ? null : formData.icon,
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

  const moveCategory = (index: number, direction: 'up' | 'down', siblingList: any[]) => {
    const newSiblings = [...siblingList];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSiblings.length) return;

    // Swap items
    const temp = newSiblings[index];
    newSiblings[index] = newSiblings[targetIndex];
    newSiblings[targetIndex] = temp;

    // Rebuild global ID array to send to backend while maintaining parent/child groupings
    const allIds: number[] = [];
    const isRootLevel = !siblingList[0].parentId;
    const rootList = isRootLevel ? newSiblings : rootCategories;
    
    rootList.forEach(root => {
      allIds.push(root.id);
      const children = root.id === siblingList[0]?.parentId 
        ? newSiblings 
        : orderedCategories.filter(c => c.parentId === root.id);
      children.forEach(child => allIds.push(child.id));
    });

    // Optimistically update the UI instantly
    setOrderedCategories(prev => {
      return [...prev].sort((a, b) => allIds.indexOf(a.id) - allIds.indexOf(b.id));
    });

    reorderCategories.mutate({ ids: allIds });
  };

  return (
    <AdminLayout activeTab="categories">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Categories Management</h2>
            <p className="text-muted-foreground mt-1">
              Organize your products into nested parent and sub-categories
            </p>
          </div>
          <Button onClick={() => openForm()} className="gap-2 bg-[var(--brand)] text-white hover:opacity-90">
            <Plus size={18} />
            Add Parent Category
          </Button>
        </div>

        {/* Grouped Categories Layout */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" /></div>
        ) : (
          <div className="space-y-6">
            {rootCategories.map((parent, pIndex) => {
              const children = orderedCategories.filter(c => c.parentId === parent.id);
              return (
                <div key={parent.id} className={`bg-card border border-border rounded-xl overflow-hidden shadow-sm transition-all ${parent.active === false ? "opacity-75" : "hover:border-[var(--brand)]/40"}`}>
                  {/* Parent Header Row */}
                  <div className="p-4 sm:p-5 bg-muted/30 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-0.5">
                        <Button type="button" variant="ghost" size="icon" className="h-5 w-6 text-muted-foreground hover:text-foreground" disabled={pIndex === 0} onClick={() => moveCategory(pIndex, 'up', rootCategories)} title="Move up" aria-label="Move up"><ChevronUp size={14}/></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-5 w-6 text-muted-foreground hover:text-foreground" disabled={pIndex === rootCategories.length - 1} onClick={() => moveCategory(pIndex, 'down', rootCategories)} title="Move down" aria-label="Move down"><ChevronDown size={14}/></Button>
                      </div>
                      <div className="w-14 h-14 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        {parent.imageUrl ? <img src={parent.imageUrl} className="w-full h-full object-cover" /> : <Layers className="text-muted-foreground opacity-50 w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-lg font-bold">{parent.name}</h3>
                          {parent.featured && <Badge variant="secondary" className="text-[10px] py-0 h-5 bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/20"><Zap className="w-3 h-3 mr-1" /> Featured</Badge>}
                          {parent.active === false && <Badge variant="secondary" className="text-[10px] py-0 h-5"><EyeOff className="w-3 h-3 mr-1" /> Hidden</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">/{parent.slug}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{parent.description || "No description provided."}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 ml-10 sm:ml-0">
                      <Button size="sm" variant="secondary" className="bg-[var(--brand)]/10 text-[var(--brand)] hover:bg-[var(--brand)]/20" onClick={() => openForm(undefined, parent.id)}>
                        <Plus size={16} className="mr-1" /> Add Sub-category
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openForm(parent)}>
                        <Edit2 size={16} className="mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(parent.id)} title="Delete category" aria-label="Delete category">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>

                  {/* Nested Sub-Categories Grid */}
                  {children.length > 0 ? (
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-background">
                      {children.map((child, cIndex) => (
                        <Card key={child.id} className={`p-4 flex flex-col transition-all hover:border-[var(--brand)]/40 hover:shadow-md ${child.active === false ? "opacity-60 bg-muted/30" : ""}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border/50">
                              {child.imageUrl ? <img src={child.imageUrl} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-muted-foreground opacity-50" />}
                            </div>
                            <div className="flex gap-0.5 bg-muted/50 rounded-md p-0.5">
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground" disabled={cIndex === 0} onClick={() => moveCategory(cIndex, 'up', children)} title="Move up" aria-label="Move up"><ChevronUp size={14}/></Button>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground" disabled={cIndex === children.length - 1} onClick={() => moveCategory(cIndex, 'down', children)} title="Move down" aria-label="Move down"><ChevronDown size={14}/></Button>
                            </div>
                          </div>
                          <div className="flex-1 mb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-base">{child.name}</h4>
                              {child.active === false && <Badge variant="secondary" className="text-[10px] py-0 h-4 px-1"><EyeOff className="w-3 h-3" /></Badge>}
                            </div>
                            <p className="text-xs font-mono text-muted-foreground mb-2">/{child.slug}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">{child.description || "No description."}</p>
                          </div>
                          <div className="flex gap-2 pt-3 border-t border-border mt-auto">
                            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={() => openForm(child)}>
                              <Edit2 size={14} /> Edit
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => handleDelete(child.id)} title="Delete sub-category" aria-label="Delete sub-category">
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-sm text-muted-foreground bg-background">
                      No sub-categories yet. Click "Add Sub-category" above to create one.
                    </div>
                  )}
                </div>
              );
            })}
            
            {rootCategories.length === 0 && (
              <div className="text-center py-20 bg-card border border-border rounded-xl border-dashed">
                <Layers className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="font-medium text-lg">No categories found</p>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Create your first parent category to start organizing your products.</p>
                <Button onClick={() => openForm()} className="bg-[var(--brand)] text-white hover:opacity-90">
                  <Plus size={16} className="mr-2" /> Add Parent Category
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg shadow-xl overflow-y-auto max-h-[90vh]">
              <form onSubmit={handleSave} className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">
                    {formData.id ? "Edit Category" : formData.parentId ? "Add Sub-Category" : "Add Parent Category"}
                  </h3>
                  <Button type="button" variant="ghost" size="sm" onClick={closeForm} title="Close" aria-label="Close">✕</Button>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/40 border border-border rounded-xl mb-6">
                    <Label className="text-sm font-semibold mb-3 block text-foreground">Hierarchy Placement</Label>
                    <RadioGroup
                      value={formData.parentId === null ? "top" : "sub"}
                      onValueChange={(val) => {
                        if (val === "top") setFormData({ ...formData, parentId: null });
                        else setFormData({ ...formData, parentId: rootCategories[0]?.id || null });
                      }}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="top" id="top" />
                        <Label htmlFor="top" className="cursor-pointer font-medium text-sm">Top-Level (Parent)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sub" id="sub" disabled={rootCategories.length === 0} />
                        <Label htmlFor="sub" className={`cursor-pointer font-medium text-sm ${rootCategories.length === 0 ? 'opacity-50' : ''}`}>Sub-Category</Label>
                      </div>
                    </RadioGroup>
                    
                    {formData.parentId !== null && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <Label className="text-xs text-muted-foreground mb-2 block">Assign to Parent</Label>
                        <Select value={String(formData.parentId)} onValueChange={(val) => setFormData({ ...formData, parentId: parseInt(val) })}>
                          <SelectTrigger className="bg-background"><SelectValue placeholder="Choose a parent..." /></SelectTrigger>
                          <SelectContent>
                            {rootCategories.filter(c => c.id !== formData.id).map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2"><Label>Category Name *</Label><Input required value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Laptops" title="Category Name" aria-label="Category Name" /></div>
                  <div className="space-y-2"><Label>Slug (URL friendly)</Label><Input value={formData.slug || ""} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="e.g. laptops (auto-generated if empty)" title="Slug" aria-label="Slug" /></div>
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
                        title="Upload category image"
                        aria-label="Upload category image"
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
                            title="Remove image"
                            aria-label="Remove image"
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
                  <div className="space-y-2">
                    <Label>Category Icon</Label>
                    <Select value={formData.icon || "none"} onValueChange={(val) => setFormData({ ...formData, icon: val === "none" ? null : val })}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select an icon" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Default / None</SelectItem>
                        {iconOptions.map(iconName => {
                          const Icon = dynamicIconMap[iconName];
                          return (
                            <SelectItem key={iconName} value={iconName}>
                              <div className="flex items-center gap-2">
                                {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
                                <span>{iconName}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <Label className="cursor-pointer">Featured on Homepage</Label>
                    <Switch checked={formData.featured} onCheckedChange={(c) => setFormData({ ...formData, featured: c })} title="Featured on Homepage" aria-label="Featured on Homepage" />
                  </div>
              <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <Label className="cursor-pointer">Active (Visible)</Label>
                <Switch checked={formData.active ?? true} onCheckedChange={(c) => setFormData({ ...formData, active: c })} title="Active (Visible)" aria-label="Active (Visible)" />
              </div>
                  <div className="space-y-2"><Label>Description</Label><Textarea value={formData.description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Category description" rows={3} title="Description" aria-label="Description" /></div>
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