import { useState, useRef, useEffect, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, Image as ImageIcon, Loader2, Upload, X, Megaphone, Tag, FileImage, GripVertical, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DeletionRequestModal } from "@/components/DeletionRequestModal";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "./useAuth";

interface BannerFormData {
  id?: number;
  title: string;
  description?: string;
  image: string;
  active: boolean;
}

interface PromotionFormData {
  id?: number;
  title: string;
  description: string;
  active: boolean;
}

interface AnnouncementFormData {
  id?: number;
  title: string;
  content: string;
  date: string;
  linkUrl?: string;
  image?: string;
  active: boolean;
}

export default function AdminContent() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Check authentication status
  useEffect(() => {
    const cookies = document.cookie.split(';');
    const sessionCookie = cookies.find(c => c.trim().startsWith('app_session_id='));
    if (!sessionCookie) {
      console.warn("⚠️ WARNING: app_session_id cookie not found - you may not be logged in!");
      toast.error("Not authenticated - please log in first");
      return;
    }
    console.log("✅ Session cookie found:", sessionCookie.substring(0, 50) + "...");
  }, []);

  // Data Fetching
  const { data: banners, isLoading: loadingBanners } = trpc.admin.banners.useQuery();
  const { data: promotions, isLoading: loadingPromotions } = trpc.admin.promotions.useQuery();
  const { data: announcements, isLoading: loadingAnnouncements } = trpc.admin.announcements.useQuery();

  // Form State
  const [formType, setFormType] = useState<"banner" | "promotion" | "announcement" | null>(null);
  const [formData, setFormData] = useState<BannerFormData | PromotionFormData | AnnouncementFormData | {}>({});
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [orderedBanners, setOrderedBanners] = useState<any[]>([]);
  const [draggedBannerIndex, setDraggedBannerIndex] = useState<number | null>(null);
  const [previousBannerOrder, setPreviousBannerOrder] = useState<any[] | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletionRequest, setDeletionRequest] = useState<{ isOpen: boolean; itemType: "product" | "category" | "banner" | "promotion" | "announcement" | "driver" | "vehicle" | "brand"; itemId: string; itemName: string } | null>(null);

  useEffect(() => {
    if (banners && Array.isArray(banners)) {
      const sorted = [...banners].sort((a, b) => ((a?.order) ?? 0) - ((b?.order) ?? 0));
      setOrderedBanners(sorted);
    }
  }, [banners]);

  const createPresignedUrl = trpc.admin.createPresignedUrl.useMutation();

  // Mutations
  const upsertBanner = trpc.admin.upsertBanner.useMutation({
    onSuccess: () => { utils.admin.banners.invalidate(); closeForm(); toast.success("Banner saved!"); },
    onError: (err) => toast.error(err.message)
  });
  const deleteBanner = trpc.admin.deleteBanner.useMutation({
    onSuccess: () => { utils.admin.banners.invalidate(); toast.success("Banner deleted"); }
  });
  const reorderBanners = trpc.admin.reorderBanners.useMutation({
    onSuccess: () => {
      utils.admin.banners.invalidate();
      setPreviousBannerOrder(null);
      toast.success("Banner order updated");
    },
    onError: () => {
      toast.error("Failed to reorder banners. Reverting...");
      if (previousBannerOrder) {
        setOrderedBanners(previousBannerOrder);
        setPreviousBannerOrder(null);
      }
    },
  });

  const upsertPromotion = trpc.admin.upsertPromotion.useMutation({
    onSuccess: () => { utils.admin.promotions.invalidate(); closeForm(); toast.success("Promotion saved!"); },
    onError: (err) => toast.error(err.message)
  });
  const deletePromotion = trpc.admin.deletePromotion.useMutation({
    onSuccess: () => { utils.admin.promotions.invalidate(); toast.success("Promotion deleted"); }
  });

  const upsertAnnouncement = trpc.admin.upsertAnnouncement.useMutation({
    onSuccess: () => { utils.admin.announcements.invalidate(); closeForm(); toast.success("Announcement saved!"); },
    onError: (err) => toast.error(err.message)
  });
  const deleteAnnouncement = trpc.admin.deleteAnnouncement.useMutation({
    onSuccess: () => { utils.admin.announcements.invalidate(); toast.success("Announcement deleted"); }
  });

  // Handlers
  const openForm = (type: "banner" | "promotion" | "announcement", item?: any) => {
    setFormType(type);
    setFormError(null);
    if (item) {
      const data = { ...item };
      if (type === "announcement" && data.date) {
        data.date = new Date(data.date).toISOString().split('T')[0];
      }
      setFormData(data);
    } else {
      setFormData({ active: true });
    }
  };

  const closeForm = () => {
    setFormType(null);
    setFormData({});
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormError("Please upload a valid image file (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError("Image size should be less than 5MB.");
      return;
    }

    setIsUploading(true);
    setFormError(null);
    const toastId = toast.loading(`Uploading ${file.name}...`);

    // Upload logic with proper error handling
    (async () => {
      try {
        // Request presigned URL from server
        let uploadUrl: string | null = null;
        let publicUrl: string | null = null;

        try {
          const result = await createPresignedUrl.mutateAsync({ filename: file.name, contentType: file.type });
          uploadUrl = result.uploadUrl;
          publicUrl = result.publicUrl;
        } catch (mutationErr) {
          console.error("Presigned URL error:", mutationErr);
          // If mutation fails, still try Base64 fallback
          uploadUrl = null;
          publicUrl = null;
        }

        if (uploadUrl && publicUrl) {
          // S3 upload path
          const res = await fetch(uploadUrl, { 
            method: "PUT", 
            body: file, 
            headers: { "Content-Type": file.type } 
          });
          
          if (!res.ok) {
            throw new Error(`S3 upload failed: ${res.status} ${res.statusText}`);
          }
          
          setFormData((prev: any) => ({ ...prev, image: publicUrl }));
          toast.success("Image uploaded to S3 successfully!", { id: toastId });
          console.log("S3 upload successful:", publicUrl);
        } else {
          // Base64 fallback for local development
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
              const result = event.target?.result as string;
              resolve(result);
            };
            
            reader.onerror = () => {
              reject(new Error("Failed to read file"));
            };
            
            reader.readAsDataURL(file);
          });

          setFormData((prev: any) => ({ ...prev, image: base64 }));
          toast.success("Image uploaded successfully (local)!", { id: toastId });
          console.log("Base64 upload successful, size:", base64.length);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error occurred";
        const errorStr = JSON.stringify(err, null, 2);
        
        // Check for authentication errors
        if (errorMsg.includes("Please login") || errorStr.includes("UNAUTHORIZED")) {
          const suggestion = "Session expired or not logged in. Please refresh and log in again.";
          console.error("❌ AUTHENTICATION ERROR:", { errorMsg, suggestion, fullError: err });
          setFormError(`${errorMsg}\n\n${suggestion}`);
          toast.error(`Authentication failed: ${suggestion}`, { id: toastId });
        } else if (errorMsg.includes("Admin")) {
          console.error("❌ PERMISSION ERROR:", { errorMsg, fullError: err });
          setFormError(`${errorMsg} - You need admin access to upload files`);
          toast.error(`Permission denied: ${errorMsg}`, { id: toastId });
        } else {
          console.error("❌ UPLOAD ERROR:", { errorMsg, fullError: err });
          setFormError(`Upload failed: ${errorMsg}`);
          toast.error(`Failed to upload image: ${errorMsg}`, { id: toastId });
        }
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    })();
  }, [createPresignedUrl]);

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (formType === "banner") {
      if (!(formData as any).image) return toast.error("Banner image is required");
      upsertBanner.mutate(formData as any);
    } else if (formType === "promotion") {
      upsertPromotion.mutate(formData as any);
    } else if (formType === "announcement") {
      upsertAnnouncement.mutate(formData as any);
    }
  };

  const handleDeleteBanner = (id: number) => {
    if (confirm("Delete this banner?")) {
      deleteBanner.mutate({ id });
    }
  };

  const handleDeletePromotion = (id: number) => {
    if (confirm("Delete this promotion?")) {
      deletePromotion.mutate({ id });
    }
  };

  const handleDeleteAnnouncement = (id: number) => {
    if (confirm("Delete this announcement?")) {
      deleteAnnouncement.mutate({ id });
    }
  };

  const handleDragStartBanner = (e: React.DragEvent, index: number) => {
    setTimeout(() => setDraggedBannerIndex(index), 0);
  };

  const handleDragEnterBanner = (index: number) => {
    if (draggedBannerIndex === null || draggedBannerIndex === index) return;
    const newOrdered = [...orderedBanners];
    const draggedItem = newOrdered[draggedBannerIndex];
    newOrdered.splice(draggedBannerIndex, 1);
    newOrdered.splice(index, 0, draggedItem);
    setDraggedBannerIndex(index);
    setOrderedBanners(newOrdered);
  };

  const handleDragEndBanner = () => {
    setDraggedBannerIndex(null);
    // Save previous state in case reorder fails
    if (!previousBannerOrder) {
      setPreviousBannerOrder(banners ? [...banners].sort((a, b) => ((a?.order) ?? 0) - ((b?.order) ?? 0)) : null);
    }
    const ids = orderedBanners.map((b) => b.id);
    reorderBanners.mutate({ ids });
  };

  const isSaving = upsertBanner.isPending || upsertPromotion.isPending || upsertAnnouncement.isPending;

  return (
    <AdminLayout activeTab="content">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold">Content Management</h2>
          <p className="text-muted-foreground mt-1">
            Manage website content, banners, and promotions
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="banners" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="banners" className="data-[state=active]:bg-[var(--brand)] data-[state=active]:text-white">Banners</TabsTrigger>
            <TabsTrigger value="promotions" className="data-[state=active]:bg-[var(--brand)] data-[state=active]:text-white">Promotions</TabsTrigger>
            <TabsTrigger value="announcements" className="data-[state=active]:bg-[var(--brand)] data-[state=active]:text-white">Announcements</TabsTrigger>
          </TabsList>

          {/* Banners Tab */}
          <TabsContent value="banners" className="space-y-4">
            <div className="flex justify-end">
              <Button className="gap-2" onClick={() => openForm("banner")}>
                <Plus size={18} />
                Add Banner
              </Button>
            </div>

            {loadingBanners ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orderedBanners.map((banner, index) => (
                  <Card 
                    key={banner.id} 
                    className={`p-4 border-border cursor-move transition-all duration-300 ${
                      draggedBannerIndex === index 
                        ? "opacity-40 border-2 border-dashed border-[var(--brand)] bg-muted scale-[0.98] shadow-inner" 
                        : !banner.active ? "opacity-60 bg-muted/30 hover:border-[var(--brand)]/50" : "bg-card hover:border-[var(--brand)]/50 hover:shadow-sm"
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStartBanner(e, index)}
                    onDragEnter={() => handleDragEnterBanner(index)}
                    onDragEnd={handleDragEndBanner}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <div className="flex items-center justify-between mb-2 opacity-50">
                      <GripVertical size={16} />
                      <span className="text-xs font-mono">Order: {index + 1}</span>
                    </div>
                    <div className="aspect-[21/9] bg-secondary/50 border border-border/50 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                      {banner.image ? (
                        <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={40} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <h3 className="font-semibold leading-tight line-clamp-2">{banner.title}</h3>
                      <Badge variant={banner.active ? "default" : "secondary"} className={`shrink-0 ${banner.active ? "bg-green-500 hover:bg-green-600" : ""}`}>
                        {banner.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => openForm("banner", banner)}>
                        <Edit2 size={16} />
                        Edit
                      </Button>
                      {(user?.role === "admin" || user?.role === "manager") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (user?.role === "manager") {
                              setDeletionRequest({ isOpen: true, itemType: "banner", itemId: banner.id.toString(), itemName: banner.title });
                            } else {
                              handleDeleteBanner(banner.id);
                            }
                          }}
                          className="text-destructive"
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
                {banners?.length === 0 && (
                  <div className="col-span-2 text-center py-16 text-muted-foreground bg-card border border-border rounded-xl border-dashed">
                    <FileImage className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No banners found</p>
                    <p className="text-sm mt-1">Create your first banner to highlight special offers.</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Promotions Tab */}
          <TabsContent value="promotions" className="space-y-4">
            <div className="flex justify-end">
              <Button className="gap-2" onClick={() => openForm("promotion")}>
                <Plus size={18} />
                Add Promotion
              </Button>
            </div>

            {loadingPromotions ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="space-y-4">
                  {promotions?.map((promo) => (
                    <div key={promo.id} className={`flex items-start justify-between p-5 border border-border bg-card hover:border-[var(--brand)]/30 transition-colors rounded-xl ${!promo.active ? 'opacity-60 bg-muted/20' : ''}`}>
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center shrink-0">
                          <Tag className="w-5 h-5 text-[var(--brand)]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{promo.title}</h3>
                            <Badge variant={promo.active ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 ${promo.active ? "bg-green-500 hover:bg-green-600" : ""}`}>
                              {promo.active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{promo.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openForm("promotion", promo)}>
                          <Edit2 size={16} />
                        </Button>
                        {(user?.role === "admin" || user?.role === "manager") && (
                          <Button variant="outline" size="sm" onClick={() => {
                            if (user?.role === "manager") {
                            setDeletionRequest({ isOpen: true, itemType: "promotion", itemId: promo.id.toString(), itemName: promo.title });
                            } else {
                              handleDeletePromotion(promo.id);
                            }
                          }} className="text-destructive">
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {promotions?.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl border-dashed">
                      <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">No promotions active</p>
                      <p className="text-sm mt-1">Add promotions to show on the top banner bar.</p>
                    </div>
                  )}
              </div>
            )}
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements" className="space-y-4">
            <div className="flex justify-end">
              <Button className="gap-2" onClick={() => openForm("announcement")}>
                <Plus size={18} />
                Add Announcement
              </Button>
            </div>

            {loadingAnnouncements ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="space-y-4">
                  {announcements?.map((announcement) => (
                    <div key={announcement.id} className={`flex items-start justify-between p-5 border border-border bg-card hover:border-[var(--brand)]/30 transition-colors rounded-xl ${!announcement.active ? 'opacity-60 bg-muted/20' : ''}`}>
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-1">
                          <Megaphone className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{announcement.title}</h3>
                            <Badge variant={announcement.active ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 ${announcement.active ? "bg-green-500 hover:bg-green-600" : ""}`}>
                              {announcement.active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{announcement.content}</p>
                          {announcement.image && <img src={announcement.image} alt="Announcement" className="mt-3 h-20 w-auto rounded-lg object-cover border border-border shadow-sm" />}
                          <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted inline-block px-2 py-0.5 rounded">{new Date(announcement.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openForm("announcement", announcement)}>
                          <Edit2 size={16} />
                        </Button>
                        {(user?.role === "admin" || user?.role === "manager") && (
                          <Button variant="outline" size="sm" onClick={() => {
                            if (user?.role === "manager") {
                            setDeletionRequest({ isOpen: true, itemType: "announcement", itemId: announcement.id.toString(), itemName: announcement.title });
                            } else {
                              handleDeleteAnnouncement(announcement.id);
                            }
                          }} className="text-destructive">
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {announcements?.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl border-dashed">
                      <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">No announcements</p>
                      <p className="text-sm mt-1">Keep your customers informed with news and updates.</p>
                    </div>
                  )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Universal Form Modal */}
        {formType && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg shadow-xl">
              <form onSubmit={handleSaveForm} className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold capitalize">
                    {(formData as any).id ? "Edit" : "Add"} {formType}
                  </h3>
                  <Button type="button" variant="ghost" size="sm" onClick={closeForm}>✕</Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input required value={(formData as any).title || ""} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder={`E.g. ${formType === 'banner' ? 'Summer Sale' : '20% Off'}`} />
                  </div>

                  {formType === "banner" && (
                    <>
                    <div className="space-y-2">
                      <Label>Subtitle / Description (Optional)</Label>
                      <Input value={(formData as any).description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="E.g. Save up to 40% on top tech" />
                    </div>
                    <div className="space-y-2">
                      <Label>Banner Image *</Label>
                      {formError && (
                        <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-red-800 dark:text-red-200">{formError}</p>
                          </div>
                        </div>
                      )}
                      <div 
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors relative ${
                          isUploading 
                            ? "border-[var(--brand)]/50 bg-muted/50" 
                            : "border-border hover:bg-muted/50 hover:border-[var(--brand)]/40"
                        }`}
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                      >
                        <input 
                          type="file" 
                          className="hidden" 
                          ref={fileInputRef} 
                          accept="image/*" 
                          onChange={handleFileUpload} 
                          title="Upload banner image"
                          aria-label="Upload banner image"
                          disabled={isUploading}
                        />
                        {(formData as any).image ? (
                          <div className="relative w-full aspect-[21/9] rounded-lg overflow-hidden border border-border">
                            <img src={(formData as any).image} alt="Preview" className="w-full h-full object-cover" />
                            <Button 
                              type="button"
                              variant="destructive" 
                              size="icon" 
                              className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-90 hover:opacity-100 shadow-sm"
                              onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, image: "" }); setFormError(null); }}
                              disabled={isUploading}
                            >
                              <X size={16} />
                            </Button>
                          </div>
                        ) : (
                          <div className="py-4">
                            {isUploading ? (
                              <>
                                <Loader2 size={32} className="mx-auto mb-3 text-[var(--brand)] animate-spin" />
                                <p className="text-sm font-medium">Uploading image...</p>
                              </>
                            ) : (
                              <>
                                <Upload size={32} className="mx-auto mb-3 text-muted-foreground/60" />
                                <p className="text-sm font-medium">Click to upload banner image</p>
                                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, or WEBP (Max 5MB) - Uses S3 or local storage</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    </>
                  )}

                  {formType === "announcement" && (
                    <>
                    <div className="space-y-2">
                      <Label>Announcement Image (Optional)</Label>
                      <div 
                        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors relative ${
                          isUploading 
                            ? "border-[var(--brand)]/50 bg-muted/50" 
                            : "border-border hover:bg-muted/50 hover:border-[var(--brand)]/40"
                        }`}
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                      >
                        <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={handleFileUpload} title="Upload announcement image" aria-label="Upload announcement image" disabled={isUploading} />
                        {(formData as any).image ? (
                          <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border">
                            <img src={(formData as any).image} alt="Preview" className="w-full h-full object-cover" />
                            <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6 rounded-full opacity-90 hover:opacity-100 shadow-sm" onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, image: "" }); }} disabled={isUploading}>
                              <X size={12} />
                            </Button>
                          </div>
                        ) : (
                          <div className="py-3">
                            {isUploading ? (
                              <Loader2 size={20} className="mx-auto mb-2 text-[var(--brand)] animate-spin" />
                            ) : (
                              <Upload size={20} className="mx-auto mb-2 text-muted-foreground/60" />
                            )}
                            <p className="text-sm font-medium">Click to upload image</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Link URL (Optional)</Label>
                      <Input value={(formData as any).linkUrl || ""} onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })} placeholder="e.g. /products?category=laptops or https://..." />
                    </div>
                    </>
                  )}

                  {formType === "promotion" && (
                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Textarea required value={(formData as any).description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Use code SUMMER20 at checkout" />
                    </div>
                  )}

                  {formType === "announcement" && (
                    <>
                      <div className="space-y-2">
                        <Label>Content *</Label>
                        <Textarea required value={(formData as any).content || ""} onChange={(e) => setFormData({ ...formData, content: e.target.value })} placeholder="Details about the announcement" />
                      </div>
                      <div className="space-y-2">
                        <Label>Date *</Label>
                        <Input type="date" required value={(formData as any).date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <Label className="cursor-pointer">Active / Visible on Store</Label>
                    <Switch checked={(formData as any).active} onCheckedChange={(c) => setFormData({ ...formData, active: c })} />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={closeForm} disabled={isSaving || isUploading}>Cancel</Button>
                  <Button type="submit" disabled={isSaving || isUploading} className="bg-[var(--brand)] text-white hover:opacity-90 min-w-24">
                    {isSaving || isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

    {deletionRequest && (
      <DeletionRequestModal
        isOpen={deletionRequest.isOpen}
        onClose={() => setDeletionRequest(null)}
        itemType={deletionRequest.itemType}
        itemId={deletionRequest.itemId}
        itemName={deletionRequest.itemName}
      />
    )}
      </div>
    </AdminLayout>
  );
}
