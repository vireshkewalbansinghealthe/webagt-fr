"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Loader2, ImagePlus, X, GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ProductFormData {
  id?: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  sku: string;
  isVirtual: boolean;
  status: "active" | "draft";
  categoryId: string;
  images: string[];
}

interface ProductSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<ProductFormData> | null;
  categories: Array<{ id: string; name: string }>;
  onSave: (data: ProductFormData) => Promise<void>;
}

const EMPTY_FORM: ProductFormData = {
  name: "",
  description: "",
  price: 0,
  compareAtPrice: null,
  stock: 0,
  sku: "",
  isVirtual: false,
  status: "active",
  categoryId: "",
  images: [],
};

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

function getCroppedCanvas(
  image: HTMLImageElement,
  crop: Crop,
): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const pixelCrop = {
    x: (crop.x / 100) * image.width * scaleX,
    y: (crop.y / 100) * image.height * scaleY,
    width: (crop.width / 100) * image.width * scaleX,
    height: (crop.height / 100) * image.height * scaleY,
  };

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );
  return canvas;
}

interface ImageCropDialogProps {
  src: string;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}

function ImageCropDialog({ src, onConfirm, onCancel }: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }, []);

  const handleConfirm = () => {
    if (!imgRef.current || !crop) return;
    const canvas = getCroppedCanvas(imgRef.current, crop);
    if (!canvas) return;
    onConfirm(canvas.toDataURL("image/jpeg", 0.92));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crop image</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center max-h-[60vh] overflow-auto">
          <ReactCrop
            crop={crop}
            onChange={(_, pct) => setCrop(pct)}
            aspect={1}
            circularCrop={false}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt="Crop preview"
              onLoad={onImageLoad}
              className="max-h-[55vh] w-auto"
            />
          </ReactCrop>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm}>Apply crop</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ImagePickerProps {
  images: string[];
  onChange: (images: string[]) => void;
}

function ImagePicker({ images, onChange }: ImagePickerProps) {
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCropSrc(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleCropConfirm = (dataUrl: string) => {
    onChange([...images, dataUrl]);
    setCropSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const moveImage = (from: number, to: number) => {
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <>
      <div className="space-y-3">
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((src, idx) => (
              <div
                key={idx}
                className={cn(
                  "group relative aspect-square rounded-lg overflow-hidden border-2 bg-muted",
                  idx === 0 ? "border-primary" : "border-transparent",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 rounded text-[9px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5">
                    Cover
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => moveImage(idx, idx - 1)}
                      className="rounded bg-white/20 p-1 text-white hover:bg-white/40"
                      title="Move left"
                    >
                      <GripVertical className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="rounded bg-red-500/80 p-1 text-white hover:bg-red-600"
                    title="Remove"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/30 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <ImagePlus className="size-8 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-medium">Drop image here or click to upload</p>
            <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG, WebP up to 10 MB</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {cropSrc && (
        <ImageCropDialog
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => {
            setCropSrc(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
      )}
    </>
  );
}

export function ProductSheet({
  open,
  onOpenChange,
  initialData,
  categories,
  onSave,
}: ProductSheetProps) {
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(initialData?.id);

  useEffect(() => {
    if (open) {
      setForm(initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM);
    }
  }, [open, initialData]);

  const set = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (form.price < 0) {
      toast.error("Price must be 0 or greater");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch {
      // onSave shows its own toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle>{isEditing ? "Edit product" : "Add product"}</SheetTitle>
        </SheetHeader>

        <form
          id="product-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto"
        >
          <div className="px-6 py-5 space-y-6">
            {/* Basic info */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Basic info
              </h3>

              <div className="space-y-2">
                <Label htmlFor="p-name">Product name</Label>
                <Input
                  id="p-name"
                  placeholder="e.g. Classic Perfume 50ml"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-desc">Description</Label>
                <Textarea
                  id="p-desc"
                  placeholder="Describe your product…"
                  rows={4}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="resize-none"
                />
              </div>
            </section>

            {/* Media */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Media
              </h3>
              <ImagePicker
                images={form.images}
                onChange={(imgs) => set("images", imgs)}
              />
            </section>

            {/* Pricing */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Pricing
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-price">Price (€)</Label>
                  <Input
                    id="p-price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.price === 0 ? "" : form.price}
                    onChange={(e) =>
                      set("price", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-compare">
                    Compare-at price{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="p-compare"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.compareAtPrice ?? ""}
                    onChange={(e) =>
                      set(
                        "compareAtPrice",
                        e.target.value ? parseFloat(e.target.value) : null,
                      )
                    }
                  />
                </div>
              </div>
              {form.compareAtPrice !== null &&
                form.compareAtPrice > form.price &&
                form.price > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">
                      {Math.round(
                        ((form.compareAtPrice - form.price) /
                          form.compareAtPrice) *
                          100,
                      )}
                      % off
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Discount badge will show on the storefront
                    </span>
                  </div>
                )}
            </section>

            {/* Inventory */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Inventory
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-stock">Stock quantity</Label>
                  <Input
                    id="p-stock"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={form.stock === 0 ? "" : form.stock}
                    onChange={(e) =>
                      set("stock", parseInt(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-sku">SKU</Label>
                  <Input
                    id="p-sku"
                    placeholder="e.g. PERF-001"
                    value={form.sku}
                    onChange={(e) => set("sku", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fulfillment</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => set("isVirtual", false)}
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left transition-colors",
                      !form.isVirtual
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <div className="font-medium">Physical product</div>
                    <div className="text-xs mt-1 text-muted-foreground">
                      Collect shipping address at checkout
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => set("isVirtual", true)}
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left transition-colors",
                      form.isVirtual
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <div className="font-medium">Virtual product</div>
                    <div className="text-xs mt-1 text-muted-foreground">
                      No shipping fields needed
                    </div>
                  </button>
                </div>
              </div>
            </section>

            {/* Organization */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Organization
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={form.categoryId}
                    onValueChange={(v) => set("categoryId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      set("status", v as ProductFormData["status"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
          </div>
        </form>

        <SheetFooter className="px-6 py-4 border-t shrink-0 flex-row justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" form="product-form" disabled={saving} className="gap-2 min-w-[140px]">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? (isEditing ? "Saving..." : "Adding...") : (isEditing ? "Save changes" : "Add product")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
