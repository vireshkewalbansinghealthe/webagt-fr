"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, useTransition } from "react";
import { 
  Package, 
  ShoppingBag, 
  CreditCard, 
  Activity, 
  LayoutDashboard,
  ExternalLink,
  Database,
  Loader2,
  Edit,
  Trash2,
  Plus,
  Wallet,
  ArrowUpRight,
  Settings2,
  CheckCircle2,
  Globe,
  ChevronRight,
  RotateCw,
  Bell,
  Search,
  Copy,
  Truck,
  MapPin,
  Infinity as InfinityIcon,
  AlertTriangle,
  BarChart3,
  X,
  ChevronDown,
  SlidersHorizontal,
  Columns3,
  Tag,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { createClient } from "@libsql/client/web";
import { useAuth, useUser } from "@clerk/nextjs";
import { createApiClient, type ProjectEmailSettings } from "@/lib/api-client";
import { AlertCircle, RefreshCw, XCircle, DollarSign, MoreHorizontal, ChevronUp } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductSheet, type ProductFormData } from "./product-sheet";

type Tab = "dashboard" | "products" | "inventory" | "shipping" | "taxes" | "orders" | "payments" | "publish" | "notifications" | "settings" | "logs";
type StripeMode = "test" | "live";

const TABS = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "products" as const, label: "Products", icon: Package },
  { id: "inventory" as const, label: "Inventory", icon: BarChart3 },
  { id: "shipping" as const, label: "Shipping", icon: Truck },
  { id: "taxes" as const, label: "Taxes", icon: Percent },
  { id: "orders" as const, label: "Orders", icon: ShoppingBag },
  { id: "payments" as const, label: "Payments", icon: Wallet },
  { id: "publish" as const, label: "Publish", icon: ExternalLink },
  { id: "notifications" as const, label: "Notifications", icon: Bell },
  { id: "settings" as const, label: "Settings", icon: Settings2 },
  { id: "logs" as const, label: "Logs", icon: Activity },
];

function getStripeAccountId(project: Project, mode: StripeMode) {
  if (mode === "live") {
    if (project.stripeLiveAccountId) {
      return project.stripeLiveAccountId;
    }
    return project.stripeTestAccountId ? undefined : project.stripeAccountId;
  }
  if (project.stripeTestAccountId) {
    return project.stripeTestAccountId;
  }
  return project.stripeLiveAccountId ? undefined : project.stripeAccountId;
}

