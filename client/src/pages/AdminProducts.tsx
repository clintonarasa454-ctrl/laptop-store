import { useState, useRef, useEffect, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Plus, Search, Edit2, Trash2, Image as ImageIcon, Upload, X, Loader2, ArrowUpDown, Barcode, Box, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import { formatPrice } from "@/lib/cart";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import BarcodeScanner from "@/components/BarcodeScanner";
import { useAuth } from "@/pages/useAuth";

export default function AdminProducts() {
  const { user } = useAuth();
  const { data: categories } = trpc.categories.list.useQuery();
  const utils = trpc.useUtils();
  const { data: warehouses } = trpc.admin.warehouses.useQuery();
  
  const { data: settings } = trpc.settings.public.useQuery({ keys: ["brands"] });
  const availableBrands = settings?.brands || ["Samsung", "Dell", "HP", "Lenovo", "Asus"];
  
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [scannerMode, setScannerMode] = useState<"product" | "serial" | null>(null);
  const [managingUnitsProduct, setManagingUnitsProduct] = useState<any>(null);
  const [unitSerials, setUnitSerials] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, itemsPerPage, sortConfig, stockFilter]);

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const { data: products, isLoading } = trpc.admin.products.useQuery(
    { search: debouncedSearch || undefined },
    { staleTime: 0, refetchInterval: 5000, refetchOnWindowFocus: true }
  );
  
  const defaultForm = {
    name: "",
    slug: "",
    categoryId: "",
    price: "",
    comparePrice: "",
    stock: "",
    brand: "",
    sku: "",
    description: "",
    shortDescription: "",
    images: [] as string[],
    specifications: "",
    tags: "",
    featured: false,
    active: true,
    hasSerial: false,
    warehouseId: "",
  };

  const [formData, setFormData] = useState(defaultForm);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const handledUrlRef = useRef("");

  useEffect(() => {
    if (handledUrlRef.current === searchString) return;

    const params = new URLSearchParams(searchString);
    const editId = params.get('edit');
    const isNew = params.get('new') === 'true';
    
    if (editId && products) {
      const productToEdit = products.find(p => p.id === parseInt(editId));
      if (productToEdit) {
        handledUrlRef.current = searchString;
        handleEdit(productToEdit);
        // Clean the URL so reloading doesn't re-open the modal
        setLocation(user?.role === 'manager' ? '/manager/products' : '/admin/products', { replace: true });
      }
    } else if (isNew) {
      handledUrlRef.current = searchString;
      resetForm();
      setShowForm(true);
      setLocation(user?.role === 'manager' ? '/manager/products' : '/admin/products', { replace: true });
    }
  }, [products, searchString, setLocation]);

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingId(null);
  };

  const createPresignedUrl = trpc.admin.createPresignedUrl.useMutation();

  const deleteProduct = trpc.admin.deleteProduct.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Product deleted successfully");
    },
    onError: (err) => toast.error("Failed to delete product: " + err.message)
  });

  const upsertProduct = trpc.admin.upsertProduct.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success(editingId ? "Product updated successfully" : "Product created successfully");
      setShowForm(false);
      resetForm();
    },
    onError: (err) => toast.error("Failed to save product: " + err.message)
  });

  const requestRestock = trpc.admin.requestRestock.useMutation({
    onSuccess: () => toast.success("Restock request sent to Admin successfully!"),
    onError: (err) => toast.error(`Error: ${err.message}`)
  });

  const filteredProducts = (products || []).filter(p => {
    if (stockFilter === "out_of_stock") return p.stock === 0;
    if (stockFilter === "low_stock") return p.stock > 0 && p.stock <= 10;
    if (stockFilter === "in_stock") return p.stock > 0;
    return true;
  });
  
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      if (!sortConfig) return 0;
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key === "price" || sortConfig.key === "stock") {
        aVal = Number(aVal);
        bVal = Number(bVal);
      }
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortConfig]);

  const { totalPages, paginatedProducts } = useMemo(() => {
    return {
      totalPages: Math.ceil(sortedProducts.length / itemsPerPage),
      paginatedProducts: sortedProducts.slice((page - 1) * itemsPerPage, page * itemsPerPage)
    };
  }, [sortedProducts, page, itemsPerPage]);

  const handleDelete = async (productId: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProduct.mutate({ productId });
    }
  };

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    const specsObj = product.specifications || {};
    const specsString = Object.entries(specsObj).map(([k, v]) => `${k}: ${v}`).join("\n");
    setFormData({
      name: product.name || "",
      slug: product.slug || "",
      categoryId: String(product.categoryId || ""),
      price: String(product.price || ""),
      comparePrice: String(product.comparePrice || ""),
      stock: String(product.stock || "0"),
      brand: product.brand || "",
      sku: product.sku || "",
      description: product.description || "",
      shortDescription: product.shortDescription || "",
      images: Array.isArray(product.images) ? product.images : [],
      specifications: specsString,
      tags: Array.isArray(product.tags) ? product.tags.join(", ") : "",
      featured: product.featured || false,
      active: product.active ?? true,
      hasSerial: product.hasSerial || false,
      warehouseId: product.warehouseId?.toString() || "",
    });
    setShowForm(true);
  };

  const handleBarcodeScan = (code: string) => {
    if (scannerMode === "product") {
      resetForm();
      setFormData((prev) => ({
        ...prev,
        sku: code,
        name: `Product ${code}`, 
      }));
      setShowForm(true);
      setScannerMode(null);
      toast.success(`Scanned: ${code}`);
    } else if (scannerMode === "serial") {
      setUnitSerials((prev) => {
        const existing = prev.split('\n').map(s => s.trim()).filter(Boolean);
        if (existing.includes(code)) {
          toast.error("Serial number already scanned!");
          return prev;
        }
        return prev ? prev + '\n' + code : code;
      });
      toast.success(`Added serial: ${code}`);
    }
  };

  const createUnitsMutation = trpc.admin.createProductUnits.useMutation({
    onSuccess: (data) => {
      utils.admin.products.invalidate();
      toast.success(`Successfully added ${data.count} units`);
      setManagingUnitsProduct(null);
      setUnitSerials("");
    },
    onError: (err) => toast.error("Failed to add units: " + err.message)
  });

  const handleCreateUnits = () => {
    const serials = unitSerials.split("\n").map(s => s.trim()).filter(Boolean);
    if (serials.length === 0) return toast.error("Enter at least one serial number");
    createUnitsMutation.mutate({
      productId: managingUnitsProduct.id,
      units: serials.map(s => ({ serialNumber: s }))
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newImages: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not a valid image.`);
        continue;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 2MB.`);
        continue;
      }
      let toastId;
      try {
        toastId = toast.loading(`Uploading ${file.name}...`);
        const { uploadUrl, publicUrl } = await createPresignedUrl.mutateAsync({ filename: file.name, contentType: file.type });
        
        if (uploadUrl && publicUrl) {
          const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          if (!res.ok) throw new Error("S3 Upload Failed");
          newImages.push(publicUrl);
          toast.success(`${file.name} uploaded!`, { id: toastId });
        } else {
          throw new Error("Failed to get presigned URL");
        }
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`, { id: toastId });
      }
    }
    
    if (newImages.length > 0) setFormData((prev) => ({ ...prev, images: [...prev.images, ...newImages] }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.glb')) {
      toast.error("Please upload a valid .glb 3D model file.");
      return;
    }
    
    if (file.size > 20 * 1024 * 1024) {
      toast.error(`${file.name} is larger than 20MB.`);
      return;
    }
    
    let toastId;
    try {
      toastId = toast.loading(`Uploading 3D Model ${file.name}...`);
      const contentType = file.type || "model/gltf-binary";
      const { uploadUrl, publicUrl } = await createPresignedUrl.mutateAsync({ filename: file.name, contentType });
      
      if (uploadUrl && publicUrl) {
        const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
        if (!res.ok) throw new Error("S3 Upload Failed");
        
        setFormData((prev) => {
          const currentSpecs = prev.specifications.trim();
          const newSpecs = currentSpecs ? `${currentSpecs}\n3D Model URL: ${publicUrl}` : `3D Model URL: ${publicUrl}`;
          return { ...prev, specifications: newSpecs };
        });
        
        toast.success(`3D Model uploaded successfully!`, { id: toastId });
      } else { throw new Error("Failed to get presigned URL"); }
    } catch (error) { toast.error(`Failed to upload 3D model`, { id: toastId }); }
    if (modelInputRef.current) modelInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId) return toast.error("Please select a category");
    
    const specsObj: Record<string, string> = {};
    formData.specifications.split("\n").forEach((line) => {
      const [k, ...v] = line.split(":");
      if (k && v.length > 0) specsObj[k.trim()] = v.join(":").trim();
    });

    upsertProduct.mutate({
      ...(editingId ? { id: editingId } : {}),
      categoryId: parseInt(formData.categoryId),
      name: formData.name,
      slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""),
      description: formData.description || undefined,
      shortDescription: formData.shortDescription || undefined,
      price: formData.price,
      comparePrice: formData.comparePrice || undefined,
      stock: Math.max(0, parseInt(formData.stock) || 0),
      brand: formData.brand || undefined,
      sku: formData.sku || undefined,
      images: formData.images,
      specifications: specsObj,
      tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
      featured: formData.featured,
      active: formData.active,
      hasSerial: formData.hasSerial,
      warehouseId: formData.warehouseId ? parseInt(formData.warehouseId) : undefined,
    });
  };

  return (
    <AdminLayout activeTab="products">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Products Management</h2>
            <p className="text-muted-foreground mt-1">
              Manage your store products, inventory, and pricing
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setScannerMode("product")} variant="outline" className="gap-2">
              <Barcode size={18} />
              Scan to Add
            </Button>
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
              <Plus size={18} />
              Add Product
            </Button>
          </div>
        </div>

        {/* Search & Filter */}
        <Card className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-muted-foreground" size={18} />
              <Input
                placeholder="Search products by name or brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          <Select value={stockFilter} onValueChange={(val: any) => setStockFilter(val)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock Levels</SelectItem>
              <SelectItem value="in_stock">In Stock (&gt;0)</SelectItem>
              <SelectItem value="low_stock">Low Stock (≤10)</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock (0)</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </Card>

        {/* Products Table */}
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold w-16">Image</th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Product Name <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('categoryId')}>
                    <div className="flex items-center gap-1">Category <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('brand')}>
                    <div className="flex items-center gap-1">Brand <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-right py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('price')}>
                    <div className="flex items-center justify-end gap-1">Price <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-right py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('stock')}>
                    <div className="flex items-center justify-end gap-1">Stock <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-muted-foreground">
                      Loading products...
                    </td>
                  </tr>
                ) : paginatedProducts.length > 0 ? (
                  paginatedProducts.map((product) => (
                    <tr key={product.id} className={`border-b border-border hover:bg-secondary transition-colors ${!product.active ? 'opacity-50' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                          {Array.isArray(product.images) && product.images[0] ? (
                            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon size={20} className="text-muted-foreground" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{product.name}</p>
                        {product.featured && <span className="text-[10px] bg-[var(--brand)]/10 text-[var(--brand)] px-1.5 py-0.5 rounded border border-[var(--brand)]/20">Featured</span>}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {categories?.find(c => c.id === product.categoryId)?.name || product.categoryId}
                      </td>
                      <td className="py-3 px-4">{product.brand || "-"}</td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {formatPrice(product.price)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            product.stock > 20
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : product.stock > 5
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {user?.role === "manager" && product.stock <= 10 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Request Restock from Admin"
                              onClick={() => {
                                const qtyStr = window.prompt(`How many units of ${product.name} do you need to restock?`, "10");
                                const qty = parseInt(qtyStr || "0", 10);
                                if (qty > 0) requestRestock.mutate({ productId: product.id, productName: product.name, quantity: qty });
                              }}
                              disabled={requestRestock.isPending}
                              className="text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                            >
                              <RefreshCw size={16} className={requestRestock.isPending ? "animate-spin" : ""} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Add Serialized Units"
                            onClick={() => setManagingUnitsProduct(product)}
                          >
                            <Barcode size={16} className={product.hasSerial ? "text-[var(--brand)]" : ""} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit2 size={16} />
                          </Button>
                          {(user?.role === "admin" || user?.role === "manager") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (user?.role === "manager") {
                                  toast.warning("Deletion restricted. Please alert an Admin to confirm and authorize this deletion.");
                                } else {
                                  handleDelete(product.id);
                                }
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-muted-foreground">
                      No products found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && filteredProducts.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border mt-4">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, sortedProducts.length)} of {sortedProducts.length} entries
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground hidden sm:inline">Rows per page:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(Number(val))}>
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Product Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">{editingId ? "Edit Product" : "Add New Product"}</h3>
                  <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>✕</Button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Product Name *</Label>
                    <Input
                      value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Brand</Label>
                      <select
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select Brand...</option>
                        {availableBrands.map((b: string) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Price *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2">
                        Compare Price (Optional)
                        {parseFloat(formData.comparePrice) > parseFloat(formData.price) && (
                          <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-bold tracking-wide">
                            Save {Math.round((1 - parseFloat(formData.price) / parseFloat(formData.comparePrice)) * 100)}%
                          </span>
                        )}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.comparePrice}
                        onChange={(e) => setFormData({ ...formData, comparePrice: e.target.value })}
                      />
                      {parseFloat(formData.comparePrice) > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="text-[10px] text-muted-foreground self-center mr-1">Quick Discount:</span>
                          {[5, 10, 15, 20, 25, 30, 50].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setFormData(f => ({ ...f, price: (parseFloat(f.comparePrice) * (1 - pct / 100)).toFixed(2) }))}
                              className="text-[10px] border border-border bg-background hover:bg-muted hover:border-[var(--brand)] px-1.5 py-0.5 rounded transition-colors"
                            >
                              -{pct}%
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label>Stock *</Label>
                      <Input
                        type="number"
                        value={formData.stock}
                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      required
                    />
                    </div>
                    <div className="space-y-1.5">
                      <Label>SKU</Label>
                      <Input
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Category *</Label>
                      <Select
                        value={formData.categoryId} 
                        onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                        required={true}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                        {categories?.filter(c => !(c as any).parentId).map(parent => (
                          <SelectGroup key={parent.id}>
                            <SelectLabel className="font-semibold text-[var(--brand)]">{parent.name}</SelectLabel>
                            <SelectItem value={String(parent.id)}>All {parent.name}</SelectItem>
                            {categories.filter(c => (c as any).parentId === parent.id).map(child => (
                              <SelectItem key={child.id} value={String(child.id)} className="pl-6">{child.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Short Description</Label>
                    <Input
                      value={formData.shortDescription}
                      onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Full Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Product Images</Label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                      {formData.images.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-border group">
                          <img src={img} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 w-6 h-6 bg-destructive/90 text-white rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-md border-2 border-dashed border-border hover:border-[var(--brand)] hover:bg-[var(--brand)]/5 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
                      >
                        <Upload className="w-5 h-5" />
                        <span className="text-xs">Upload</span>
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={handleFileUpload}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Specifications (Format: "Key: Value" one per line)</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => modelInputRef.current?.click()} className="h-7 text-xs gap-1.5">
                        <Box size={14} /> Upload 3D Model (.glb)
                      </Button>
                      <input type="file" ref={modelInputRef} className="hidden" accept=".glb" onChange={handleModelUpload} />
                    </div>
                    <Textarea
                      value={formData.specifications}
                      onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                      rows={4}
                      placeholder="Processor: Intel Core i7&#10;RAM: 16GB DDR5"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Tags (Comma separated)</Label>
                      <Input
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        placeholder="gaming, professional, creative"
                      />
                    </div>
                    {user?.role === "admin" && (
                      <div className="space-y-1.5">
                        <Label>Assign to Warehouse (Optional)</Label>
                        <Select value={formData.warehouseId || "none"} onValueChange={(val) => setFormData({ ...formData, warehouseId: val === "none" ? "" : val })}>
                          <SelectTrigger><SelectValue placeholder="Global / All Hubs" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Global / All Hubs</SelectItem>
                            {warehouses?.map((w: any) => (
                              <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch checked={formData.featured} onCheckedChange={(c) => setFormData({ ...formData, featured: c })} />
                      <span className="text-sm font-medium">Featured</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch checked={formData.active} onCheckedChange={(c) => setFormData({ ...formData, active: c })} />
                      <span className="text-sm font-medium">Visible</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch checked={formData.hasSerial} onCheckedChange={(c) => setFormData({ ...formData, hasSerial: c })} />
                      <span className="text-sm font-medium">Track Serial Numbers</span>
                    </label>
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row gap-2 mt-6">
                    <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
                    <Button type="submit" disabled={upsertProduct.isPending} className="flex-1 bg-[var(--brand)] text-white hover:opacity-90">
                      {upsertProduct.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? "Update Product" : "Create Product")}
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          </div>
        )}

        {/* Manage Units Modal */}
        {managingUnitsProduct && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md shadow-xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">Add Serialized Units</h3>
                  <Button variant="ghost" size="sm" onClick={() => { setManagingUnitsProduct(null); setUnitSerials(""); }}>✕</Button>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Adding units for <strong>{managingUnitsProduct.name}</strong>. Scan or type serial numbers (one per line).
                  </p>
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setScannerMode("serial")}>
                    <Barcode size={16} /> Scan Serial Number
                  </Button>
                  <Textarea
                    rows={8}
                    value={unitSerials}
                    onChange={(e) => setUnitSerials(e.target.value)}
                    placeholder="e.g. SN-123456&#10;SN-789012"
                  />
                  <Button 
                    className="w-full bg-[var(--brand)] text-white hover:opacity-90" 
                    onClick={handleCreateUnits}
                    disabled={createUnitsMutation.isPending || !unitSerials.trim()}
                  >
                    {createUnitsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Units"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Barcode Scanner Modal */}
        <BarcodeScanner
          isOpen={scannerMode !== null}
          onClose={() => setScannerMode(null)}
          onScan={handleBarcodeScan}
          title={scannerMode === "serial" ? "Scan Serial Number" : "Scan Product Barcode"}
        />
      </div>
    </AdminLayout>
  );
}
