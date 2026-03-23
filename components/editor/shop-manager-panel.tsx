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
  RotateCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClient } from "@libsql/client/web";
import { useAuth } from "@clerk/nextjs";
import { createApiClient } from "@/lib/api-client";

type Tab = "dashboard" | "products" | "orders" | "stripe" | "publish" | "logs";

const TABS = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "products" as const, label: "Products", icon: Package },
  { id: "orders" as const, label: "Orders", icon: ShoppingBag },
  { id: "stripe" as const, label: "Stripe", icon: CreditCard },
  { id: "publish" as const, label: "Publish", icon: ExternalLink },
  { id: "logs" as const, label: "Logs", icon: Activity },
];

export function ShopManagerPanel({ project }: { project: Project }) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  
  const turso = useMemo(() => {
    if (!project.databaseUrl || !project.databaseToken) return null;
    return createClient({
      url: project.databaseUrl,
      authToken: project.databaseToken,
    });
  }, [project.databaseUrl, project.databaseToken]);

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
            Manage your Turso database and Stripe connect for {project.name}
          </p>
        </div>
        {project.databaseUrl && (
          <div className="flex items-center gap-2 text-xs font-medium bg-green-500/10 text-green-600 px-3 py-1.5 rounded-full border border-green-500/20">
            <Database className="size-3.5" />
            Connected to Turso
          </div>
        )}
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
          {!turso ? (
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
              {activeTab === "products" && <ProductsTab turso={turso} />}
              {activeTab === "orders" && <OrdersTab turso={turso} />}
              {activeTab === "stripe" && <StripeTab project={project} onNavigate={setActiveTab} />}
              {activeTab === "publish" && <PublishTab project={project} />}
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

function ProductsTab({ turso }: { turso: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await turso.execute("SELECT * FROM Product ORDER BY createdAt DESC");
      setProducts(res.rows);
    } catch (err) {
      toast.error("Failed to load products");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [turso]);

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setEditForm({ ...product });
  };

  const handleSave = async () => {
    try {
      await turso.execute({
        sql: "UPDATE Product SET name = ?, price = ?, stock = ?, images = ? WHERE id = ?",
        args: [editForm.name, editForm.price, editForm.stock, editForm.images, editForm.id]
      });
      toast.success("Product updated");
      setEditingId(null);
      loadProducts();
    } catch (err) {
      toast.error("Failed to update product");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await turso.execute({ sql: "DELETE FROM Product WHERE id = ?", args: [id] });
      toast.success("Product deleted");
      loadProducts();
    } catch (err) {
      toast.error("Failed to delete product");
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Products</h3>
        <Button size="sm" className="gap-2" onClick={() => toast.info("Add product coming soon")}>
          <Plus className="size-4" /> Add Product
        </Button>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Image</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No products found. Add some or ask AI to generate them.</td></tr>
            ) : products.map(p => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  {editingId === p.id ? (
                    <Input 
                      value={editForm.images || ""} 
                      onChange={e => setEditForm({...editForm, images: e.target.value})} 
                      placeholder="Image URL JSON array"
                      className="h-8 text-xs"
                    />
                  ) : (
                    <div className="size-10 rounded-md bg-muted overflow-hidden shrink-0 border">
                      {p.images && p.images.length > 5 ? (
                        <img src={JSON.parse(p.images)[0]} alt={p.name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = 'https://placehold.co/100x100?text=No+Image')} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">None</div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">
                  {editingId === p.id ? (
                    <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="h-8" />
                  ) : p.name}
                </td>
                <td className="px-4 py-3">
                  {editingId === p.id ? (
                    <Input type="number" step="0.01" value={editForm.price} onChange={e => setEditForm({...editForm, price: parseFloat(e.target.value)})} className="h-8 w-24" />
                  ) : `€${Number(p.price).toFixed(2)}`}
                </td>
                <td className="px-4 py-3">
                  {editingId === p.id ? (
                    <Input type="number" value={editForm.stock || 0} onChange={e => setEditForm({...editForm, stock: parseInt(e.target.value)})} className="h-8 w-20" />
                  ) : (p.stock || p.inventory || 0)}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === p.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" className="h-8 px-3" onClick={handleSave}>Save</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => handleEdit(p)}>
                        <Edit className="size-4 text-muted-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 hover:text-red-500" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

function StripeTab({ project, onNavigate }: { project: Project; onNavigate: (tab: Tab) => void }) {
  const [loading, setLoading] = useState(false);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{ details_submitted: boolean; charges_enabled: boolean; payouts_enabled: boolean; capabilities?: any } | null>(null);
  const [balance, setBalance] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [updatingMethods, setUpdatingMethods] = useState(false);
  
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);

  const enabledMethods = useMemo(() => project.stripePaymentMethods || ["card", "ideal"], [project.stripePaymentMethods]);

  const togglePaymentMethod = async (method: string) => {
    setUpdatingMethods(true);
    try {
      const newMethods = enabledMethods.includes(method)
        ? enabledMethods.filter(m => m !== method)
        : [...enabledMethods, method];
      
      if (newMethods.length === 0) newMethods.push("card");

      await client.projects.update(project.id, { stripePaymentMethods: newMethods });
      toast.success(`${method} updated — changes apply immediately to your live shop`);
    } catch (error) {
      toast.error("Failed to update payment methods");
    } finally {
      setUpdatingMethods(false);
    }
  };

  const fetchData = async (id: string) => {
    setIsChecking(true);
    try {
      const [status, balRes, payoutsRes] = await Promise.all([
        client.stripe.getAccountStatus(id),
        client.stripe.getBalance(id),
        client.stripe.getPayouts(id)
      ]);
      setStripeStatus(status);
      setBalance(balRes);
      setPayouts(payoutsRes.data || []);
    } catch (error) {
      console.error("Failed to fetch Stripe data:", error);
      toast.error("Failed to sync with Stripe");
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (project.stripeAccountId) {
      fetchData(project.stripeAccountId);
    }
  }, [project.stripeAccountId]);

  const handleConnectStripe = async () => {
    setLoading(true);
    try {
      let accountId = project.stripeAccountId;

      // 1. Create a Stripe Express connected account via our backend API if not already created
      if (!accountId) {
        const createData = await client.stripe.createAccount(project.id);
        
        if (!createData.accountId) {
          throw new Error("Failed to create account");
        }
        accountId = createData.accountId;
      }

      // 2. Create an account link for onboarding OR a login link if already onboarded
      const isFullyOnboarded = stripeStatus?.details_submitted && stripeStatus?.charges_enabled;
      
      if (isFullyOnboarded) {
        const loginData = await client.stripe.createLoginLink(accountId);
        if (loginData.url) {
          window.open(loginData.url, '_blank');
          return;
        }
      }

      const linkData = await client.stripe.createAccountLink(
        accountId,
        window.location.href, // refreshUrl
        window.location.href  // returnUrl
      );

      if (!linkData.url) {
        throw new Error("Failed to create account link");
      }

      setOnboardingUrl(linkData.url);
      window.open(linkData.url, '_blank');

    } catch (error: any) {
      toast.error("Stripe setup failed: " + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isFullyOnboarded = stripeStatus?.details_submitted && stripeStatus?.charges_enabled;

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">Stripe Connect Integration</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your payments, balance, and payouts for {project.name}.
          </p>
        </div>
        
        {project.stripeAccountId && (
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => fetchData(project.stripeAccountId!)}
            disabled={isChecking}
          >
            {isChecking ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
            Refresh
          </Button>
        )}
      </div>

      {isFullyOnboarded ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Balance Card */}
          <div className="space-y-4 p-6 border rounded-xl bg-card shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <Wallet className="size-5" />
                <h4 className="font-bold">Current Balance</h4>
              </div>
              <Button variant="ghost" size="xs" onClick={() => project.stripeAccountId && fetchData(project.stripeAccountId)} disabled={isChecking}>
                <Activity className={cn("size-3 mr-1", isChecking && "animate-spin")} />
                Refresh
              </Button>
            </div>
            
            <div className="space-y-3 mt-4">
              {balance?.available?.map((bal: any, i: number) => (
                <div key={i} className="flex items-end justify-between border-b border-border pb-2">
                  <span className="text-sm text-muted-foreground uppercase font-medium">Available</span>
                  <span className="text-2xl font-bold">€{(bal.amount / 100).toFixed(2)}</span>
                </div>
              ))}
              {balance?.pending?.map((bal: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Pending (Processing)</span>
                  <span>€{(bal.amount / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button size="sm" className="flex-1 gap-2" onClick={handleConnectStripe}>
                <Settings2 className="size-4" />
                Stripe Dashboard
              </Button>
            </div>
          </div>

          {/* Status Card */}
          <div className="space-y-4 p-6 border border-green-500/20 rounded-xl bg-green-500/5 shadow-sm">
            <div className="flex items-center gap-3 text-green-600 mb-2">
              <div className="size-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Activity className="size-6" />
              </div>
              <div>
                <h4 className="font-bold text-base">Account Status</h4>
                <p className="text-xs text-green-600/80">Active & Ready</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-3 text-xs mt-4">
              <div className="flex items-center justify-between p-2 rounded bg-white/50 dark:bg-black/20 border border-green-500/10">
                <span className="text-muted-foreground font-medium">Identity Verification</span>
                <span className="text-green-600 font-bold flex items-center gap-1">
                  <div className="size-1.5 rounded-full bg-green-500" /> Verified
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-white/50 dark:bg-black/20 border border-green-500/10">
                <span className="text-muted-foreground font-medium">Payouts</span>
                <span className="text-green-600 font-bold flex items-center gap-1">
                  <div className="size-1.5 rounded-full bg-green-500" /> Enabled
                </span>
              </div>
            </div>
          </div>

          {/* Payment Methods Card */}
          <div className="md:col-span-2 space-y-4 p-6 border rounded-xl bg-card shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <CreditCard className="size-5" />
                <h4 className="font-bold">Payment Methods</h4>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Controls Checkout options</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              {[
                { id: "card", label: "Credit Card", icon: "💳" },
                { id: "ideal", label: "iDEAL", icon: "🏦" },
                { id: "klarna", label: "Klarna", icon: "🛍️" },
                { id: "bancontact", label: "Bancontact", icon: "🇧🇪" },
                { id: "giropay", label: "Giropay", icon: "🇩🇪" },
                { id: "eps", label: "EPS", icon: "🇦🇹" },
                { id: "p24", label: "Przelewy24", icon: "🇵🇱" },
                { id: "sofort", label: "Sofort", icon: "⚡" },
              ].map((method) => {
                const isEnabled = enabledMethods.includes(method.id);
                // Check if the account actually has the capability from Stripe
                const capability = stripeStatus?.capabilities?.[`${method.id}_payments`];
                const isSupported = capability === 'active' || method.id === 'card';

                return (
                  <button
                    key={method.id}
                    disabled={updatingMethods || !isSupported}
                    onClick={() => togglePaymentMethod(method.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all text-center gap-2 relative overflow-hidden group",
                      isEnabled 
                        ? "border-primary bg-primary/5 text-primary shadow-sm" 
                        : "border-border bg-muted/20 text-muted-foreground hover:border-border/80",
                      !isSupported && "opacity-50 grayscale cursor-not-allowed"
                    )}
                  >
                    <span className="text-2xl">{method.icon}</span>
                    <span className="text-xs font-bold">{method.label}</span>
                    {isEnabled && (
                      <div className="absolute top-1 right-1">
                        <div className="size-3 bg-primary rounded-full flex items-center justify-center">
                          <Plus className="size-2 text-primary-foreground rotate-45" />
                        </div>
                      </div>
                    )}
                    {!isSupported && (
                      <span className="text-[8px] absolute bottom-1 uppercase font-bold text-red-500">Not Active</span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              * Some methods require activation in your Stripe Dashboard. If a method is greyed out, make sure it is enabled under 'Settings &gt; Payment Methods' in Stripe.
            </p>
          </div>

          {/* Recent Payouts */}
          <div className="md:col-span-2 space-y-4 p-6 border rounded-xl bg-card shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-bold flex items-center gap-2">
                <ArrowUpRight className="size-5 text-primary" />
                Recent Payouts
              </h4>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2 font-bold">Date</th>
                    <th className="px-4 py-2 font-bold">Amount</th>
                    <th className="px-4 py-2 font-bold">Status</th>
                    <th className="px-4 py-2 font-bold text-right">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payouts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No payouts found yet.
                      </td>
                    </tr>
                  ) : payouts.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">{new Date(p.created * 1000).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-bold">€{(p.amount / 100).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          p.status === 'paid' ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"
                        )}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{p.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-6 border-2 border-dashed border-primary/30 rounded-2xl bg-primary/5 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-lg flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              Start Accepting Payments
            </h4>
            {project.stripeAccountId && (
              <Button variant="outline" size="xs" onClick={() => fetchData(project.stripeAccountId!)} disabled={isChecking} className="h-6 px-2 text-[10px] uppercase tracking-widest font-bold">
                {isChecking ? <Loader2 className="size-2 mr-1 animate-spin" /> : <Activity className="size-2 mr-1 text-primary" />}
                Refresh Status
              </Button>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed">
            {project.stripeAccountId 
              ? "Your Stripe account is created, but verification isn't complete. Once you finish onboarding, the AI will automatically pick up your credentials and enable real payments on your website." 
              : "To start selling real products and receiving payouts, you need to connect a Stripe account. This only takes a few minutes and will fully automate your shop's checkout process."}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {onboardingUrl ? (
              <Button onClick={() => window.open(onboardingUrl, '_blank')} className="flex-1 font-bold h-12 gap-2 text-base shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">
                Complete Onboarding
                <ExternalLink className="size-5" />
              </Button>
            ) : (
              <Button onClick={handleConnectStripe} disabled={loading} className="flex-1 font-bold h-12 gap-2 text-base shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">
                {loading ? <Loader2 className="size-5 animate-spin" /> : <CreditCard className="size-5" />}
                {project.stripeAccountId ? "Continue Stripe Setup" : "Connect & Start Integration"}
              </Button>
            )}
            
            {project.stripeAccountId && (
               <Button variant="ghost" size="sm" onClick={() => fetchData(project.stripeAccountId!)} disabled={isChecking} className="font-bold text-muted-foreground hover:text-foreground">
                 Sync Now
               </Button>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg max-w-xl">
        <h4 className="text-sm font-medium text-blue-700 flex items-center gap-2">
          <Activity className="size-4" />
          How it works
        </h4>
        <ul className="mt-2 text-xs text-blue-600 space-y-1 list-disc pl-4">
          <li>Connect your Stripe account and verify your identity.</li>
          <li>Payments work immediately — no redeploy needed.</li>
          <li>Payment method changes (iDEAL, Klarna, etc.) also apply instantly.</li>
          <li>Revenue split: 75% to you, 25% platform fee.</li>
        </ul>
      </div>
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

function PublishTab({ project }: { project: Project }) {
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
    setLoading(true);
    setLogs(["Pushing code to GitHub and initiating deployment on Coolify..."]);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const payload: any = {};
      if (domainMode === "custom" && customDomain.trim()) {
        payload.customDomain = customDomain.trim();
      }

      const client = createApiClient(getToken);
      const data = await client.projects.publish(project.id, payload.customDomain);
      
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
          Deploy your webshop to the live internet using Coolify.
        </p>
      </div>

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
              Your site will be built and deployed publicly.
            </p>
          </div>
          <Button 
            onClick={handlePublish} 
            disabled={loading || (domainMode === "custom" && !customDomain.trim())}
            className="gap-2"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
            {loading ? "Publishing..." : "Publish Now"}
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