export function ShopManagerPanel({ project }: { project: Project }) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [projectState, setProjectState] = useState(project);
  const [provisioning, setProvisioning] = useState(false);
  const { getToken } = useAuth();

  useEffect(() => {
    setProjectState(project);
  }, [project]);

  // When switching to the Publish tab, always fetch the latest project so
  // deployment_uuid (and payment state) are never stale from a cached prop.
  useEffect(() => {
    if (activeTab !== "publish" && activeTab !== "payments") return;
    const client = createApiClient(getToken);
    client.projects.get(project.id)
      .then(({ project: fresh }) => setProjectState(fresh))
      .catch(() => { /* silently ignore — stale UI is acceptable */ });
  }, [activeTab]);
  
  useEffect(() => {
    const handler = () => setActiveTab("products");
    window.addEventListener("webagt:edit-product-image", handler);
    return () => window.removeEventListener("webagt:edit-product-image", handler);
  }, []);

  const turso = useMemo(() => {
    if (!projectState.databaseUrl || !projectState.databaseToken) return null;
    return createClient({
      url: projectState.databaseUrl,
      authToken: projectState.databaseToken,
    });
  }, [projectState.databaseUrl, projectState.databaseToken]);

  const handleProvisionDatabase = async () => {
    setProvisioning(true);
    try {
      const client = createApiClient(getToken);
      const result = await client.projects.provisionDatabase(projectState.id);
      setProjectState(result.project);
      toast.success("Database provisioned successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to provision database. Please try again.");
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            Shop Manager
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your Turso database and payments for {projectState.name}
          </p>
        </div>
      </div>
      
      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 lg:w-56 border-r bg-muted/10 p-4 space-y-1 shrink-0 overflow-y-auto">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground font-medium shadow-sm" 
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-background/50">
          {!turso && activeTab !== "settings" ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <div className="relative mb-4">
                <Database className="size-12 text-muted-foreground/30" />
                <AlertCircle className="size-5 text-amber-500 absolute -bottom-1 -right-1" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No Database Connected</h3>
              <p className="max-w-sm mb-2 text-sm">
                The database provisioning failed when this project was created (Turso API timeout or rate limit).
              </p>
              <p className="max-w-sm mb-6 text-sm text-muted-foreground">
                Click below to retry — it only takes a few seconds.
              </p>
              <Button onClick={handleProvisionDatabase} disabled={provisioning} className="gap-2">
                {provisioning ? (
                  <><Loader2 className="size-4 animate-spin" /> Provisioning database…</>
                ) : (
                  <><Database className="size-4" /> Provision Database</>
                )}
              </Button>
            </div>
          ) : (
            <div className="h-full w-full p-6">
              {activeTab === "dashboard" && <DashboardTab turso={turso} />}
              {activeTab === "products" && <ProductsTab turso={turso} project={projectState} />}
              {activeTab === "inventory" && <InventoryTab turso={turso} />}
              {activeTab === "shipping" && <ShippingTab turso={turso} />}
              {activeTab === "taxes" && <TaxesTab turso={turso} />}
              {activeTab === "orders" && <OrdersTab turso={turso} project={projectState} />}
              {activeTab === "payments" && (
                <PaymentsTab
                  project={projectState}
                  onNavigate={setActiveTab}
                  onProjectChange={setProjectState}
                />
              )}
              {activeTab === "publish" && (
                <PublishTab
                  project={projectState}
                  onProjectChange={setProjectState}
                />
              )}
              {activeTab === "notifications" && (
                <NotificationsTab project={projectState} />
              )}
              {activeTab === "settings" && (
                <SettingsTab project={projectState} turso={turso} />
              )}
              {activeTab === "logs" && <LogsTab turso={turso} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- TABS ---

const POLL_INTERVAL_MS = 10_000;

function useLastUpdated() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const bump = useCallback(() => setLastUpdated(new Date()), []);
  const label = lastUpdated
    ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : null;
  return { bump, label };
}

function DashboardTab({ turso }: { turso: any }) {
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { bump, label } = useLastUpdated();

  const loadStats = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [prodRes, orderRes, revRes] = await Promise.all([
        turso.execute("SELECT count(*) as c FROM Product"),
        turso.execute("SELECT count(*) as c FROM [Order]"),
        turso.execute("SELECT sum(totalAmount) as s FROM [Order] WHERE status != 'CANCELLED'"),
      ]);
      setStats({
        products: Number(prodRes.rows[0].c) || 0,
        orders: Number(orderRes.rows[0].c) || 0,
        revenue: Number(revRes.rows[0].s) || 0,
      });
      bump();
    } catch (err) {
      console.error("Failed to load stats", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [turso, bump]);

  useEffect(() => {
    loadStats();
    const timer = setInterval(() => loadStats(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadStats]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Dashboard Overview</h3>
        <div className="flex items-center gap-2">
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
          <Button size="sm" variant="ghost" className="gap-1.5 h-7 px-2" onClick={() => loadStats(true)} disabled={refreshing}>
            <RotateCw className={cn("size-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 border rounded-xl bg-card shadow-sm">
          <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <Package className="size-4" /> Total Products
          </div>
          <div className="text-3xl font-bold">{stats.products}</div>
        </div>
        <div className="p-6 border rounded-xl bg-card shadow-sm">
          <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <ShoppingBag className="size-4" /> Total Orders
          </div>
          <div className="text-3xl font-bold">{stats.orders}</div>
        </div>
        <div className="p-6 border rounded-xl bg-card shadow-sm">
          <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <CreditCard className="size-4" /> Total Revenue
          </div>
          <div className="text-3xl font-bold">€{stats.revenue.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

function parseImages(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  try {
    const parsed = JSON.parse(raw as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return typeof raw === "string" && raw.startsWith("http") ? [raw] : [];
  }
}

function rowToFormData(row: any): ProductFormData {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    price: Number(row.price ?? 0),
    compareAtPrice: row.compareAtPrice != null ? Number(row.compareAtPrice) : null,
    trackStock: Boolean(Number(row.trackStock)),
    stock: Number(row.stock ?? row.inventory ?? 0),
    sku: String(row.sku ?? ""),
    isVirtual: Boolean(row.isVirtual),
    status: row.status === "draft" ? "draft" : "active",
    categoryId: String(row.categoryId ?? ""),
    taxGroupId: String(row.taxGroupId ?? ""),
    images: parseImages(row.images),
  };
}

/**
 * Cleans a product image URL before storing it in Turso.
 * - Strips Unsplash/CDN query params to stay well under Stripe's 2048-char URL limit.
 * - Drops any URL (non-data) that is still over 2048 chars after cleaning.
 * - Base64 data: URLs are kept as-is (used for display only; stripped at checkout).
 */
function cleanImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("data:")) return url; // Keep base64 for display; safeImageUrl strips at checkout
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return url;
    // Strip query params for Unsplash and other CDN-style image hosts
    const hostsThatBloat = ["unsplash.com", "images.unsplash.com", "source.unsplash.com", "picsum.photos", "cloudinary.com", "imgix.net"];
    if (hostsThatBloat.some((h) => parsed.hostname.includes(h))) {
      const clean = `${parsed.origin}${parsed.pathname}`;
      return clean.length <= 2048 ? clean : "";
    }
    return url.length <= 2048 ? url : "";
  } catch {
    return url;
  }
}

function cleanImages(images: string[]): string[] {
  return images.map(cleanImageUrl).filter(Boolean);
}

function slugifyProductName(name: string, fallbackId?: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base) {
    return fallbackId ? `${base}-${fallbackId.slice(-4)}` : base;
  }
  return fallbackId ? `product-${fallbackId.slice(-6)}` : "product";
}

async function ensureProductSchemaColumns(turso: any) {
  try {
    await turso.execute("CREATE TABLE IF NOT EXISTS [_AppLog] (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL DEFAULT 'info', source TEXT, message TEXT NOT NULL, detail TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)");
  } catch { /* ignore */ }

  const statements = [
    "ALTER TABLE Product ADD COLUMN slug TEXT",
    "ALTER TABLE Product ADD COLUMN compareAtPrice REAL",
    "ALTER TABLE Product ADD COLUMN sku TEXT",
    "ALTER TABLE Product ADD COLUMN isVirtual INTEGER DEFAULT 0",
    "ALTER TABLE Product ADD COLUMN status TEXT DEFAULT 'ACTIVE'",
    "ALTER TABLE Product ADD COLUMN categoryId TEXT",
    "ALTER TABLE Product ADD COLUMN inventory INTEGER DEFAULT 0",
    "ALTER TABLE Product ADD COLUMN stock INTEGER DEFAULT 0",
    "ALTER TABLE Product ADD COLUMN trackStock INTEGER DEFAULT 0",
    "ALTER TABLE Product ADD COLUMN taxGroupId TEXT",
  ];

  for (const sql of statements) {
    try {
      await turso.execute(sql);
    } catch (error: any) {
      const message = String(error?.message || error || "").toLowerCase();
      if (
        message.includes("duplicate column name") ||
        message.includes("already exists")
      ) {
        continue;
      }
      console.warn("Product schema migration skipped:", sql, error);
    }
  }
}

async function seedTemplateProductsInShopManager(turso: any, templateId?: string) {
  if (templateId !== "pardole_parfum_vite" && templateId !== "pardole-parfum") {
    return;
  }

  const statements = [
    `INSERT OR IGNORE INTO Category (id, name, slug, description, image) VALUES ('cat-dames', 'Dames', 'dames', '', '')`,
    `INSERT OR IGNORE INTO Category (id, name, slug, description, image) VALUES ('cat-heren', 'Heren', 'heren', '', '')`,
    `INSERT OR IGNORE INTO Category (id, name, slug, description, image) VALUES ('cat-unisex', 'Unisex', 'unisex', '', '')`,
    `INSERT OR IGNORE INTO Product (id, categoryId, name, slug, description, price, images, featured, inventory, stock, sku, isVirtual, status, rating, reviews, createdAt, updatedAt) VALUES ('prd-309', 'cat-dames', '309', '309', 'Designer-inspired parfum met warme en elegante noten.', 24.95, '["https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80"]', 1, 120, 120, '', 0, 'ACTIVE', 4.9, 847, datetime('now'), datetime('now'))`,
    `INSERT OR IGNORE INTO Product (id, categoryId, name, slug, description, price, images, featured, inventory, stock, sku, isVirtual, status, rating, reviews, createdAt, updatedAt) VALUES ('prd-105', 'cat-heren', '105', '105', 'Krachtige heren geur met kruidige en houtachtige basis.', 24.95, '["https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800&q=80"]', 1, 110, 110, '', 0, 'ACTIVE', 4.8, 789, datetime('now'), datetime('now'))`,
    `INSERT OR IGNORE INTO Product (id, categoryId, name, slug, description, price, images, featured, inventory, stock, sku, isVirtual, status, rating, reviews, createdAt, updatedAt) VALUES ('prd-210', 'cat-unisex', '210', '210', 'Unisex premium blend met amber, musk en vanille.', 24.95, '["https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&q=80"]', 1, 95, 95, '', 0, 'ACTIVE', 4.9, 412, datetime('now'), datetime('now'))`,
  ];

  for (const sql of statements) {
    await turso.execute(sql);
  }
}

type ColKey = "status" | "category" | "stock" | "sku" | "type" | "price";

const DEFAULT_COLS: Record<ColKey, boolean> = {
  status: true,
  category: false,
  stock: false,
  sku: false,
  type: false,
  price: true,
};

function ProductsTab({ turso, project }: { turso: any; project: Project }) {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [taxGroups, setTaxGroups] = useState<Array<{ id: string; name: string; rate: number; isDefault: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [cols, setCols] = useState<Record<ColKey, boolean>>(DEFAULT_COLS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<ProductFormData> | null>(null);

  const toggleCol = (key: ColKey) =>
    setCols((prev) => ({ ...prev, [key]: !prev[key] }));

  const loadData = async () => {
    setLoading(true);
    try {
      await ensureProductSchemaColumns(turso);
      await ensureTaxSchema(turso);
      await ensureDefaultTaxGroup(turso);
      let [prodRes, catRes, taxRes] = await Promise.all([
        turso.execute("SELECT * FROM Product ORDER BY createdAt DESC"),
        turso.execute("SELECT id, name FROM Category ORDER BY name ASC").catch(() => ({ rows: [] })),
        turso.execute("SELECT * FROM TaxGroup ORDER BY isDefault DESC, name ASC").catch(() => ({ rows: [] })),
      ]);

      if ((prodRes.rows?.length || 0) === 0) {
        await seedTemplateProductsInShopManager(turso, project.templateId);
        [prodRes, catRes] = await Promise.all([
          turso.execute("SELECT * FROM Product ORDER BY createdAt DESC"),
          turso.execute("SELECT id, name FROM Category ORDER BY name ASC").catch(() => ({ rows: [] })),
        ]);
      }

      setProducts(prodRes.rows);
      setCategories(
        (catRes.rows as any[]).map((r) => ({ id: String(r.id), name: String(r.name) })),
      );
      setTaxGroups(
        (taxRes.rows as any[]).map((r) => ({
          id: String(r.id), name: String(r.name), rate: Number(r.rate), isDefault: Boolean(Number(r.isDefault)),
        })),
      );
    } catch (err) {
      toast.error("Failed to load products");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [turso]);

  useEffect(() => {
    const handler = (e: Event) => {
      const imgSrc = (e as CustomEvent).detail?.imageSrc as string;
      if (!imgSrc || products.length === 0) return;
      const match = products.find((p) => {
        const imgs = parseImages(p.images);
        return imgs.some((i: string) => imgSrc.includes(i) || i.includes(imgSrc));
      });
      if (match) {
        setEditingProduct(rowToFormData(match));
        setSheetOpen(true);
      } else {
        toast.info("No matching product found for this image");
      }
    };
    window.addEventListener("webagt:edit-product-image", handler);
    return () => window.removeEventListener("webagt:edit-product-image", handler);
  }, [products]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    try {
      await turso.execute({ sql: "DELETE FROM Product WHERE id = ?", args: [id] });
      toast.success("Product deleted");
      window.dispatchEvent(new CustomEvent("webagt:shop-changed"));
      loadData();
    } catch {
      toast.error("Failed to delete product");
    }
  };

  const handleSave = async (data: ProductFormData) => {
    const imagesJson = JSON.stringify(cleanImages(data.images));
    const now = new Date().toISOString();
    try {
      await ensureProductSchemaColumns(turso);

      if (data.id) {
        await turso.execute({
          sql: `UPDATE Product SET
            name = ?, description = ?, price = ?, compareAtPrice = ?,
            trackStock = ?, stock = ?, inventory = ?, sku = ?, slug = ?, isVirtual = ?, status = ?, categoryId = ?, taxGroupId = ?, images = ?,
            updatedAt = ?
            WHERE id = ?`,
          args: [
            data.name, data.description, data.price, data.compareAtPrice,
            data.trackStock ? 1 : 0, data.stock, data.stock, data.sku,
            slugifyProductName(data.name, data.id), data.isVirtual ? 1 : 0,
            data.status.toUpperCase(), data.categoryId || null, data.taxGroupId || null,
            imagesJson, now, data.id,
          ],
        });
        toast.success("Product saved");
      } else {
        const id = `prod_${Math.random().toString(36).slice(2, 10)}`;
        await turso.execute({
          sql: `INSERT INTO Product
            (id, name, slug, description, price, compareAtPrice, trackStock, stock, inventory, sku, isVirtual, status, categoryId, taxGroupId, images, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id, data.name, slugifyProductName(data.name, id), data.description, data.price, data.compareAtPrice,
            data.trackStock ? 1 : 0, data.stock, data.stock, data.sku,
            data.isVirtual ? 1 : 0, data.status.toUpperCase(), data.categoryId || null, data.taxGroupId || null,
            imagesJson, now, now,
          ],
        });
        toast.success("Product added");
      }
      await loadData();
      window.dispatchEvent(new CustomEvent("webagt:shop-changed"));
    } catch (error: any) {
      console.error("Failed to save product", error);
      toast.error(error?.message || "Failed to save product");
      throw error;
    }
  };

  const openNew = () => {
    setEditingProduct(null);
    setSheetOpen(true);
  };

  const openEdit = (row: any) => {
    setEditingProduct(rowToFormData(row));
    setSheetOpen(true);
  };

  const filtered = products.filter((p) => {
    if (search && !String(p.name).toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all") {
      const s = String(p.status).toLowerCase();
      if (filterStatus === "active" && s === "draft") return false;
      if (filterStatus === "draft" && s !== "draft") return false;
    }
    if (filterCategory !== "all" && String(p.categoryId) !== filterCategory) return false;
    if (filterType !== "all") {
      const isVirtual = Boolean(Number(p.isVirtual));
      if (filterType === "physical" && isVirtual) return false;
      if (filterType === "virtual" && !isVirtual) return false;
    }
    return true;
  });

  const activeFilters = [
    filterStatus !== "all",
    filterCategory !== "all",
    filterType !== "all",
  ].filter(Boolean).length;

  const visibleColCount = 2 + (cols.status ? 1 : 0) + (cols.category ? 1 : 0) + (cols.stock ? 1 : 0) + (cols.sku ? 1 : 0) + (cols.type ? 1 : 0) + (cols.price ? 1 : 0) + 1;

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search products…"
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 gap-1.5", filterStatus !== "all" && "border-primary text-primary")}>
                <SlidersHorizontal className="size-3.5" />
                {filterStatus === "all" ? "Status" : filterStatus === "active" ? "Active" : "Draft"}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={filterStatus} onValueChange={setFilterStatus}>
                <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="active">Active</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="draft">Draft</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Category filter */}
          {categories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-1.5", filterCategory !== "all" && "border-primary text-primary")}>
                  <Tag className="size-3.5" />
                  {filterCategory === "all" ? "Category" : (categories.find(c => c.id === filterCategory)?.name ?? "Category")}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel>Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={filterCategory} onValueChange={setFilterCategory}>
                  <DropdownMenuRadioItem value="all">All categories</DropdownMenuRadioItem>
                  {categories.map((c) => (
                    <DropdownMenuRadioItem key={c.id} value={c.id}>{c.name}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Type filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 gap-1.5", filterType !== "all" && "border-primary text-primary")}>
                <Package className="size-3.5" />
                {filterType === "all" ? "Type" : filterType === "physical" ? "Physical" : "Virtual"}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              <DropdownMenuLabel>Fulfillment</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={filterType} onValueChange={setFilterType}>
                <DropdownMenuRadioItem value="all">All types</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="physical">Physical</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="virtual">Virtual</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Reset filters */}
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground text-xs gap-1" onClick={() => { setFilterStatus("all"); setFilterCategory("all"); setFilterType("all"); }}>
              <X className="size-3.5" /> Clear ({activeFilters})
            </Button>
          )}

          {/* Columns toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 ml-auto">
                <Columns3 className="size-3.5" />
                Columns
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(DEFAULT_COLS) as ColKey[]).map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={cols[key]}
                  onCheckedChange={() => toggleCol(key)}
                  className="capitalize"
                >
                  {key === "sku" ? "SKU" : key.charAt(0).toUpperCase() + key.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add product */}
          <Button size="sm" className="h-9 gap-1.5 shrink-0" onClick={openNew}>
            <Plus className="size-4" /> Add product
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-14" />
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Product</th>
                {cols.status   && <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>}
                {cols.category && <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Category</th>}
                {cols.stock    && <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Stock</th>}
                {cols.sku      && <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">SKU</th>}
                {cols.type     && <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>}
                {cols.price    && <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Price</th>}
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleColCount} className="px-4 py-12 text-center text-muted-foreground">
                    {search || activeFilters > 0 ? "No products match your filters." : "No products yet. Click \"Add product\" to get started."}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const images = parseImages(p.images);
                  const thumb = images[0];
                  const tracksStock = Boolean(Number(p.trackStock));
                  const stock = Number(p.stock ?? p.inventory ?? 0);
                  const catName = categories.find((c) => c.id === String(p.categoryId))?.name;
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors group">
                      {/* Thumbnail */}
                      <td className="px-4 py-2.5">
                        <div className="size-9 rounded-lg bg-muted overflow-hidden border shrink-0">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt={String(p.name)} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="size-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Name */}
                      <td className="px-4 py-2.5">
                        <div className="font-medium leading-tight">{String(p.name)}</div>
                        {!cols.sku && p.sku && (
                          <div className="text-xs text-muted-foreground mt-0.5">SKU: {String(p.sku)}</div>
                        )}
                      </td>
                      {/* Status */}
                      {cols.status && (
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className={cn("text-xs", String(p.status).toLowerCase() !== "draft" ? "border-green-500/30 bg-green-500/10 text-green-700" : "")}>
                            {String(p.status).toLowerCase() === "draft" ? "Draft" : "Active"}
                          </Badge>
                        </td>
                      )}
                      {/* Category */}
                      {cols.category && (
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{catName ?? "—"}</td>
                      )}
                      {/* Stock */}
                      {cols.stock && (
                        <td className="px-4 py-2.5 tabular-nums">
                          {!tracksStock ? (
                            <span className="flex items-center gap-1 text-muted-foreground text-xs"><InfinityIcon className="size-3" /> Unlimited</span>
                          ) : (
                            <span className={cn("text-sm", stock === 0 && "text-red-500 font-medium", stock > 0 && stock <= 5 && "text-amber-600 font-medium")}>
                              {stock}
                              {stock === 0 && <span className="ml-1 text-xs font-normal text-red-400">out</span>}
                              {stock > 0 && stock <= 5 && <span className="ml-1 text-xs font-normal text-amber-500">low</span>}
                            </span>
                          )}
                        </td>
                      )}
                      {/* SKU */}
                      {cols.sku && (
                        <td className="px-4 py-2.5 text-sm text-muted-foreground tabular-nums">{p.sku ? String(p.sku) : "—"}</td>
                      )}
                      {/* Type */}
                      {cols.type && (
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{Number(p.isVirtual) ? "Virtual" : "Physical"}</td>
                      )}
                      {/* Price */}
                      {cols.price && (
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">€{Number(p.price).toFixed(2)}</td>
                      )}
                      {/* Actions */}
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(p)}>
                            <Edit className="size-3.5 text-muted-foreground" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8 hover:text-red-500" onClick={() => handleDelete(String(p.id))}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {products.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {products.length} products
          </p>
        )}
      </div>

      <ProductSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialData={editingProduct}
        categories={categories}
        taxGroups={taxGroups}
        onSave={handleSave}
      />
    </>
  );
}

// ── Inventory Tab ────────────────────────────────────────────────────────────

function InventoryTab({ turso }: { turso: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState<Record<string, string>>({});

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      await ensureProductSchemaColumns(turso);
      const res = await turso.execute("SELECT id, name, trackStock, stock, inventory, status FROM Product ORDER BY name ASC");
      setProducts(res.rows);
    } catch {
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [turso]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const saveStock = async (id: string) => {
    const raw = editingStock[id];
    if (raw === undefined) return;
    const qty = parseInt(raw) || 0;
    setSaving(id);
    try {
      await turso.execute({
        sql: "UPDATE Product SET stock = ?, inventory = ?, trackStock = 1, updatedAt = ? WHERE id = ?",
        args: [qty, qty, new Date().toISOString(), id],
      });
      toast.success("Stock updated");
      setEditingStock((prev) => { const n = { ...prev }; delete n[id]; return n; });
      window.dispatchEvent(new CustomEvent("webagt:shop-changed"));
      loadProducts();
    } catch {
      toast.error("Failed to update stock");
    } finally {
      setSaving(null);
    }
  };

  const setUnlimited = async (id: string) => {
    setSaving(id);
    try {
      await turso.execute({
        sql: "UPDATE Product SET trackStock = 0, updatedAt = ? WHERE id = ?",
        args: [new Date().toISOString(), id],
      });
      toast.success("Set to unlimited");
      loadProducts();
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  const tracked = products.filter((p) => Boolean(Number(p.trackStock)));
  const unlimited = products.filter((p) => !Boolean(Number(p.trackStock)));
  const outOfStock = tracked.filter((p) => Number(p.stock ?? p.inventory ?? 0) === 0);
  const lowStock = tracked.filter((p) => { const s = Number(p.stock ?? p.inventory ?? 0); return s > 0 && s <= 5; });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Inventory</h3>
        <Button size="sm" variant="ghost" className="gap-1.5 h-7 px-2" onClick={() => loadProducts()}>
          <RotateCw className="size-3.5" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 border rounded-xl bg-card shadow-sm">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Package className="size-3.5" /> Total products</div>
          <div className="text-2xl font-bold">{products.length}</div>
        </div>
        <div className="p-4 border rounded-xl bg-card shadow-sm">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><InfinityIcon className="size-3.5" /> Unlimited</div>
          <div className="text-2xl font-bold">{unlimited.length}</div>
        </div>
        <div className="p-4 border rounded-xl bg-card shadow-sm">
          <div className="text-xs text-amber-600 mb-1 flex items-center gap-1.5"><AlertTriangle className="size-3.5" /> Low stock (≤5)</div>
          <div className={cn("text-2xl font-bold", lowStock.length > 0 && "text-amber-600")}>{lowStock.length}</div>
        </div>
        <div className="p-4 border rounded-xl bg-card shadow-sm">
          <div className="text-xs text-red-500 mb-1 flex items-center gap-1.5"><X className="size-3.5" /> Out of stock</div>
          <div className={cn("text-2xl font-bold", outOfStock.length > 0 && "text-red-500")}>{outOfStock.length}</div>
        </div>
      </div>

      {/* Products table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tracking</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stock</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground w-44">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No products yet.</td></tr>
            ) : products.map((p) => {
              const tracksStock = Boolean(Number(p.trackStock));
              const stock = Number(p.stock ?? p.inventory ?? 0);
              const isEditing = editingStock[String(p.id)] !== undefined;
              return (
                <tr key={String(p.id)} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{String(p.name)}</td>
                  <td className="px-4 py-3">
                    {tracksStock ? (
                      <Badge variant="outline" className="text-xs border-blue-500/30 bg-blue-500/10 text-blue-700">Tracked</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs gap-1">
                        <InfinityIcon className="size-3" /> Unlimited
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tracksStock ? (
                      <span className={cn(
                        "text-sm font-medium tabular-nums",
                        stock === 0 && "text-red-500",
                        stock > 0 && stock <= 5 && "text-amber-600",
                      )}>
                        {stock}
                        {stock === 0 && <span className="ml-1 text-xs font-normal text-red-400">out of stock</span>}
                        {stock > 0 && stock <= 5 && <span className="ml-1 text-xs font-normal text-amber-500">low</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {tracksStock ? (
                        <>
                          {isEditing ? (
                            <>
                              <Input
                                type="number"
                                min="0"
                                className="h-7 w-20 text-xs"
                                value={editingStock[String(p.id)]}
                                onChange={(e) => setEditingStock((prev) => ({ ...prev, [String(p.id)]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === "Enter") saveStock(String(p.id)); if (e.key === "Escape") setEditingStock((prev) => { const n = { ...prev }; delete n[String(p.id)]; return n; }); }}
                                autoFocus
                              />
                              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => saveStock(String(p.id))} disabled={saving === String(p.id)}>
                                {saving === String(p.id) ? <Loader2 className="size-3 animate-spin" /> : "Save"}
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setEditingStock((prev) => ({ ...prev, [String(p.id)]: String(stock) }))}>
                              <Edit className="size-3" /> Edit stock
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setUnlimited(String(p.id))} disabled={saving === String(p.id)}>
                            Set unlimited
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setEditingStock((prev) => ({ ...prev, [String(p.id)]: "0" }))}>
                          <BarChart3 className="size-3" /> Track stock
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Shipping Tab ─────────────────────────────────────────────────────────────

async function ensureShippingSchema(turso: any) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS ShippingZone (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      countries TEXT DEFAULT '[]',
      createdAt TEXT,
      updatedAt TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ShippingRate (
      id TEXT PRIMARY KEY,
      zoneId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'flat',
      price REAL DEFAULT 0,
      minOrderAmount REAL,
      estimatedDays TEXT DEFAULT '2-5',
      active INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    )`,
  ];
  for (const sql of tables) {
    try { await turso.execute(sql); } catch { /* already exists */ }
  }
}

const COUNTRY_GROUPS: Record<string, string[]> = {
  "Netherlands": ["NL"],
  "Belgium & Luxembourg": ["BE", "LU"],
  "Europe": ["DE","FR","GB","ES","IT","AT","CH","SE","NO","DK","FI","PL","PT","IE","NL","BE","LU"],
  "Worldwide": ["*"],
};

function ShippingTab({ turso }: { turso: any }) {
  const [zones, setZones] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [showRateForm, setShowRateForm] = useState<string | null>(null); // zoneId
  const [zoneName, setZoneName] = useState("");
  const [zoneCountries, setZoneCountries] = useState("Netherlands");
  const [rateName, setRateName] = useState("");
  const [rateType, setRateType] = useState<"flat" | "free" | "free_above">("flat");
  const [ratePrice, setRatePrice] = useState("0");
  const [rateMinOrder, setRateMinOrder] = useState("");
  const [rateDays, setRateDays] = useState("2-5");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await ensureShippingSchema(turso);
      const [zRes, rRes] = await Promise.all([
        turso.execute("SELECT * FROM ShippingZone ORDER BY name ASC"),
        turso.execute("SELECT * FROM ShippingRate WHERE active = 1 ORDER BY zoneId, name ASC"),
      ]);
      setZones(zRes.rows);
      setRates(rRes.rows);
    } catch {
      toast.error("Failed to load shipping settings");
    } finally {
      setLoading(false);
    }
  }, [turso]);

  useEffect(() => { load(); }, [load]);

  const addZone = async () => {
    if (!zoneName.trim()) return;
    setSaving(true);
    try {
      const id = `zone_${Math.random().toString(36).slice(2, 9)}`;
      const countries = JSON.stringify(COUNTRY_GROUPS[zoneCountries] ?? [zoneCountries]);
      await turso.execute({
        sql: "INSERT INTO ShippingZone (id, name, countries, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
        args: [id, zoneName.trim(), countries, new Date().toISOString(), new Date().toISOString()],
      });
      toast.success("Shipping zone added");
      setZoneName(""); setZoneCountries("Netherlands"); setShowZoneForm(false);
      load();
    } catch { toast.error("Failed to add zone"); }
    finally { setSaving(false); }
  };

  const addRate = async (zoneId: string) => {
    if (!rateName.trim()) return;
    setSaving(true);
    try {
      const id = `rate_${Math.random().toString(36).slice(2, 9)}`;
      const price = rateType === "free" ? 0 : parseFloat(ratePrice) || 0;
      const minOrder = rateType === "free_above" ? parseFloat(rateMinOrder) || 0 : null;
      await turso.execute({
        sql: "INSERT INTO ShippingRate (id, zoneId, name, type, price, minOrderAmount, estimatedDays, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
        args: [id, zoneId, rateName.trim(), rateType, price, minOrder, rateDays.trim() || "2-5", new Date().toISOString(), new Date().toISOString()],
      });
      toast.success("Shipping rate added");
      setRateName(""); setRateType("flat"); setRatePrice("0"); setRateMinOrder(""); setRateDays("2-5"); setShowRateForm(null);
      load();
    } catch { toast.error("Failed to add rate"); }
    finally { setSaving(false); }
  };

  const deleteRate = async (id: string) => {
    try {
      await turso.execute({ sql: "UPDATE ShippingRate SET active = 0 WHERE id = ?", args: [id] });
      load();
    } catch { toast.error("Failed to delete rate"); }
  };

  const deleteZone = async (id: string) => {
    if (!confirm("Delete this zone and all its rates?")) return;
    try {
      await turso.execute({ sql: "DELETE FROM ShippingRate WHERE zoneId = ?", args: [id] });
      await turso.execute({ sql: "DELETE FROM ShippingZone WHERE id = ?", args: [id] });
      load();
    } catch { toast.error("Failed to delete zone"); }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Shipping</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Define where you ship and how much it costs.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowZoneForm(true)}>
          <Plus className="size-4" /> Add zone
        </Button>
      </div>

      {/* Add zone form */}
      {showZoneForm && (
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2"><MapPin className="size-4" /> New shipping zone</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Zone name</label>
              <Input placeholder="e.g. Netherlands" value={zoneName} onChange={(e) => setZoneName(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Countries</label>
              <select
                className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                value={zoneCountries}
                onChange={(e) => setZoneCountries(e.target.value)}
              >
                {Object.keys(COUNTRY_GROUPS).map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addZone} disabled={saving || !zoneName.trim()} className="gap-1.5">
              {saving && <Loader2 className="size-3 animate-spin" />} Add zone
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowZoneForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {zones.length === 0 && !showZoneForm && (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Truck className="size-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-foreground mb-1">No shipping zones yet</p>
          <p className="text-sm mb-4">Add a zone to define where and how you ship.</p>
          <Button size="sm" onClick={() => setShowZoneForm(true)} className="gap-1.5">
            <Plus className="size-4" /> Add your first zone
          </Button>
        </div>
      )}

      {/* Zones list */}
      {zones.map((zone) => {
        const zoneRates = rates.filter((r) => String(r.zoneId) === String(zone.id));
        return (
          <div key={String(zone.id)} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            {/* Zone header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                <span className="font-medium">{String(zone.name)}</span>
                <Badge variant="outline" className="text-xs">{(() => { try { const c = JSON.parse(String(zone.countries)); return c[0] === "*" ? "Worldwide" : `${c.length} countries`; } catch { return "—"; } })()}</Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => setShowRateForm(String(zone.id))}>
                  <Plus className="size-3" /> Add rate
                </Button>
                <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-red-500" onClick={() => deleteZone(String(zone.id))}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Add rate form */}
            {showRateForm === String(zone.id) && (
              <div className="px-4 py-3 border-b bg-muted/10 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Rate name</label>
                    <Input placeholder="e.g. Standard shipping" value={rateName} onChange={(e) => setRateName(e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                    <select
                      className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs"
                      value={rateType}
                      onChange={(e) => setRateType(e.target.value as typeof rateType)}
                    >
                      <option value="flat">Flat rate</option>
                      <option value="free">Always free</option>
                      <option value="free_above">Free above amount</option>
                    </select>
                  </div>
                  {rateType === "flat" && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Price (€)</label>
                      <Input type="number" min="0" step="0.01" placeholder="4.99" value={ratePrice} onChange={(e) => setRatePrice(e.target.value)} className="h-7 text-xs" />
                    </div>
                  )}
                  {rateType === "free_above" && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Free above (€)</label>
                      <Input type="number" min="0" step="0.01" placeholder="50.00" value={rateMinOrder} onChange={(e) => setRateMinOrder(e.target.value)} className="h-7 text-xs" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Est. days</label>
                    <Input placeholder="2-5" value={rateDays} onChange={(e) => setRateDays(e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 px-3 text-xs gap-1" onClick={() => addRate(String(zone.id))} disabled={saving || !rateName.trim()}>
                    {saving && <Loader2 className="size-3 animate-spin" />} Add rate
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowRateForm(null)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Rates list */}
            {zoneRates.length === 0 ? (
              <div className="px-4 py-4 text-sm text-muted-foreground text-center">
                No rates yet. Click "Add rate" to add a shipping option.
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {zoneRates.map((rate) => (
                    <tr key={String(rate.id)} className="hover:bg-muted/10 group">
                      <td className="px-4 py-2.5 font-medium">{String(rate.name)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {rate.type === "flat" && `€${Number(rate.price).toFixed(2)}`}
                        {rate.type === "free" && "Free"}
                        {rate.type === "free_above" && `Free above €${Number(rate.minOrderAmount).toFixed(2)}`}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{rate.estimatedDays ? `${rate.estimatedDays} days` : ""}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteRate(String(rate.id))}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Taxes Tab
// ─────────────────────────────────────────────────────────────────────────────

async function ensureTaxSchema(turso: any) {
  try {
    await turso.execute(`CREATE TABLE IF NOT EXISTS TaxGroup (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rate REAL NOT NULL DEFAULT 21,
      isDefault INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    )`);
  } catch { /* already exists */ }
}

async function ensureDefaultTaxGroup(turso: any) {
  const res = await turso.execute("SELECT id FROM TaxGroup LIMIT 1");
  if (!res.rows || res.rows.length === 0) {
    await turso.execute({
      sql: "INSERT INTO TaxGroup (id, name, rate, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)",
      args: ["tax_default", "Standard (BTW)", 21, new Date().toISOString(), new Date().toISOString()],
    });
  }
}

interface TaxGroupRow {
  id: string;
  name: string;
  rate: number;
  isDefault: number;
}

function TaxesTab({ turso }: { turso: any }) {
  const [groups, setGroups] = useState<TaxGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formRate, setFormRate] = useState("21");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await ensureTaxSchema(turso);
      await ensureDefaultTaxGroup(turso);
      const res = await turso.execute("SELECT * FROM TaxGroup ORDER BY isDefault DESC, name ASC");
      setGroups(
        (res.rows as any[]).map((r) => ({
          id: String(r.id),
          name: String(r.name),
          rate: Number(r.rate),
          isDefault: Number(r.isDefault),
        })),
      );
    } catch {
      toast.error("Failed to load tax groups");
    } finally {
      setLoading(false);
    }
  }, [turso]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setFormName("");
    setFormRate("21");
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (g: TaxGroupRow) => {
    setEditingId(g.id);
    setFormName(g.name);
    setFormRate(String(g.rate));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const rate = parseFloat(formRate) || 0;
      if (editingId) {
        await turso.execute({
          sql: "UPDATE TaxGroup SET name = ?, rate = ?, updatedAt = ? WHERE id = ?",
          args: [formName.trim(), rate, now, editingId],
        });
        toast.success("Tax group updated");
      } else {
        const id = `tax_${Math.random().toString(36).slice(2, 9)}`;
        await turso.execute({
          sql: "INSERT INTO TaxGroup (id, name, rate, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?)",
          args: [id, formName.trim(), rate, now, now],
        });
        toast.success("Tax group created");
      }
      resetForm();
      load();
    } catch {
      toast.error("Failed to save tax group");
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id: string) => {
    try {
      await turso.execute("UPDATE TaxGroup SET isDefault = 0");
      await turso.execute({ sql: "UPDATE TaxGroup SET isDefault = 1, updatedAt = ? WHERE id = ?", args: [new Date().toISOString(), id] });
      toast.success("Default tax group updated");
      load();
    } catch {
      toast.error("Failed to update default");
    }
  };

  const deleteGroup = async (id: string) => {
    const g = groups.find((g) => g.id === id);
    if (g?.isDefault) {
      toast.error("Cannot delete the default tax group");
      return;
    }
    if (!confirm("Delete this tax group?")) return;
    try {
      await turso.execute({ sql: "UPDATE Product SET taxGroupId = NULL WHERE taxGroupId = ?", args: [id] });
      await turso.execute({ sql: "DELETE FROM TaxGroup WHERE id = ?", args: [id] });
      toast.success("Tax group deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Taxes</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Manage tax rates. The default group applies to all products unless overridden.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="size-4" /> Add tax group
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Percent className="size-4" /> {editingId ? "Edit tax group" : "New tax group"}
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input placeholder="e.g. Reduced rate" value={formName} onChange={(e) => setFormName(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Rate (%)</label>
              <Input type="number" min="0" max="100" step="0.01" placeholder="21" value={formRate} onChange={(e) => setFormRate(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !formName.trim()} className="gap-1.5">
              {saving && <Loader2 className="size-3 animate-spin" />} {editingId ? "Save" : "Add"}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      {groups.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Percent className="size-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-foreground mb-1">No tax groups yet</p>
          <p className="text-sm mb-4">A default group (21% BTW) will be created automatically.</p>
        </div>
      )}

      <div className="space-y-2">
        {groups.map((g) => (
          <div
            key={g.id}
            className={cn(
              "flex items-center justify-between rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors",
              g.isDefault && "ring-1 ring-primary/30 border-primary/20",
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center justify-center size-9 rounded-lg text-sm font-bold",
                g.isDefault ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {g.rate}%
              </div>
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  {g.name}
                  {g.isDefault === 1 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Default</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">Tax rate: {g.rate}%</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!g.isDefault && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDefault(g.id)}>
                  Set default
                </Button>
              )}
              <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => startEdit(g)}>
                <Edit className="size-3.5" />
              </Button>
              {!g.isDefault && (
                <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-red-500" onClick={() => deleteGroup(g.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type OrderAction = "cancel" | "refund" | "delete" | null;

const ORDER_STATUS_STYLES: Record<string, string> = {
  PAID:       "bg-green-500/10 text-green-600 border-green-500/20",
  COMPLETED:  "bg-green-500/10 text-green-600 border-green-500/20",
  PENDING:    "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  CANCELLED:  "bg-red-500/10 text-red-600 border-red-500/20",
  REFUNDED:   "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full text-xs font-medium border",
      ORDER_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border",
    )}>
      {status}
    </span>
  );
}

function OrdersTab({ turso, project }: { turso: any; project: Project }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ id: string; orderNumber: string; action: OrderAction } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { bump, label } = useLastUpdated();
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);

  const loadOrders = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await turso.execute(`
        SELECT o.id, o.orderNumber, o.status, o.totalAmount, o.createdAt,
               o.shippingAddress, o.billingAddress,
               c.email, c.firstName, c.lastName
        FROM [Order] o
        LEFT JOIN Customer c ON o.customerId = c.id
        ORDER BY o.createdAt DESC
      `);
      setOrders(res.rows);
      bump();
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [turso, bump]);

  useEffect(() => {
    loadOrders();
    const timer = setInterval(() => loadOrders(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadOrders]);

  const openOrder = async (order: any) => {
    setSelectedOrder(order);
    setLoadingItems(true);
    try {
      const res = await turso.execute({
        sql: `SELECT oi.quantity, oi.unitPrice, p.name, p.images, p.sku
              FROM OrderItem oi
              LEFT JOIN Product p ON oi.productId = p.id
              WHERE oi.orderId = ?`,
        args: [order.id],
      });
      setOrderItems(res.rows);
    } catch {
      setOrderItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      if (pendingAction.action === "cancel") {
        try {
          const res = await client.orders.cancel(project.id, pendingAction.id);
          if (res.emailSent) {
            toast.success(`Order ${pendingAction.orderNumber} cancelled — customer notified.`);
          } else {
            toast.success(`Order ${pendingAction.orderNumber} cancelled.${res.emailReason ? ` (email skipped: ${res.emailReason})` : ""}`);
          }
        } catch (cancelErr: any) {
          if (cancelErr?.message?.includes("already cancelled")) {
            toast.info(`Order ${pendingAction.orderNumber} was already cancelled.`);
          } else {
            throw cancelErr;
          }
        }
        if (selectedOrder?.id === pendingAction.id) {
          setSelectedOrder((o: any) => ({ ...o, status: "CANCELLED" }));
        }
      } else if (pendingAction.action === "refund") {
        await client.orders.refund(project.id, pendingAction.id, project.paymentMode === "live" ? "live" : "test");
        toast.success(`Order ${pendingAction.orderNumber} refunded — refund email sent.`);
        if (selectedOrder?.id === pendingAction.id) {
          setSelectedOrder((o: any) => ({ ...o, status: "REFUNDED" }));
        }
      } else if (pendingAction.action === "delete") {
        // Direct Turso delete — no worker needed
        await turso.execute({ sql: "DELETE FROM OrderItem WHERE orderId = ?", args: [pendingAction.id] });
        await turso.execute({ sql: "DELETE FROM [Order] WHERE id = ?", args: [pendingAction.id] });
        toast.success(`Order ${pendingAction.orderNumber} deleted.`);
        if (selectedOrder?.id === pendingAction.id) setSelectedOrder(null);
      }
      await loadOrders(true);
    } catch (err: any) {
      toast.error(err?.message || "Action failed. Please try again.");
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  const actionMeta: Record<NonNullable<OrderAction>, { title: string; desc: (o: string) => string; label: string; destructive?: boolean }> = {
    cancel: {
      title: "Cancel order",
      desc: (n) => `Cancel order ${n}? The status will be updated to Cancelled. This cannot be undone.`,
      label: "Cancel order",
    },
    refund: {
      title: "Refund order",
      desc: (n) => `Issue a full refund for order ${n} via Stripe? The customer will receive a refund and a confirmation email.`,
      label: "Issue refund",
      destructive: true,
    },
    delete: {
      title: "Delete order",
      desc: (n) => `Permanently delete order ${n} from your database? This cannot be undone.`,
      label: "Delete",
      destructive: true,
    },
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Orders</h3>
          <div className="flex items-center gap-2">
            {label && <span className="text-xs text-muted-foreground">{label}</span>}
            <Button size="sm" variant="ghost" className="gap-1.5 h-7 px-2" onClick={() => loadOrders(true)} disabled={refreshing}>
              <RotateCw className={cn("size-3.5", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide">Order #</th>
                <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide">Date</th>
                <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide">Customer</th>
                <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-right">Total</th>
                <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    No orders yet. They will appear here when customers checkout.
                  </td>
                </tr>
              ) : orders.map(o => {
                const isDone = o.status === "CANCELLED" || o.status === "REFUNDED";
                const isPaid = o.status === "PAID" || o.status === "COMPLETED";
                return (
                  <React.Fragment key={o.id}>
                    <tr className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => openOrder(o)}>
                      <td className="px-4 py-3 font-medium text-primary">{o.orderNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(o.createdAt).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span>{o.firstName ? `${o.firstName} ${o.lastName ?? ""}`.trim() : "Guest"}</span>
                          {o.email && <span className="text-xs text-muted-foreground">{o.email}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-right font-medium">€{Number(o.totalAmount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Order actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <button
                              disabled={isDone}
                              onClick={(e) => { e.stopPropagation(); setPendingAction({ id: o.id, orderNumber: o.orderNumber, action: "cancel" }); }}
                              className={cn(
                                "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                                isDone ? "opacity-30 pointer-events-none" : "hover:bg-accent hover:text-accent-foreground",
                              )}
                            >
                              <XCircle className="size-3.5 text-muted-foreground" />
                              Cancel order
                            </button>
                            <button
                              disabled={!isPaid}
                              onClick={(e) => { e.stopPropagation(); setPendingAction({ id: o.id, orderNumber: o.orderNumber, action: "refund" }); }}
                              className={cn(
                                "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                                !isPaid ? "opacity-30 pointer-events-none" : "hover:bg-accent hover:text-accent-foreground",
                              )}
                            >
                              <DollarSign className="size-3.5 text-muted-foreground" />
                              Refund via Stripe
                            </button>
                            <DropdownMenuSeparator />
                            <button
                              onClick={(e) => { e.stopPropagation(); setPendingAction({ id: o.id, orderNumber: o.orderNumber, action: "delete" }); }}
                              className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-destructive/10 hover:text-destructive text-destructive/80"
                            >
                              <Trash2 className="size-3.5" />
                              Delete order
                            </button>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Order detail side panel ─────────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-y-0 right-0 z-50 flex">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40" onClick={() => setSelectedOrder(null)} />

          {/* Panel */}
          <div className="relative ml-auto w-[420px] max-w-full h-full bg-background border-l shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Order</p>
                <h3 className="text-base font-semibold">{selectedOrder.orderNumber}</h3>
              </div>
              <div className="flex items-center gap-2">
                <OrderStatusBadge status={selectedOrder.status} />
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Customer */}
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Customer</p>
                <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-0.5">
                  <p className="font-medium">
                    {selectedOrder.firstName
                      ? `${selectedOrder.firstName} ${selectedOrder.lastName ?? ""}`.trim()
                      : "Guest"}
                  </p>
                  {selectedOrder.email && <p className="text-muted-foreground">{selectedOrder.email}</p>}
                </div>
              </section>

              {/* Items */}
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Items</p>
                {loadingItems ? (
                  <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
                ) : orderItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items found.</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden divide-y">
                    {orderItems.map((item: any, i: number) => {
                      let imgSrc: string | null = null;
                      try { imgSrc = JSON.parse(item.images)?.[0] ?? null; } catch { /* ignore */ }
                      return (
                        <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-card text-sm">
                          {imgSrc ? (
                            <img src={imgSrc} alt={item.name} className="size-9 rounded object-cover shrink-0 bg-muted" />
                          ) : (
                            <div className="size-9 rounded bg-muted shrink-0 flex items-center justify-center">
                              <Package className="size-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.name}</p>
                            {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-medium">€{Number(item.unitPrice).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Totals */}
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Summary</p>
                <div className="rounded-lg border bg-card p-3 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span>{new Date(selectedOrder.createdAt).toLocaleString("nl-NL")}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1 border-t">
                    <span>Total</span>
                    <span>€{Number(selectedOrder.totalAmount).toFixed(2)}</span>
                  </div>
                </div>
              </section>

              {/* Addresses */}
              {(selectedOrder.shippingAddress || selectedOrder.billingAddress) && (
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Addresses</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Shipping", raw: selectedOrder.shippingAddress },
                      { label: "Billing", raw: selectedOrder.billingAddress },
                    ].map(({ label: lbl, raw }) => {
                      if (!raw) return null;
                      let addr: any = {};
                      try { addr = JSON.parse(raw); } catch { return null; }
                      return (
                        <div key={lbl} className="rounded-lg border bg-muted/20 p-3 text-xs space-y-0.5">
                          <p className="font-semibold text-muted-foreground mb-1">{lbl}</p>
                          {addr.name && <p>{addr.name}</p>}
                          {addr.line1 && <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>}
                          {(addr.postalCode || addr.city) && <p>{[addr.postalCode, addr.city].filter(Boolean).join(" ")}</p>}
                          {addr.country && <p>{addr.country}</p>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Order ID */}
              <section className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Order ID</p>
                <p className="font-mono text-xs text-muted-foreground break-all bg-muted/30 rounded px-2 py-1.5">{selectedOrder.id}</p>
              </section>
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t px-5 py-3 flex gap-2 flex-wrap">
              {(selectedOrder.status !== "CANCELLED" && selectedOrder.status !== "REFUNDED") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setPendingAction({ id: selectedOrder.id, orderNumber: selectedOrder.orderNumber, action: "cancel" })}
                >
                  <XCircle className="size-3.5" /> Cancel
                </Button>
              )}
              {(selectedOrder.status === "PAID" || selectedOrder.status === "COMPLETED") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setPendingAction({ id: selectedOrder.id, orderNumber: selectedOrder.orderNumber, action: "refund" })}
                >
                  <DollarSign className="size-3.5" /> Refund via Stripe
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive ml-auto"
                onClick={() => setPendingAction({ id: selectedOrder.id, orderNumber: selectedOrder.orderNumber, action: "delete" })}
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={(open) => { if (!open && !actionLoading) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction ? actionMeta[pendingAction.action!].title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction ? actionMeta[pendingAction.action!].desc(pendingAction.orderNumber) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={(e) => { e.preventDefault(); confirmAction(); }}
              className={cn(
                pendingAction && actionMeta[pendingAction.action!]?.destructive
                  ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  : "",
              )}
            >
              {actionLoading
                ? <><Loader2 className="size-4 animate-spin mr-2" /> Processing…</>
                : pendingAction ? actionMeta[pendingAction.action!].label : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PaymentsTab({
  project,
  onNavigate,
  onProjectChange,
}: {
  project: Project;
  onNavigate: (tab: Tab) => void;
  onProjectChange: (project: Project) => void;
}) {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [selectedMode, setSelectedMode] = useState<StripeMode>(
    project.paymentMode === "live" ? "live" : "test",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState<{
    type?: string;
    details_submitted: boolean;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    transfer_capability_active?: boolean;
    requirements?: {
      currently_due?: string[];
      past_due?: string[];
    };
  } | null>(null);
  const [balance, setBalance] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [orderRevenue, setOrderRevenue] = useState(0);
  const [manualAccountId, setManualAccountId] = useState("");

  const isPublished = Boolean(project.deployment_uuid);
  const accountId = getStripeAccountId(project, selectedMode);
  const paymentMode = project.paymentMode ?? "off";
  const isOnboarded = Boolean(
    stripeStatus?.details_submitted &&
      stripeStatus?.charges_enabled &&
      stripeStatus?.payouts_enabled &&
      stripeStatus?.transfer_capability_active !== false,
  );
  const step1Complete = Boolean(accountId && isOnboarded);
  const step2Complete = step1Complete && paymentMode !== "off";
  const step3Complete = step2Complete && isPublished;

  const refreshProject = async () => {
    const data = await client.projects.get(project.id);
    onProjectChange(data.project);
    return data.project;
  };

  const refreshStripeState = async (nextProject?: Project) => {
    const currentProject = nextProject ?? project;
    const currentAccountId = getStripeAccountId(currentProject, selectedMode);

    if (!currentAccountId) {
      setStripeStatus(null);
      setBalance(null);
      setPayouts([]);
      return;
    }

    const status = await client.stripe.getAccountStatus(currentAccountId, selectedMode);
    const [balanceData, payoutsData] = await Promise.all([
      client.stripe.getBalance(currentAccountId, selectedMode).catch(() => null),
      client.stripe.getPayouts(currentAccountId, selectedMode).catch(() => ({ data: [] })),
    ]);

    setStripeStatus(status);
    setBalance(balanceData);
    setPayouts(payoutsData.data || []);
  };

  useEffect(() => {
    setInitialLoading(true);
    refreshStripeState()
      .catch((error) => {
        console.error("Failed to load Stripe state:", error);
      })
      .finally(() => setInitialLoading(false));
  }, [project.id, project.stripeAccountId, project.stripeTestAccountId, project.stripeLiveAccountId, selectedMode]);

  useEffect(() => {
    setSelectedMode(project.paymentMode === "live" ? "live" : "test");
  }, [project.id]);

  useEffect(() => {
    setManualAccountId(accountId || "");
  }, [accountId, selectedMode]);

  useEffect(() => {
    async function loadCommerceStats() {
      if (!step3Complete || !project.databaseUrl || !project.databaseToken) {
        setOrderCount(0);
        setOrderRevenue(0);
        return;
      }
      try {
        const turso = createClient({
          url: project.databaseUrl,
          authToken: project.databaseToken,
        });
        const [ordersRes, revenueRes] = await Promise.all([
          turso.execute("SELECT count(*) as c FROM [Order]"),
          turso.execute("SELECT sum(totalAmount) as s FROM [Order] WHERE status != 'CANCELLED'"),
        ]);
        setOrderCount(Number(ordersRes.rows[0]?.c) || 0);
        setOrderRevenue(Number(revenueRes.rows[0]?.s) || 0);
      } catch (error) {
        console.error("Failed to load commerce stats:", error);
      }
    }

    loadCommerceStats();
  }, [project.databaseToken, project.databaseUrl, step3Complete]);

  const startOnboarding = async () => {
    setIsLoading(true);
    try {
      let nextAccountId = accountId;

      if (!nextAccountId) {
        const account = await client.stripe.createAccount(project.id, selectedMode);
        nextAccountId = account.accountId;
        const updatedProject = await refreshProject();
        await refreshStripeState(updatedProject);
      }

      const refreshUrl = window.location.href;
      const returnUrl = window.location.href;
      const link = await client.stripe.createAccountLink(
        nextAccountId!,
        refreshUrl,
        returnUrl,
        selectedMode,
      );
      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error("Stripe onboarding failed:", error);
      toast.error(error.message || "Failed to start Stripe onboarding");
    } finally {
      setIsLoading(false);
    }
  };

  const openDashboard = async () => {
    if (!accountId) return;
    setIsLoading(true);
    try {
      const link = await client.stripe.createLoginLink(accountId, selectedMode);
      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error("Failed to open Stripe dashboard:", error);
      toast.error(error.message || "Failed to open Stripe dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const setMode = async (nextMode: "off" | "test" | "live") => {
    if (nextMode !== "off" && !getStripeAccountId(project, nextMode)) {
      setSelectedMode(nextMode);
      toast.info(`Connect Stripe in ${nextMode} mode first.`);
      return;
    }

    if (nextMode === "live" && !isOnboarded) {
      toast.info("Complete Stripe onboarding before enabling live payments.");
      return;
    }

    setIsLoading(true);
    try {
      const data = await client.projects.update(project.id, { paymentMode: nextMode });
      onProjectChange(data.project);
      if (nextMode !== "off") {
        setSelectedMode(nextMode);
      }
      toast.success(
        nextMode === "off"
          ? "Payments disabled for this shop."
          : isPublished
            ? `${nextMode === "test" ? "Test" : "Live"} mode enabled.`
            : `${nextMode === "test" ? "Test" : "Live"} mode saved. It will be applied when you publish.`,
      );
    } catch (error: any) {
      console.error("Failed to update payment mode:", error);
      toast.error(error.message || "Failed to update payment mode");
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectStripe = async () => {
    setIsLoading(true);
    try {
      const data = await client.projects.update(project.id, {
        disconnectStripeMode: selectedMode,
      });
      onProjectChange(data.project);
      setStripeStatus(null);
      setBalance(null);
      setPayouts([]);
      toast.success(`Disconnected Stripe ${selectedMode} mode.`);
    } catch (error: any) {
      console.error("Failed to disconnect Stripe:", error);
      toast.error(error.message || "Failed to disconnect Stripe");
    } finally {
      setIsLoading(false);
    }
  };

  const saveManualAccountId = async () => {
    const normalized = manualAccountId.trim();
    if (!normalized) {
      toast.error("Paste a Stripe account ID first.");
      return;
    }
    if (!normalized.startsWith("acct_")) {
      toast.error("Stripe account IDs must start with acct_.");
      return;
    }

    setIsLoading(true);
    try {
      const data = await client.projects.update(project.id, {
        manualStripeAccountId: normalized,
        manualStripeMode: selectedMode,
      });
      onProjectChange(data.project);

      let syncedVersion: number | null = null;
      try {
        const syncResult = await client.projects.syncStripe(project.id);
        syncedVersion = syncResult.version;
        onProjectChange(syncResult.project);
        await refreshStripeState(syncResult.project);
      } catch (syncError: any) {
        console.error("Failed to sync Stripe files after manual save:", syncError);
        await refreshStripeState(data.project);
        toast.error(syncError.message || "Saved account ID, but failed to update Stripe files.");
        return;
      }

      toast.success(
        syncedVersion != null
          ? `Saved ${selectedMode} Stripe account ID and updated project files.`
          : `Saved ${selectedMode} Stripe account ID.`,
      );
    } catch (error: any) {
      console.error("Failed to save Stripe account ID:", error);
      toast.error(error.message || "Failed to save Stripe account ID");
    } finally {
      setIsLoading(false);
    }
  };

  // Determine which step is currently active (0-indexed)
  const activeStep = !step1Complete ? 0 : !step2Complete ? 1 : !step3Complete ? 2 : 3;

  if (initialLoading) {
    return (
      <div className="space-y-6 max-w-2xl animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="h-3 w-48 rounded bg-muted mt-2" />
          </div>
          <div className="h-6 w-16 rounded bg-muted" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border/50 p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="size-5 rounded-full bg-muted" />
              <div className="h-3 w-28 rounded bg-muted" />
            </div>
            <div className="h-4 w-44 rounded bg-muted" />
            <div className="h-3 w-72 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Payments</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Accept payments in 3 steps.</p>
        </div>
        <img src="/Stripe_Logo,_revised_2016.svg.png" alt="Stripe" className="h-6 w-auto opacity-60" />
      </div>

      {/* Steps */}
      <div className="space-y-3">

        {/* ── Step 1: Connect Stripe ── */}
        <div className={cn(
          "rounded-xl border transition-all",
          activeStep === 0
            ? "bg-card border-border shadow-sm"
            : step1Complete
              ? "bg-muted/20 border-border/50 opacity-60"
              : "bg-muted/5 border-border/20 opacity-20 pointer-events-none select-none",
        )}>
          <div className="p-5 space-y-4">
            {/* Step label + status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                  step1Complete ? "bg-green-500 text-white" : "bg-primary text-primary-foreground",
                )}>
                  {step1Complete ? "✓" : "1"}
                </span>
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Connect Stripe
                </span>
              </div>
              <div className="flex items-center gap-2">
                {step1Complete ? (
                  <Badge variant="outline" className="text-xs gap-1.5 border-green-500/30 bg-green-500/10 text-green-700">
                    <CheckCircle2 className="size-3" /> Connected
                  </Badge>
                ) : accountId ? (
                  <Badge variant="outline" className="text-xs gap-1.5 text-amber-600 border-amber-500/30 bg-amber-500/10">
                    Action needed
                  </Badge>
                ) : null}
                {/* Refresh icon-only */}
                {accountId && (
                  <button
                    type="button"
                    onClick={() => refreshStripeState().catch(() => toast.error("Failed to refresh"))}
                    disabled={isLoading}
                    title="Refresh Stripe status"
                    className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                  >
                    <RotateCw className={cn("size-3.5", isLoading && "animate-spin")} />
                  </button>
                )}
              </div>
            </div>

            {/* Title */}
            <h4 className="text-base font-semibold">
              {!accountId ? "Connect your Stripe account" : isOnboarded ? "Stripe is ready" : "Finish Stripe setup"}
            </h4>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {!accountId
                ? "We use Stripe to handle payments securely. Click below to create or connect a Stripe account."
                : isOnboarded
                  ? "Your Stripe account is fully set up and ready to accept payments."
                  : "Almost there — complete the onboarding form to activate your account."}
            </p>

            {/* Test / Live toggle + Setup Stripe side by side */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5">
                {(["test", "live"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMode(m)}
                    disabled={isLoading}
                    className={cn(
                      "rounded-md px-4 py-1.5 text-sm font-medium transition-all",
                      selectedMode === m
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m === "test" ? "Test" : "Live"}
                  </button>
                ))}
              </div>

              <Button onClick={startOnboarding} disabled={isLoading} className="gap-2">
                {isLoading
                  ? <Loader2 className="size-4 animate-spin" />
                  : <ArrowUpRight className="size-4" />}
                {!accountId ? "Setup Stripe" : isOnboarded ? "Re-onboard" : "Setup Stripe"}
              </Button>

              {accountId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={disconnectStripe}
                  disabled={isLoading}
                  className="gap-1.5 text-destructive hover:text-destructive ml-auto"
                >
                  <Trash2 className="size-3.5" /> Disconnect
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Step 2: Payment mode ── */}
        <div className={cn(
          "rounded-xl border transition-all",
          activeStep === 1
            ? "bg-card border-border shadow-sm"
            : step2Complete
              ? "bg-muted/20 border-border/50 opacity-60"
              : "bg-muted/5 border-border/20 opacity-15 pointer-events-none select-none",
        )}>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className={cn(
                "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                step2Complete ? "bg-green-500 text-white" : "bg-primary text-primary-foreground",
              )}>
                {step2Complete ? "✓" : "2"}
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Payment mode
              </span>
            </div>

            <h4 className="text-base font-semibold">
              {paymentMode === "off" ? "Choose a payment mode" : paymentMode === "test" ? "Test mode active" : "Live payments active"}
            </h4>

            <p className="text-sm text-muted-foreground">
              {paymentMode === "test"
                ? "Use test card numbers to simulate purchases without real money."
                : paymentMode === "live"
                  ? "Real customers can pay and funds go to your Stripe account."
                  : "Choose whether to enable test or live payments."}
            </p>

            <div className="grid grid-cols-3 gap-2">
              {(["off", "test", "live"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  disabled={isLoading || !step1Complete}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors capitalize",
                    paymentMode === m
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "off" ? "Off" : m === "test" ? "Test" : "Live"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Step 3: Publish ── */}
        <div className={cn(
          "rounded-xl border transition-all",
          activeStep === 2
            ? "bg-card border-border shadow-sm"
            : step3Complete
              ? "bg-muted/20 border-border/50 opacity-60"
              : "bg-muted/5 border-border/20 opacity-15 pointer-events-none select-none",
        )}>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className={cn(
                "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                step3Complete ? "bg-green-500 text-white" : "bg-primary text-primary-foreground",
              )}>
                {step3Complete ? "✓" : "3"}
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Publish
              </span>
            </div>

            <h4 className="text-base font-semibold">
              {isPublished ? "Shop is live" : "Publish your shop"}
            </h4>

            <p className="text-sm text-muted-foreground">
              {isPublished
                ? "Your storefront is live and accepting payments."
                : "Once Stripe is connected and a payment mode is set, publish to go live."}
            </p>

            <Button
              onClick={() => onNavigate("publish")}
              variant={isPublished ? "outline" : "default"}
              disabled={!step2Complete}
              className="gap-2"
            >
              <Globe className="size-4" />
              {isPublished ? "Go to Publish" : "Publish now"}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats (shown after full setup) */}
      {step3Complete && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {[
            { label: "Orders", value: String(orderCount) },
            { label: "Revenue", value: `€${orderRevenue.toFixed(2)}` },
            { label: "Balance", value: `€${((balance?.available?.[0]?.amount || 0) / 100).toFixed(2)}` },
            { label: "Payouts", value: payouts.length > 0 ? `${payouts.length}` : "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
              <div className="text-2xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const LOG_LEVEL_STYLES: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-amber-400",
  error: "text-red-400",
};

function LogsTab({ turso }: { turso: any }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "info" | "warn" | "error">("all");
  const { bump, label } = useLastUpdated();

  const loadLogs = useCallback(async (manual = false) => {
    if (!turso) { setLoading(false); return; }
    if (manual) setRefreshing(true);
    try {
      // Ensure table exists before querying
      await turso.execute("CREATE TABLE IF NOT EXISTS [_AppLog] (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL DEFAULT 'info', source TEXT, message TEXT NOT NULL, detail TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)");
      const res = await turso.execute("SELECT * FROM _AppLog ORDER BY id DESC LIMIT 200");
      setLogs(res.rows);
      bump();
    } catch (err) {
      console.error("Failed to load logs", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [turso, bump]);

  useEffect(() => {
    loadLogs();
    const timer = setInterval(() => loadLogs(), 8000);
    return () => clearInterval(timer);
  }, [loadLogs]);

  const clearLogs = async () => {
    if (!turso) return;
    try {
      await turso.execute("DELETE FROM _AppLog");
      setLogs([]);
      toast.success("Logs cleared");
    } catch { /* ignore */ }
  };

  const filtered = filter === "all" ? logs : logs.filter((l) => String(l.level) === filter);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  if (!turso) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-12">
        <Activity className="size-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No Database</h3>
        <p className="max-w-sm">Provision a database to start collecting logs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Activity Logs</h3>
        <div className="flex items-center gap-2">
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5">
            {(["all", "info", "warn", "error"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setFilter(l)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-all capitalize",
                  filter === l ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="gap-1.5 h-7 px-2" onClick={() => loadLogs(true)} disabled={refreshing}>
            <RotateCw className={cn("size-3.5", refreshing && "animate-spin")} />
          </Button>
          {logs.length > 0 && (
            <Button size="sm" variant="ghost" className="gap-1.5 h-7 px-2 text-destructive hover:text-destructive" onClick={clearLogs}>
              <Trash2 className="size-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border rounded-lg bg-card p-8 text-center text-muted-foreground text-sm">
          <Activity className="size-8 text-muted-foreground/30 mx-auto mb-3" />
          {logs.length === 0
            ? "No logs yet. Database operations, seed events, and errors will appear here automatically."
            : `No ${filter} logs found.`}
        </div>
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto font-mono text-xs divide-y divide-border">
            {filtered.map((log: any, i: number) => (
              <div key={log.id || i} className="px-3 py-2 hover:bg-muted/20 flex items-start gap-2">
                <span className={cn("uppercase font-bold w-12 shrink-0", LOG_LEVEL_STYLES[log.level] || "text-muted-foreground")}>
                  {String(log.level || "info").toUpperCase()}
                </span>
                <span className="text-muted-foreground/60 w-16 shrink-0 text-[10px]">
                  {log.createdAt ? new Date(log.createdAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                </span>
                {log.source && (
                  <span className="text-purple-400 shrink-0">[{log.source}]</span>
                )}
                <span className="text-foreground break-all">{log.message}</span>
                {log.detail && (
                  <span className="text-muted-foreground/60 break-all ml-auto">{String(log.detail).slice(0, 200)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function maskValue(value: string | undefined, visible = 6) {
  if (!value) return "Not configured";
  if (value.length <= visible * 2) return value;
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}

function copyText(value: string | undefined, label: string) {
  if (!value) {
    toast.error(`${label} is not available`);
    return;
  }
  navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

function NotificationSettingsSection({
  project,
  showHeader = true,
}: {
  project: Project;
  showHeader?: boolean;
}) {
  const [ownerNotificationEmails, setOwnerNotificationEmails] = useState<string[]>([]);
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [customerEmailsEnabled, setCustomerEmailsEnabled] = useState(true);
  const [emailSettings, setEmailSettings] = useState<ProjectEmailSettings | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [savingEmailSettings, setSavingEmailSettings] = useState(false);
  const [verifyingEmailDomain, setVerifyingEmailDomain] = useState(false);
  const { getToken } = useAuth();
  const { user } = useUser();

  const accountEmails = useMemo(
    () =>
      user?.emailAddresses
        ?.map((item) => item.emailAddress?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)) || [],
    [user?.emailAddresses],
  );

  useEffect(() => {
    const client = createApiClient(getToken);
    let cancelled = false;

    const loadEmailSettings = async () => {
      setEmailLoading(true);
      try {
        const settings = await client.projects.getEmailSettings(project.id);
        if (cancelled) return;
        setEmailSettings(settings);
        const savedEmails = settings.ownerNotificationEmails || [];
        const fallbackEmail = settings.ownerNotificationEmail
          ? [settings.ownerNotificationEmail]
          : [];
        const baseEmails =
          savedEmails.length > 0
            ? savedEmails
            : fallbackEmail.length > 0
              ? fallbackEmail
              : accountEmails;
        setOwnerNotificationEmails(Array.from(new Set(baseEmails)));
        setEmailDomain(settings.emailDomain || "");
        setCustomerEmailsEnabled(settings.orderCustomerEmailsEnabled);
      } catch (error) {
        if (!cancelled) {
          toast.error("Failed to load email settings");
          console.error(error);
        }
      } finally {
        if (!cancelled) setEmailLoading(false);
      }
    };

    loadEmailSettings();
    return () => {
      cancelled = true;
    };
  }, [accountEmails, getToken, project.id]);

  const handleSaveEmailSettings = async () => {
    setSavingEmailSettings(true);
    try {
      const client = createApiClient(getToken);
      const settings = await client.projects.updateEmailSettings(project.id, {
        ownerNotificationEmails,
        orderCustomerEmailsEnabled: customerEmailsEnabled,
        emailDomain,
      });
      setEmailSettings(settings);
      setOwnerNotificationEmails(settings.ownerNotificationEmails || []);
      toast.success("Email settings saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save email settings");
    } finally {
      setSavingEmailSettings(false);
    }
  };

  const handleVerifyEmailDomain = async () => {
    setVerifyingEmailDomain(true);
    try {
      const client = createApiClient(getToken);
      const settings = await client.projects.verifyEmailDomain(project.id);
      setEmailSettings(settings);
      setEmailDomain(settings.emailDomain || emailDomain);
      toast.success(
        settings.emailDomainStatus === "verified"
          ? "Email domain verified"
          : "Verification requested. Check DNS records/status below.",
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to verify email domain");
    } finally {
      setVerifyingEmailDomain(false);
    }
  };

  const handleAddOwnerEmail = () => {
    const candidate = newOwnerEmail.trim().toLowerCase();
    if (!candidate) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (ownerNotificationEmails.includes(candidate)) {
      setNewOwnerEmail("");
      return;
    }
    setOwnerNotificationEmails((prev) => [...prev, candidate]);
    setNewOwnerEmail("");
  };

  const handleRemoveOwnerEmail = (email: string) => {
    setOwnerNotificationEmails((prev) => prev.filter((item) => item !== email));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {showHeader && (
        <div>
          <h3 className="text-lg font-medium">Notifications</h3>
          <p className="text-sm text-muted-foreground">
            Configure order emails for shop owners and customers.
          </p>
        </div>
      )}

      <div className="p-6 border rounded-xl bg-card shadow-sm space-y-4">
        <div>
          <h4 className="font-medium">Order Email Notifications</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Shop owners always receive new-order emails. Customers can also receive order confirmations.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Shop owner notification email</label>
          <div className="flex gap-2">
            <Input
              placeholder="owner@yourshop.com"
              value={newOwnerEmail}
              onChange={(e) => setNewOwnerEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddOwnerEmail();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={handleAddOwnerEmail}>
              + Add
            </Button>
          </div>
          {ownerNotificationEmails.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {ownerNotificationEmails.map((email) => (
                <div
                  key={email}
                  className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs"
                >
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveOwnerEmail(email)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${email}`}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No owner email added yet. Add at least one recipient.
            </p>
          )}
          {accountEmails.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Account email detected: {accountEmails[0]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Customer email confirmations</label>
          <button
            type="button"
            onClick={() => setCustomerEmailsEnabled((value) => !value)}
            className={cn(
              "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
              customerEmailsEnabled
                ? "border-green-500/30 bg-green-500/10 text-green-700"
                : "border-muted bg-background text-muted-foreground",
            )}
          >
            {customerEmailsEnabled
              ? "Enabled: customers receive order confirmations."
              : "Disabled: only shop owner notifications are sent."}
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Custom sender domain (optional)</label>
          <Input
            placeholder="yourshop.com"
            value={emailDomain}
            onChange={(e) => setEmailDomain(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Fallback is always the platform sender until domain verification succeeds.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSaveEmailSettings}
            disabled={emailLoading || savingEmailSettings}
            variant="outline"
            className="gap-2"
          >
            {savingEmailSettings ? <Loader2 className="size-4 animate-spin" /> : <Settings2 className="size-4" />}
            Save Email Settings
          </Button>
          <Button
            onClick={handleVerifyEmailDomain}
            disabled={emailLoading || verifyingEmailDomain || !emailDomain.trim()}
            variant="outline"
            className="gap-2"
          >
            {verifyingEmailDomain ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Verify Email Domain
          </Button>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <div>
            Sender mode:{" "}
            <span className="font-medium text-foreground">
              {emailSettings?.emailSenderMode === "owner_verified"
                ? "Owner domain verified"
                : "Platform sender fallback"}
            </span>
          </div>
          <div>
            Domain status:{" "}
            <span className="font-medium text-foreground">
              {emailSettings?.emailDomainStatus || "unverified"}
            </span>
          </div>
          {emailSettings?.emailLastError && (
            <div className="text-red-500">Last verification error: {emailSettings.emailLastError}</div>
          )}
        </div>

        {emailSettings?.dnsRecords?.length ? (
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-medium">Manual DNS records (add at your DNS provider):</p>
            {emailSettings.dnsRecords.map((record, index) => (
              <div key={`${record.name}-${index}`} className="rounded border bg-background p-2 text-xs space-y-1">
                <div><span className="font-medium">Type:</span> {record.record}</div>
                <div><span className="font-medium">Name:</span> {record.name}</div>
                <div className="break-all"><span className="font-medium">Value:</span> {record.value}</div>
                <div><span className="font-medium">TTL:</span> {record.ttl}</div>
                <div><span className="font-medium">Status:</span> {record.status}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NotificationsTab({ project }: { project: Project }) {
  return <NotificationSettingsSection project={project} showHeader />;
}

async function ensureShopSettingsTable(turso: any) {
  try {
    await turso.execute(`CREATE TABLE IF NOT EXISTS ShopSetting (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT
    )`);
  } catch { /* already exists */ }
}

async function getShopSetting(turso: any, key: string, fallback: string): Promise<string> {
  try {
    const res = await turso.execute({ sql: "SELECT value FROM ShopSetting WHERE key = ?", args: [key] });
    return res.rows[0] ? String((res.rows[0] as any).value) : fallback;
  } catch { return fallback; }
}

async function setShopSetting(turso: any, key: string, value: string) {
  await turso.execute({
    sql: `INSERT INTO ShopSetting (key, value, updatedAt) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    args: [key, value, new Date().toISOString()],
  });
}

function SettingsTab({ project, turso }: { project: Project; turso: any }) {
  const [section, setSection] = useState<"general" | "database" | "notifications">("general");
  const [pricesIncludeTax, setPricesIncludeTax] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    if (!turso) { setSettingsLoading(false); return; }
    (async () => {
      await ensureShopSettingsTable(turso);
      const val = await getShopSetting(turso, "prices_include_tax", "true");
      setPricesIncludeTax(val === "true");
      setSettingsLoading(false);
    })();
  }, [turso]);

  const togglePricesIncludeTax = async (checked: boolean) => {
    setPricesIncludeTax(checked);
    if (!turso) return;
    try {
      await ensureShopSettingsTable(turso);
      await setShopSetting(turso, "prices_include_tax", String(checked));
      window.dispatchEvent(new CustomEvent("webagt:shop-changed"));
      toast.success(checked ? "Prices now include tax (incl. BTW)" : "Prices now exclude tax (excl. BTW)");
    } catch { toast.error("Failed to save setting"); }
  };

  const menuItems = [
    { id: "general" as const, label: "General" },
    { id: "database" as const, label: "Database" },
    { id: "notifications" as const, label: "Notifications" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h3 className="text-lg font-medium">Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage project configuration, database access, and communication settings.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
        <div className="rounded-2xl border bg-card p-3 shadow-sm h-fit">
          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  section === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          {section === "general" && (
            <div className="space-y-4">
              {/* Pricing */}
              <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
                <div>
                  <h4 className="font-medium">Pricing</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    How prices are displayed in your shop.
                  </p>
                </div>
                {settingsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
                    <div>
                      <div className="font-medium text-sm">Prices include tax (incl. BTW)</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pricesIncludeTax
                          ? "Product prices are shown including tax — this is the default for B2C shops."
                          : "Product prices are shown excluding tax — tax is added at checkout."}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={pricesIncludeTax}
                      onClick={() => togglePricesIncludeTax(!pricesIncludeTax)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                        pricesIncludeTax ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span className={cn(
                        "pointer-events-none inline-block size-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                        pricesIncludeTax ? "translate-x-5" : "translate-x-0",
                      )} />
                    </button>
                  </div>
                )}
              </div>

              {/* Project metadata */}
              <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
                <div>
                  <h4 className="font-medium">Project</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Basic metadata for this webshop project.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Name</div>
                    <div className="mt-2 font-medium">{project.name}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Type</div>
                    <div className="mt-2 font-medium capitalize">{project.type || "website"}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Template</div>
                    <div className="mt-2 font-medium">{project.templateId || "Start from scratch"}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Payment mode</div>
                    <div className="mt-2 font-medium uppercase">{project.paymentMode || "off"}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Created</div>
                    <div className="mt-2 font-medium">{new Date(project.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Updated</div>
                    <div className="mt-2 font-medium">{new Date(project.updatedAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === "database" && (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-medium">Database Access</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Turso connection details for this shop.
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(project.databaseUrl ? "border-green-500/30 bg-green-500/10 text-green-700" : "")}>
                    {project.databaseUrl ? "Connected" : "Not connected"}
                  </Badge>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Database URL</div>
                        <div className="mt-2 font-mono text-sm break-all">{project.databaseUrl || "No database URL configured"}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 shrink-0"
                        onClick={() => copyText(project.databaseUrl, "Database URL")}
                      >
                        <Copy className="size-3.5" />
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Database Token</div>
                        <div className="mt-2 font-mono text-sm break-all">{maskValue(project.databaseToken)}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 shrink-0"
                        onClick={() => copyText(project.databaseToken, "Database token")}
                      >
                        <Copy className="size-3.5" />
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Project ID</div>
                      <div className="mt-2 font-mono text-sm break-all">{project.id}</div>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current Version</div>
                      <div className="mt-2 font-medium">v{project.currentVersion}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === "notifications" && (
            <NotificationSettingsSection project={project} showHeader={false} />
          )}
        </div>
      </div>
    </div>
  );
}

function PublishTab({
  project,
  onProjectChange,
}: {
  project: Project;
  onProjectChange: (project: Project) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [domainMode, setDomainMode] = useState<"subdomain" | "custom">("subdomain");
  const [customDomain, setCustomDomain] = useState("");
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const { getToken } = useAuth();

  const isAlreadyDeployed = !!project.deployment_uuid;
  const siteUrl = deployedUrl || `https://agt-${project.id.substring(0,8)}.dock.4esh.nl`;
  const isDeploySuccess = logs.some(log => log.includes("✨ Deployment completed successfully!"));
  const isDeployFailed = logs.some(log => log.includes("❌ Deployment failed"));
  const isDeploying = loading;
  const paymentMode = project.paymentMode ?? "off";
  const hasSelectedModeAccount =
    paymentMode === "test"
      ? Boolean(getStripeAccountId(project, "test"))
      : paymentMode === "live"
        ? Boolean(getStripeAccountId(project, "live"))
        : false;
  const isPaymentsReadyForPublish =
    (paymentMode === "test" || paymentMode === "live") && hasSelectedModeAccount;
  const hasConnectedStripe =
    Boolean(project.stripeTestAccountId) ||
    Boolean(project.stripeLiveAccountId) ||
    Boolean(project.stripeAccountId);
  const paymentSummary =
    project.paymentMode === "live"
      ? "Live payments are active. Customers can place real orders."
      : project.paymentMode === "test"
        ? "Test mode is active. Use Stripe test cards to verify checkout."
        : hasConnectedStripe
          ? "Your site is live. Payments are currently off. Enable test mode from Payments when you are ready."
          : "Your site is live. Connect Stripe in Payments to start testing checkout.";

  const fireConfetti = () => {
    if (typeof window === "undefined") return;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js";
    script.onload = () => {
      (window as any).confetti?.({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
      });
    };
    document.head.appendChild(script);
  };
  
  const handlePublish = async () => {
    if (!isPaymentsReadyForPublish) {
      toast.info("Set up payments first in the Payments tab before publishing.");
      return;
    }
    setLoading(true);
    setLogs(["Pushing code to GitHub and initiating deployment on Coolify..."]);
    try {
      const payload: any = {};
      if (domainMode === "custom" && customDomain.trim()) {
        payload.customDomain = customDomain.trim();
      }

      const client = createApiClient(getToken);
      const data = await client.projects.publish(project.id, payload.customDomain);
      const refreshedProject = await client.projects.get(project.id);
      onProjectChange(refreshedProject.project);
      
      if (data.url) setDeployedUrl(data.url);

      if (!data.deploymentUuid) {
        setLogs(prev => [...prev, "Deployment triggered, but no tracking UUID returned.", `URL: ${data.url}`]);
        toast.success("Project published successfully!");
        setLoading(false);
        return;
      }
      
      setLogs(prev => [...prev, "Deployment started. Fetching real-time logs..."]);
      
      let isFinished = false;
      let lastLogsHash = "";
      
      const pollInterval = setInterval(async () => {
        try {
          const statusData = await client.projects.getDeploymentStatus(project.id, data.deploymentUuid);
          
          if (statusData.logs) {
            try {
              const currentLogsHash = statusData.logs.length.toString();
              
              if (currentLogsHash !== lastLogsHash) {
                lastLogsHash = currentLogsHash;
                const parsedLogs = JSON.parse(statusData.logs);
                const outputLogs = parsedLogs
                  .map((l: any) => l.output || "")
                  .filter(Boolean)
                  .map((log: string) => log.trim())
                  .filter((log: string) => log.length > 0);
                  
                if (outputLogs.length > 0) {
                   const uniqueLogs = outputLogs.filter((log: string, index: number, arr: string[]) => 
                     index === 0 || log !== arr[index - 1]
                   );
                   
                   setLogs([
                     "Pushing code to GitHub and initiating deployment on Coolify...", 
                     "Deployment started. Fetching real-time logs...", 
                     ...uniqueLogs
                   ]);
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
          
          if (statusData.status === "finished") {
            isFinished = true;
            clearInterval(pollInterval);
            setLoading(false);
            setLogs(prev => [...prev, "✨ Deployment completed successfully!", `URL: ${data.url}`]);
            fireConfetti();
            toast.success("Project published successfully!");
          } else if (statusData.status === "failed") {
            isFinished = true;
            clearInterval(pollInterval);
            setLoading(false);
            setLogs(prev => [...prev, "❌ Deployment failed. Please check the logs above."]);
            toast.error("Deployment failed");
          }
        } catch (e) {
           console.error("Polling error:", e);
        }
      }, 3000);
      
      setTimeout(() => {
        if (!isFinished) {
          clearInterval(pollInterval);
          setLoading(false);
          setLogs(prev => [...prev, "Deployment is taking a long time. It might still be running in the background."]);
        }
      }, 5 * 60 * 1000);

    } catch (err: any) {
      console.error(err);
      setLogs(prev => [...prev, `Error: ${err.message}`]);
      toast.error(err.message || "Failed to publish");
      setLoading(false);
    }
  };

  if ((isAlreadyDeployed && !isDeploying && logs.length === 0) || isDeploySuccess) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h3 className="text-lg font-medium">Publish Project</h3>
          <p className="text-sm text-muted-foreground">
            Deploy your webshop to the live internet using Coolify.
          </p>
        </div>

        <div className="p-8 bg-green-500/10 border border-green-500/20 rounded-xl text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="mx-auto w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="size-7 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-green-700">Your site is live!</h3>
          <p className="text-green-600/80 text-sm">
            Your webshop is deployed and accessible on the internet.
          </p>
          <div className="mx-auto max-w-xl rounded-xl border border-green-500/20 bg-white/70 px-4 py-3 text-sm text-green-900">
            {paymentSummary}
          </div>
          <div className="font-mono text-sm text-green-700 bg-green-500/10 rounded-lg py-2 px-4 inline-block">
            {siteUrl}
          </div>
          <div className="pt-3 flex justify-center gap-3">
            <Button 
              onClick={() => window.open(siteUrl, '_blank')}
              className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
            >
              <ExternalLink className="mr-2 size-4" />
              View Site
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setLogs([]);
                handlePublish();
              }}
              disabled={loading}
              className="gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
              Redeploy
            </Button>
          </div>
        </div>

        {logs.length > 0 && (
          <details className="group" open>
            <summary className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
              Deployment Logs
            </summary>
            <div className="mt-4 p-4 bg-muted/50 border rounded-lg font-mono text-xs space-y-1 max-h-64 overflow-y-auto flex flex-col-reverse shadow-inner">
              <div>
                {logs.map((log, i) => (
                  <div key={i} className={cn(
                    "whitespace-pre-wrap py-0.5",
                    log.startsWith("Error") || log.startsWith("Oops") ? "text-red-500 font-medium" : 
                    log.startsWith("✨") ? "text-green-500 font-medium" :
                    log.startsWith("URL:") ? "text-blue-500 underline cursor-pointer" :
                    "text-muted-foreground"
                  )}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-medium">Publish Project</h3>
        <p className="text-sm text-muted-foreground">
          Put your shop live in one click after payments are ready.
        </p>
      </div>

      {!isAlreadyDeployed && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Wallet className="size-5 text-amber-700 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-900">Prepare payments before you publish</h4>
              <p className="text-sm text-amber-800/90">
                Complete Step 1 (onboarding) and Step 2 (published mode) in the Payments tab first, then publish from this page.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 border rounded-xl bg-card shadow-sm space-y-6">
        <div className="space-y-4">
          <h4 className="font-medium">Domain Configuration</h4>
          
          <div className="flex gap-4">
            <button 
              onClick={() => setDomainMode("subdomain")}
              className={cn(
                "flex-1 p-4 rounded-xl border text-left transition-all",
                domainMode === "subdomain" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50"
              )}
            >
              <div className="font-medium mb-1">Free Subdomain</div>
              <div className="text-xs text-muted-foreground">agt-{project.id.substring(0,8)}.dock.4esh.nl</div>
            </button>
            
            <button 
              onClick={() => setDomainMode("custom")}
              className={cn(
                "flex-1 p-4 rounded-xl border text-left transition-all",
                domainMode === "custom" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50"
              )}
            >
              <div className="font-medium mb-1">Custom Domain</div>
              <div className="text-xs text-muted-foreground">Use your own domain</div>
            </button>
          </div>

          {domainMode === "custom" && (
            <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Domain</label>
                <Input 
                  placeholder="e.g. myshop.com" 
                  value={customDomain}
                  onChange={e => setCustomDomain(e.target.value)}
                />
              </div>
              
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <h5 className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-2">
                  <Activity className="size-4" />
                  DNS Configuration Required
                </h5>
                <p className="text-xs text-blue-600 mb-3">
                  Before publishing, please add an A record in your DNS settings pointing to our Coolify server IP:
                </p>
                <div className="bg-background border rounded font-mono text-sm p-3 flex justify-between items-center">
                  <span>{process.env.NEXT_PUBLIC_COOLIFY_IP || "62.251.109.139"}</span>
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => {
                    navigator.clipboard.writeText(process.env.NEXT_PUBLIC_COOLIFY_IP || "62.251.109.139");
                    toast.success("IP copied to clipboard");
                  }}>Copy</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t flex items-center justify-between">
          <div>
            <h4 className="font-medium">Live Deployment</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {isPaymentsReadyForPublish
                ? "Your site will be built and deployed publicly."
                : "Publishing is locked until payments are configured in the Payments tab."}
            </p>
          </div>
          <Button 
            onClick={handlePublish} 
            disabled={
              loading ||
              !isPaymentsReadyForPublish ||
              (domainMode === "custom" && !customDomain.trim())
            }
            className="gap-2"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
            {loading ? "Publishing..." : !isPaymentsReadyForPublish ? "Setup Payments First" : "Publish Now"}
          </Button>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="space-y-4">
          {isDeploying && (
            <div className="p-6 border rounded-xl bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Activity className="size-4 text-blue-500 animate-pulse" />
                  Deployment Progress
                </h4>
                <span className="text-xs text-muted-foreground font-mono">
                  Building container...
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="bg-primary h-2 rounded-full w-2/3 animate-pulse transition-all duration-1000 ease-in-out" />
              </div>
            </div>
          )}

          {isDeployFailed && (
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-center space-y-3">
              <h4 className="font-medium text-red-700">Deployment Failed</h4>
              <p className="text-sm text-red-600/80">Check the logs below for details.</p>
            </div>
          )}

          <details className="group" open={isDeployFailed}>
            <summary className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
              Advanced: Show Real-time Logs
            </summary>
            <div className="mt-4 p-4 bg-muted/50 border rounded-lg font-mono text-xs space-y-1 max-h-64 overflow-y-auto flex flex-col-reverse shadow-inner">
              <div>
                {logs.map((log, i) => (
                  <div key={i} className={cn(
                    "whitespace-pre-wrap py-0.5",
                    log.startsWith("Error") || log.startsWith("Oops") ? "text-red-500 font-medium" : 
                    log.startsWith("✨") ? "text-green-500 font-medium" :
                    log.startsWith("URL:") ? "text-blue-500 underline cursor-pointer" :
                    "text-muted-foreground"
                  )}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}