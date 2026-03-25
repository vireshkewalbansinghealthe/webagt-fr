"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createClient } from "@libsql/client/web";
import { useAuth, useUser } from "@clerk/nextjs";
import { createApiClient, type ProjectEmailSettings } from "@/lib/api-client";
import { ProductSheet, type ProductFormData } from "./product-sheet";

type Tab = "dashboard" | "products" | "orders" | "payments" | "publish" | "notifications" | "settings" | "logs";
type StripeMode = "test" | "live";

const TABS = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "products" as const, label: "Products", icon: Package },
  { id: "orders" as const, label: "Orders", icon: ShoppingBag },
  { id: "payments" as const, label: "Payments", icon: Wallet },
  { id: "publish" as const, label: "Publish", icon: ExternalLink },
  { id: "notifications" as const, label: "Notifications", icon: Bell },
  { id: "settings" as const, label: "Settings", icon: Settings2 },
  { id: "logs" as const, label: "Logs", icon: Activity },
];

function getStripeAccountId(project: Project, mode: StripeMode) {
  if (mode === "live") {
    return project.stripeLiveAccountId || (project.paymentMode === "live" ? project.stripeAccountId : undefined);
  }
  return project.stripeTestAccountId || project.stripeAccountId;
}

export function ShopManagerPanel({ project }: { project: Project }) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [projectState, setProjectState] = useState(project);

  useEffect(() => {
    setProjectState(project);
  }, [project]);
  
  const turso = useMemo(() => {
    if (!projectState.databaseUrl || !projectState.databaseToken) return null;
    return createClient({
      url: projectState.databaseUrl,
      authToken: projectState.databaseToken,
    });
  }, [projectState.databaseUrl, projectState.databaseToken]);

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
              <Database className="size-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Database Connected</h3>
              <p className="max-w-sm mb-6">
                This project does not have a Turso database provisioned. Webshops require a database to manage products and orders.
              </p>
            </div>
          ) : (
            <div className="h-full w-full p-6">
              {activeTab === "dashboard" && <DashboardTab turso={turso} />}
              {activeTab === "products" && <ProductsTab turso={turso} project={projectState} />}
              {activeTab === "orders" && <OrdersTab turso={turso} />}
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
                <SettingsTab project={projectState} />
              )}
              {activeTab === "logs" && <LogsTab />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- TABS ---

function DashboardTab({ turso }: { turso: any }) {
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [prodRes, orderRes, revRes] = await Promise.all([
          turso.execute("SELECT count(*) as c FROM Product"),
          turso.execute("SELECT count(*) as c FROM [Order]"),
          turso.execute("SELECT sum(totalAmount) as s FROM [Order] WHERE status != 'CANCELLED'")
        ]);
        
        setStats({
          products: Number(prodRes.rows[0].c) || 0,
          orders: Number(orderRes.rows[0].c) || 0,
          revenue: Number(revRes.rows[0].s) || 0,
        });
      } catch (err) {
        console.error("Failed to load stats", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [turso]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Dashboard Overview</h3>
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
    stock: Number(row.stock ?? row.inventory ?? 0),
    sku: String(row.sku ?? ""),
    isVirtual: Boolean(row.isVirtual),
    status: row.status === "draft" ? "draft" : "active",
    categoryId: String(row.categoryId ?? ""),
    images: parseImages(row.images),
  };
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
  const statements = [
    "ALTER TABLE Product ADD COLUMN slug TEXT",
    "ALTER TABLE Product ADD COLUMN compareAtPrice REAL",
    "ALTER TABLE Product ADD COLUMN sku TEXT",
    "ALTER TABLE Product ADD COLUMN isVirtual INTEGER DEFAULT 0",
    "ALTER TABLE Product ADD COLUMN status TEXT DEFAULT 'ACTIVE'",
    "ALTER TABLE Product ADD COLUMN categoryId TEXT",
    "ALTER TABLE Product ADD COLUMN inventory INTEGER DEFAULT 0",
    "ALTER TABLE Product ADD COLUMN stock INTEGER DEFAULT 0",
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

function ProductsTab({ turso, project }: { turso: any; project: Project }) {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<ProductFormData> | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      await ensureProductSchemaColumns(turso);
      let [prodRes, catRes] = await Promise.all([
        turso.execute("SELECT * FROM Product ORDER BY createdAt DESC"),
        turso.execute("SELECT id, name FROM Category ORDER BY name ASC").catch(() => ({ rows: [] })),
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
    } catch (err) {
      toast.error("Failed to load products");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [turso]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    try {
      await turso.execute({ sql: "DELETE FROM Product WHERE id = ?", args: [id] });
      toast.success("Product deleted");
      loadData();
    } catch {
      toast.error("Failed to delete product");
    }
  };

  const handleSave = async (data: ProductFormData) => {
    const imagesJson = JSON.stringify(data.images);
    const now = new Date().toISOString();
    try {
      await ensureProductSchemaColumns(turso);

      if (data.id) {
        await turso.execute({
          sql: `UPDATE Product SET
            name = ?, description = ?, price = ?, compareAtPrice = ?,
            stock = ?, inventory = ?, sku = ?, slug = ?, isVirtual = ?, status = ?, categoryId = ?, images = ?,
            updatedAt = ?
            WHERE id = ?`,
          args: [
            data.name, data.description, data.price, data.compareAtPrice,
            data.stock, data.stock, data.sku, slugifyProductName(data.name, data.id), data.isVirtual ? 1 : 0,
            data.status.toUpperCase(), data.categoryId || null,
            imagesJson, now, data.id,
          ],
        });
        toast.success("Product saved");
      } else {
        const id = `prod_${Math.random().toString(36).slice(2, 10)}`;
        await turso.execute({
          sql: `INSERT INTO Product
            (id, name, slug, description, price, compareAtPrice, stock, inventory, sku, isVirtual, status, categoryId, images, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id, data.name, slugifyProductName(data.name, id), data.description, data.price, data.compareAtPrice,
            data.stock, data.stock, data.sku, data.isVirtual ? 1 : 0, data.status.toUpperCase(), data.categoryId || null,
            imagesJson, now, now,
          ],
        });
        toast.success("Product added");
      }
      await loadData();
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

  const filtered = products.filter((p) =>
    !search || String(p.name).toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search products…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button size="sm" className="gap-2 shrink-0" onClick={openNew}>
            <Plus className="size-4" /> Add product
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-14" />
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stock</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground w-20" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    {search ? "No products match your search." : "No products yet. Click \"Add product\" to get started."}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const images = parseImages(p.images);
                  const thumb = images[0];
                  const stock = Number(p.stock ?? p.inventory ?? 0);
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="size-10 rounded-lg bg-muted overflow-hidden border shrink-0">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt={String(p.name)}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="size-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium leading-tight">{String(p.name)}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          {p.sku ? <span>SKU: {String(p.sku)}</span> : null}
                          <span>{Number(p.isVirtual) ? "Virtual" : "Ships"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={p.status === "draft" ? "secondary" : "outline"}
                          className={cn(
                            "text-xs capitalize",
                            String(p.status).toLowerCase() !== "draft" && "border-green-500/30 bg-green-500/10 text-green-700",
                          )}
                        >
                          {String(p.status).toLowerCase() === "draft" ? "Draft" : "Active"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <span className={cn("text-sm", stock === 0 && "text-red-500 font-medium")}>
                          {stock}
                        </span>
                        {stock === 0 && (
                          <span className="ml-1.5 text-xs text-red-400">out of stock</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        €{Number(p.price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => openEdit(p)}
                          >
                            <Edit className="size-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 hover:text-red-500"
                            onClick={() => handleDelete(String(p.id))}
                          >
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
        onSave={handleSave}
      />
    </>
  );
}

function OrdersTab({ turso }: { turso: any }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
        const res = await turso.execute(`
          SELECT o.*, c.email, c.firstName, c.lastName 
          FROM [Order] o 
          LEFT JOIN Customer c ON o.customerId = c.id 
          ORDER BY o.createdAt DESC
        `);
        setOrders(res.rows);
      } catch (err) {
        console.error("Failed to load orders", err);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, [turso]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Recent Orders</h3>
      <div className="border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Order #</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No orders yet. They will appear here when customers checkout.</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{o.orderNumber}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {o.firstName ? `${o.firstName} ${o.lastName}` : o.email || 'Guest'}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    o.status === 'COMPLETED' ? "bg-green-500/10 text-green-600" :
                    o.status === 'PENDING' ? "bg-yellow-500/10 text-yellow-600" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  €{Number(o.totalAmount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
    refreshStripeState().catch((error) => {
      console.error("Failed to load Stripe state:", error);
    });
  }, [project.id, project.stripeAccountId, project.stripeTestAccountId, project.stripeLiveAccountId, selectedMode]);

  useEffect(() => {
    if (project.paymentMode === "live") {
      setSelectedMode("live");
    } else if (project.paymentMode === "test") {
      setSelectedMode("test");
    }
  }, [project.paymentMode]);

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

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">Payments</h3>
          <p className="text-sm text-muted-foreground">
            Start accepting payments with Stripe in three simple steps.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            What do you want me to do now? Complete Step 1, then Step 2, then Step 3.
          </p>
        </div>
        <img
          src="/Stripe_Logo,_revised_2016.svg.png"
          alt="Stripe"
          className="h-8 w-auto opacity-90 mr-6"
        />
      </div>

      <>
          <div className="space-y-5">
            <div className="rounded-2xl border bg-card p-7 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground flex items-center gap-2">
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">1</span>
                    Stripe onboarding
                  </div>
                  <h4 className="text-xl font-semibold mt-2">
                    {!accountId
                      ? "Connect Stripe"
                      : isOnboarded
                        ? "Ready"
                        : "Onboarding in progress"}
                  </h4>
                </div>
                {isOnboarded ? (
                  <Badge
                    variant="outline"
                    className="inline-flex items-center gap-2 text-xs font-medium border-border bg-muted/40 text-foreground"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Onboarded
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="inline-flex items-center gap-2 text-xs font-medium border-border bg-muted/40 text-muted-foreground"
                  >
                    <Settings2 className="size-3.5" />
                    {accountId ? "Action needed" : "Not connected"}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                {!accountId
                  ? "We work with Stripe, a trusted global payment provider. Connect your Stripe account to start onboarding."
                  : isOnboarded
                    ? "Great, Stripe onboarding is complete. Next you can choose test or live payment mode."
                    : "Quick setup: finish Stripe onboarding so your shop can securely accept payments."}
              </p>

              {accountId && (
                <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Account ID: <span className="font-mono text-foreground">{accountId}</span>
                  {stripeStatus?.requirements?.currently_due?.length ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium text-foreground">
                        View onboarding details
                      </summary>
                      <p className="mt-2 text-xs">
                        Stripe still asks for a few business details:
                      </p>
                      <p className="mt-1 text-xs break-words">
                        {stripeStatus.requirements.currently_due.join(", ")}
                      </p>
                    </details>
                  ) : null}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={startOnboarding} disabled={isLoading} className="gap-2">
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
                  {!accountId ? "Connect Stripe" : isOnboarded ? "Re-onboard" : "Continue onboarding"}
                </Button>
                {accountId && (
                  <>
                    <Button variant="outline" onClick={() => refreshStripeState().catch(() => toast.error("Failed to refresh Stripe status"))} disabled={isLoading} className="gap-2">
                      <RotateCw className="size-4" />
                      Refresh status
                    </Button>
                    <Button variant="outline" onClick={openDashboard} disabled={isLoading || !isOnboarded} className="gap-2">
                      <ExternalLink className="size-4" />
                      Stripe Dashboard
                    </Button>
                    <Button variant="ghost" onClick={disconnectStripe} disabled={isLoading} className="text-destructive hover:text-destructive gap-2">
                      <Trash2 className="size-4" />
                      Disconnect
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div
              className={cn(
                "rounded-2xl border bg-card p-7 shadow-sm space-y-5 transition-opacity",
                !step1Complete && "opacity-60",
              )}
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground flex items-center gap-2">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">2</span>
                  Published shop payment mode
                </div>
                <h4 className="text-xl font-semibold mt-2">
                  {paymentMode === "off"
                    ? "Payments are off"
                    : paymentMode === "test"
                      ? "Test mode is active"
                      : "Live payments are active"}
                </h4>
              </div>

              <p className="text-sm text-muted-foreground">
                {!isPublished
                  ? "Choose which mode should be active when this shop is published."
                  : paymentMode === "off"
                    ? "Checkout is disabled on the published site until you choose test or live mode."
                    : paymentMode === "test"
                      ? "Customers can complete Stripe test checkouts and you can verify orders and webhooks safely."
                      : "Customers can place real orders and payouts will go to the connected live Stripe account."}
              </p>

              <div className="grid grid-cols-3 gap-2">
                <Button variant={paymentMode === "off" ? "default" : "outline"} onClick={() => setMode("off")} disabled={isLoading || !step1Complete}>
                  Off
                </Button>
                <Button variant={paymentMode === "test" ? "default" : "outline"} onClick={() => setMode("test")} disabled={isLoading || !step1Complete}>
                  Test
                </Button>
                <Button variant={paymentMode === "live" ? "default" : "outline"} onClick={() => setMode("live")} disabled={isLoading || !step1Complete}>
                  Live
                </Button>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                {!step1Complete ? (
                  "Complete Step 1 onboarding first."
                ) : !accountId ? (
                  "Connect Stripe in the selected mode first."
                ) : !isOnboarded ? (
                  "Finish onboarding to unlock this mode."
                ) : !isPublished ? (
                  "This mode is ready. Publish the shop when you want the hosted storefront to use it."
                ) : (
                  "The platform will sync Stripe config to the published shop automatically when you change it here."
                )}
              </div>
            </div>

            <div
              className={cn(
                "rounded-2xl border bg-card p-7 shadow-sm space-y-5 transition-opacity",
                !step2Complete && "opacity-60",
              )}
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground flex items-center gap-2">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">3</span>
                  Publish
                </div>
                <h4 className="text-xl font-semibold mt-2">
                  {isPublished ? "Shop is published" : "Publish your shop"}
                </h4>
              </div>

              <p className="text-sm text-muted-foreground">
                {isPublished
                  ? "Your storefront is already live. You can republish anytime from the Publish tab."
                  : "When onboarding and payment mode are ready, publish to make checkout available on your hosted storefront."}
              </p>

              <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                {!accountId
                  ? "Step 1 is incomplete: connect Stripe first."
                  : !isOnboarded
                    ? "Step 1 is incomplete: finish Stripe onboarding."
                    : paymentMode === "off"
                      ? "Step 2 is incomplete: choose test or live mode."
                      : !isPublished
                        ? "Ready to publish."
                        : "Published and running."}
              </div>

              <Button
                onClick={() => onNavigate("publish")}
                className="gap-2"
                variant={isPublished ? "outline" : "default"}
                disabled={!step2Complete}
              >
                <Globe className="size-4" />
                {isPublished ? "Open Publish tab" : "Go to Publish"}
              </Button>
            </div>
          </div>

          {step3Complete && (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="text-sm font-medium text-muted-foreground mb-2">Total orders</div>
                <div className="text-3xl font-bold">{orderCount}</div>
              </div>
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="text-sm font-medium text-muted-foreground mb-2">Total revenue</div>
                <div className="text-3xl font-bold">€{orderRevenue.toFixed(2)}</div>
              </div>
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="text-sm font-medium text-muted-foreground mb-2">Current balance</div>
                <div className="text-3xl font-bold">
                  €{((balance?.available?.[0]?.amount || 0) / 100).toFixed(2)}
                </div>
              </div>
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="text-sm font-medium text-muted-foreground mb-2">Recent payouts</div>
                <div className="text-sm text-muted-foreground">
                  {payouts.length > 0 ? `${payouts.length} recent payout${payouts.length === 1 ? "" : "s"}` : "No payouts yet"}
                </div>
              </div>
            </div>
          )}
        </>
    </div>
  );
}

function LogsTab() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-12">
      <Activity className="size-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-2">Activity Logs</h3>
      <p className="max-w-sm">
        API request logs, database queries, and webhook events will appear here.
      </p>
      <div className="mt-8 text-xs font-mono bg-muted p-4 rounded-lg text-left w-full max-w-md">
        <div className="text-green-500">[SYSTEM] Worker initialized</div>
        <div className="text-blue-500">[TURSO] Connected to edge database</div>
        <div className="text-muted-foreground">[READY] Waiting for events...</div>
      </div>
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

function SettingsTab({ project }: { project: Project }) {
  const [section, setSection] = useState<"general" | "database" | "notifications">("general");

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