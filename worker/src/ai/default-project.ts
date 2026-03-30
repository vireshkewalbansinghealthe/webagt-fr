/**
 * worker/src/ai/default-project.ts
 *
 * Starter template files for a newly created project.
 * When a user creates a project, these files are stored in R2
 * as version 0 — the initial state before any AI generation.
 *
 * The template is a minimal React + Tailwind app with:
 * - src/App.tsx — Welcome component with project name
 * - src/index.tsx — React DOM render entry point
 * - src/index.css — Tailwind CSS imports
 * - package.json — React + Tailwind dependencies
 *
 * This matches what Sandpack expects for a React project,
 * so the preview works immediately after project creation.
 *
 * Used by: worker/src/routes/projects.ts (POST /api/projects)
 */

import type { ProjectFile, Version } from "../types/project";
import { getPardoleParfumFiles } from "./templates/pardole-parfum";

/**
 * Returns the starter files for a named template, or null if unknown.
 * templateId values must match AVAILABLE_TEMPLATES ids in the frontend.
 */
export function getTemplateFiles(templateId: string): ProjectFile[] | null {
  switch (templateId) {
    case "pardole_parfum_vite":
    case "pardole-parfum":
      return getPardoleParfumFiles();
    default:
      return null;
  }
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  if (index === -1) return "";
  return path.slice(0, index);
}

function relativePath(fromDir: string, toPath: string): string {
  const from = fromDir.split("/").filter(Boolean);
  const to = toPath.split("/").filter(Boolean);

  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) {
    i += 1;
  }

  const up = from.length - i;
  const down = to.slice(i);
  const relative = `${up > 0 ? "../".repeat(up) : ""}${down.join("/")}`;
  if (!relative || relative.startsWith("../")) return relative || ".";
  return `./${relative}`;
}

export function rewriteAtAliasImportsForSandbox(files: ProjectFile[]): ProjectFile[] {
  return files.map((file) => {
    if (!/\.(ts|tsx|js|jsx)$/.test(file.path)) {
      return file;
    }

    const fromDir = dirname(file.path);
    const rewriteImportPath = (aliasTarget: string) => {
      const targetPath = `src/${aliasTarget}`;
      return relativePath(fromDir, targetPath);
    };

    const content = file.content
      .replace(/from\s+(['"])@\/([^'"]+)\1/g, (_m, quote: string, target: string) => {
        return `from ${quote}${rewriteImportPath(target)}${quote}`;
      })
      .replace(/import\(\s*(['"])@\/([^'"]+)\1\s*\)/g, (_m, quote: string, target: string) => {
        return `import(${quote}${rewriteImportPath(target)}${quote})`;
      });

    return { ...file, content };
  });
}

function upsertFile(files: ProjectFile[], incoming: ProjectFile): ProjectFile[] {
  const index = files.findIndex((f) => f.path === incoming.path);
  if (index === -1) {
    return [...files, incoming];
  }
  const next = [...files];
  next[index] = incoming;
  return next;
}

function mergePackageJsonDependencies(basePkgText: string, infraPkgText: string): string {
  try {
    const basePkg = JSON.parse(basePkgText);
    const infraPkg = JSON.parse(infraPkgText);

    basePkg.dependencies = {
      ...(basePkg.dependencies || {}),
      ...(infraPkg.dependencies || {}),
    };
    basePkg.devDependencies = {
      ...(basePkg.devDependencies || {}),
      ...(infraPkg.devDependencies || {}),
    };

    return JSON.stringify(basePkg, null, 2) + "\n";
  } catch {
    return basePkgText;
  }
}

function mergeWebshopInfrastructureFiles(
  templateFiles: ProjectFile[],
  webshopInfraFiles: ProjectFile[],
): ProjectFile[] {
  let merged = [...templateFiles];

  const infraDb = webshopInfraFiles.find((f) => f.path === "src/lib/db.ts");
  if (infraDb) merged = upsertFile(merged, infraDb);

  const infraPayments = webshopInfraFiles.find((f) => f.path === "src/lib/payments.ts");
  if (infraPayments) merged = upsertFile(merged, infraPayments);

  const basePkg = merged.find((f) => f.path === "package.json");
  const infraPkg = webshopInfraFiles.find((f) => f.path === "package.json");
  if (basePkg && infraPkg) {
    merged = upsertFile(merged, {
      path: "package.json",
      content: mergePackageJsonDependencies(basePkg.content, infraPkg.content),
    });
  }

  return merged;
}

function buildDynamicTemplateDataModule(): ProjectFile {
  return {
    path: "src/lib/data.ts",
    content: `import { useSyncExternalStore } from 'react';
import { db } from './db';

export interface Product {
  id: string;
  name: string;
  inspiredBy: string;
  price: number;
  originalPrice?: number;
  category: 'dames' | 'heren' | 'unisex' | 'niche' | 'extract' | 'exclusive';
  isBestseller?: boolean;
  isNew?: boolean;
  isSoldOut?: boolean;
  rating: number;
  reviewCount: number;
  image: string;
  notes: {
    top: string[];
    heart: string[];
    base: string[];
  };
  description: string;
  size: string;
  longevity: string;
  sillage: string;
  isVirtual?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  count: number;
  description: string;
}

const FALLBACK_PRODUCTS: Product[] = [
  {
    id: '309',
    name: '309',
    inspiredBy: 'Designer inspired',
    price: 24.95,
    category: 'dames',
    isBestseller: true,
    rating: 4.9,
    reviewCount: 847,
    image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80',
    notes: { top: ['Mandarin'], heart: ['Jasmine'], base: ['Vanilla'] },
    description: 'Een elegante geur met premium geurbeleving.',
    size: '50ml',
    longevity: '8-10 uur',
    sillage: 'Sterk',
  },
  {
    id: '105',
    name: '105',
    inspiredBy: 'Designer inspired',
    price: 24.95,
    category: 'heren',
    isBestseller: true,
    rating: 4.8,
    reviewCount: 789,
    image: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800&q=80',
    notes: { top: ['Pink Pepper'], heart: ['Lavender'], base: ['Sandalwood'] },
    description: 'Kruidige heren geur met moderne uitstraling.',
    size: '50ml',
    longevity: '8-10 uur',
    sillage: 'Matig tot sterk',
  },
  {
    id: '210',
    name: '210',
    inspiredBy: 'Designer inspired',
    price: 24.95,
    category: 'unisex',
    isBestseller: true,
    rating: 4.9,
    reviewCount: 412,
    image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&q=80',
    notes: { top: ['Bergamot'], heart: ['Tonka'], base: ['Amber'] },
    description: 'Unisex blend met zachte warme noten.',
    size: '50ml',
    longevity: '10-12 uur',
    sillage: 'Intens',
  },
];

function mapCategory(raw: string | null | undefined): Product['category'] {
  const v = (raw || '').toLowerCase();
  if (v === 'dames' || v === 'heren' || v === 'unisex' || v === 'niche' || v === 'extract' || v === 'exclusive') {
    return v as Product['category'];
  }
  return 'unisex';
}

function parseImages(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
}

function rowToObject(row: any, columns?: string[]): Record<string, any> {
  if (Array.isArray(row) && columns) {
    const out: Record<string, any> = {};
    columns.forEach((col, i) => {
      out[col] = row[i];
    });
    return out;
  }
  return row || {};
}

async function fetchProductsFromDb(): Promise<Product[]> {
  try {
    const result = await db.execute(
      "SELECT id, name, price, description, category, categoryId, images, rating, reviews, featured, inventory, stock, originalPrice, compareAtPrice, isVirtual FROM Product ORDER BY createdAt DESC LIMIT 60"
    );
    const rows = (result.rows || []).map((row: any) => rowToObject(row, result.columns));
    if (!rows.length) {
      return FALLBACK_PRODUCTS;
    }

    return rows.map((row: any) => {
      const images = parseImages(row.images);
      const image = images[0] || 'https://images.unsplash.com/photo-1541643600914-78b084683702?w=800&q=80';
      const category = mapCategory(row.category ?? row.categoryId);
      const stock = Number(row.stock ?? row.inventory ?? 0);
      const soldOut = Number.isFinite(stock) ? stock <= 0 : false;
      const rating = Number(row.rating ?? 4.8);
      const reviewCount = Number(row.reviews ?? 0);

      return {
        id: String(row.id ?? crypto.randomUUID()),
        name: String(row.name ?? 'Parfum'),
        inspiredBy: 'Designer inspired',
        price: Number(row.price ?? 24.95),
        originalPrice:
          row.compareAtPrice != null
            ? Number(row.compareAtPrice)
            : row.originalPrice != null
              ? Number(row.originalPrice)
              : undefined,
        category,
        isBestseller: Boolean(row.featured ?? true),
        isNew: false,
        isSoldOut: soldOut,
        isVirtual: Boolean(row.isVirtual),
        rating: Number.isFinite(rating) ? rating : 4.8,
        reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
        image,
        notes: { top: ['Bergamot'], heart: ['Jasmine'], base: ['Amber'] },
        description: String(row.description ?? 'Premium parfum'),
        size: '50ml',
        longevity: '8-10 uur',
        sillage: 'Matig',
      } as Product;
    });
  } catch {
    return FALLBACK_PRODUCTS;
  }
}

const categoryMeta: Record<Product['category'], { name: string; description: string }> = {
  dames: { name: 'Dames', description: 'Elegante geuren voor iedere gelegenheid.' },
  heren: { name: 'Heren', description: 'Krachtige en verfijnde heren parfums.' },
  unisex: { name: 'Unisex', description: 'Moderne geuren voor iedereen.' },
  niche: { name: 'Niche', description: 'Unieke composities voor kenners.' },
  extract: { name: 'Extract', description: 'Hoge concentratie voor langdurige impact.' },
  exclusive: { name: 'Exclusive', description: 'Premium selectie met statement geuren.' },
};

function buildCategories(products: Product[]): Category[] {
  return (Object.keys(categoryMeta) as Product['category'][])
    .map((slug) => ({
      id: slug,
      slug,
      name: categoryMeta[slug].name,
      description: categoryMeta[slug].description,
      count: products.filter((p) => p.category === slug).length,
      image: products.find((p) => p.category === slug)?.image || 'https://images.unsplash.com/photo-1541643600914-78b084683702?w=800&q=80',
    }))
    .filter((c) => c.count > 0);
}

type CatalogSnapshot = {
  products: Product[];
  categories: Category[];
};

const listeners = new Set<() => void>();
let hasStartedCatalogHydration = false;
let catalog: CatalogSnapshot = {
  products: FALLBACK_PRODUCTS,
  categories: buildCategories(FALLBACK_PRODUCTS),
};

function emitCatalogChange() {
  listeners.forEach((listener) => listener());
}

function subscribeToCatalog(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getCatalogSnapshot(): CatalogSnapshot {
  return catalog;
}

async function hydrateCatalog() {
  const products = await fetchProductsFromDb();
  catalog = {
    products,
    categories: buildCategories(products),
  };
  emitCatalogChange();
}

function ensureCatalogHydration() {
  if (hasStartedCatalogHydration) return;
  hasStartedCatalogHydration = true;
  void hydrateCatalog();
}

export function useCatalog(): CatalogSnapshot {
  ensureCatalogHydration();
  return useSyncExternalStore(subscribeToCatalog, getCatalogSnapshot, getCatalogSnapshot);
}

export function getCatalog(): CatalogSnapshot {
  ensureCatalogHydration();
  return getCatalogSnapshot();
}

export const reviews = [
  { id: 'r1', name: 'Sanne', location: 'Amsterdam', title: 'Top kwaliteit', text: 'Super fijne geur en snelle levering.', rating: 5, product: '309', date: '2 dagen geleden', verified: true },
  { id: 'r2', name: 'Milan', location: 'Utrecht', title: 'Blijft lang hangen', text: 'Voor deze prijs echt premium.', rating: 5, product: '105', date: '5 dagen geleden', verified: true },
  { id: 'r3', name: 'Nora', location: 'Rotterdam', title: 'Nieuwe favoriet', text: 'Mooie balans en veel complimenten.', rating: 4, product: '210', date: '1 week geleden', verified: true },
];

export const announcementMessages = [
  'Voor 17:30 besteld, morgen in huis',
  'Gratis verzending vanaf €50',
  'Betaal achteraf met Klarna',
];
`,
  };
}

/**
 * Generates the default set of files for a new project.
 * The App.tsx includes the project name in the welcome message.
 *
 * @param projectName - The name of the newly created project
 * @returns Array of ProjectFile objects for version 0
 */
export function getDefaultProjectFiles(
  projectName: string
): ProjectFile[] {
  return [
    {
      path: "src/App.tsx",
      content: `/**
 * App.tsx — Main application component (PLACEHOLDER).
 * AI: This file is a placeholder. You MUST replace it entirely with real routing
 * and component imports when generating the first version of this project.
 * NEVER leave this placeholder in the output — always output a complete App.tsx.
 */

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          ${projectName}
        </h1>
        <p className="text-lg text-gray-600">
          Start building by describing what you want in the chat.
        </p>
      </div>
    </div>
  );
}
`,
    },
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
`
    },
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
`
    },
    {
      path: "src/index.tsx",
      content: `/**
 * index.tsx — Application entry point.
 * Renders the App component into the DOM root element.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`,
    },
    {
      path: "src/index.css",
      content: `/*
 * Base styles for the app.
 * Tailwind utility classes are handled by the CDN script at runtime,
 * so no @tailwind directives are needed here.
 */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`,
    },
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "project",
          private: true,
          version: "0.0.0",
          type: "module",
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
          },
          devDependencies: {
            "@types/react": "^18.2.0",
            "@types/react-dom": "^18.2.0",
            tailwindcss: "^3.4.0",
            typescript: "^5.0.0",
          },
        },
        null,
        2
      ) + "\n",
    },
  ];
}

/**
 * Generates the default set of files for a new WEBSHOP project.
 * Includes @libsql/client, database connection, and stripe.
 */
function getWebshopProjectFiles(
  projectName: string,
  projectId: string,
  dbUrl: string,
  dbToken: string,
  stripeKey: string,
  backendUrl: string,
  stripeAccountId?: string
): ProjectFile[] {
  return [
    {
      path: "src/App.tsx",
      content: `import React, { useEffect, useMemo, useState } from "react";
import { db } from "./lib/db";
import {
  beginCheckout,
  getPaymentState,
  getStripeAccountStatus,
  startStripeOnboarding,
  type StripeAccountStatus,
} from "./lib/payments";

interface Product {
  id: string;
  name: string;
  price: number;
  images?: string;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const paymentState = useMemo(() => getPaymentState(), []);
  const [stripeStatus, setStripeStatus] = useState<StripeAccountStatus | null>(null);
  const [stripeStatusLoading, setStripeStatusLoading] = useState(paymentState.mode !== "off");
  const [stripeStatusError, setStripeStatusError] = useState<string | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      try {
        const result = await db.execute("SELECT * FROM Product ORDER BY createdAt DESC LIMIT 10");
        
        // Map LibSQL array rows to objects
        const mappedProducts = result.rows.map((row: any) => {
          let product: any = {};
          if (Array.isArray(row) && result.columns) {
            result.columns.forEach((col, i) => product[col] = row[i]);
          } else {
            product = row;
          }
          return product;
        });

        setProducts(mappedProducts);
      } catch (err) {
        console.error("Failed to load products", err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  useEffect(() => {
    if (paymentState.mode === "off") {
      setStripeStatusLoading(false);
      return;
    }

    refreshStripeStatus();
  }, [paymentState.mode]);

  async function refreshStripeStatus() {
    if (paymentState.mode === "off") {
      setStripeStatus(null);
      setStripeStatusError(null);
      setStripeStatusLoading(false);
      return;
    }

    try {
      setStripeStatusLoading(true);
      setStripeStatusError(null);
      const status = await getStripeAccountStatus();
      setStripeStatus(status);
    } catch (error: any) {
      setStripeStatusError(error.message || "Failed to load Stripe account status.");
    } finally {
      setStripeStatusLoading(false);
    }
  }

  async function handleStripeOnboarding() {
    try {
      setOnboardingLoading(true);
      const url = await startStripeOnboarding(window.location.href);
      window.location.href = url;
    } catch (error: any) {
      setCheckoutMessage(error.message || "Failed to start Stripe onboarding.");
    } finally {
      setOnboardingLoading(false);
    }
  }

  async function handleCheckout(product: Product) {
    setCheckoutMessage(null);

    if (!paymentState.canCheckout) {
      setCheckoutMessage(paymentState.message);
      return;
    }

    try {
      setCheckoutLoadingId(product.id);
      const url = await beginCheckout({
        items: [
          {
            productId: String(product.id),
            name: product.name,
            unitAmount: Math.round(Number(product.price) * 100),
            quantity: 1,
            image: product.images ? JSON.parse(product.images)[0] : undefined,
            isVirtual: false,
          },
        ],
        successUrl: window.location.origin,
        cancelUrl: window.location.origin,
        requiresShipping: true,
      });
      window.location.href = url;
    } catch (error: any) {
      setCheckoutMessage(error.message || "Checkout failed. Please try again.");
    } finally {
      setCheckoutLoadingId(null);
    }
  }

  const paymentTone =
    paymentState.mode === "live"
      ? "border-green-200 bg-green-50 text-green-900"
      : paymentState.mode === "test"
        ? "border-blue-200 bg-blue-50 text-blue-900"
        : "border-amber-200 bg-amber-50 text-amber-900";

  const stripeTone =
    stripeStatus?.isReady
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-orange-200 bg-orange-50 text-orange-900";

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-black tracking-tight text-gray-900">
            ${projectName}
          </h1>
          <button className="bg-black text-white px-6 py-2.5 rounded-full font-medium hover:bg-gray-800 transition-colors">
            Cart (0)
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-[1.4fr,0.8fr] mb-12">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
            <div className="text-4xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Your webshop backend is live
            </h2>
            <p className="text-gray-500 max-w-xl">
              A real Turso database has been provisioned and connected. Describe your
              store in the chat, and the AI will generate the storefront while reusing the
              built-in payments adapter instead of hand-rolling checkout logic.
            </p>
          </div>

          <div className="space-y-4">
            <div className={"rounded-2xl border p-6 shadow-sm " + paymentTone}>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] mb-3">
                Payments
              </div>
              <h3 className="text-xl font-bold mb-2">{paymentState.headline}</h3>
              <p className="text-sm leading-6 opacity-90">{paymentState.message}</p>
              <div className="mt-4 inline-flex rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]">
                Mode: {paymentState.mode}
              </div>
            </div>

            {paymentState.mode !== "off" && (
              <div className={"rounded-2xl border p-6 shadow-sm " + stripeTone}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] mb-3">
                      Stripe Connect
                    </div>
                    <h3 className="text-xl font-bold mb-2">
                      {stripeStatus?.isReady ? "Connected account ready" : "Account setup required"}
                    </h3>
                  </div>
                  <button
                    onClick={refreshStripeStatus}
                    disabled={stripeStatusLoading}
                    className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {stripeStatusLoading ? "Checking..." : "Refresh"}
                  </button>
                </div>

                {stripeStatusError ? (
                  <p className="text-sm leading-6 opacity-90">{stripeStatusError}</p>
                ) : stripeStatusLoading ? (
                  <p className="text-sm leading-6 opacity-90">Checking the connected Stripe account before enabling checkout.</p>
                ) : stripeStatus ? (
                  <>
                    <p className="text-sm leading-6 opacity-90">
                      {stripeStatus.isReady
                        ? "Charges, payouts, and transfer capability are active for this connected account."
                        : stripeStatus.summary}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
                      <span className="rounded-full bg-white/70 px-3 py-1">
                        Account: {stripeStatus.accountId}
                      </span>
                      <span className="rounded-full bg-white/70 px-3 py-1">
                        Charges: {stripeStatus.chargesEnabled ? "on" : "off"}
                      </span>
                      <span className="rounded-full bg-white/70 px-3 py-1">
                        Payouts: {stripeStatus.payoutsEnabled ? "on" : "off"}
                      </span>
                    </div>

                    {stripeStatus.requirements.currentlyDue.length > 0 && (
                      <p className="mt-4 text-sm leading-6 opacity-90">
                        Still needed: {stripeStatus.requirements.currentlyDue.join(", ")}
                      </p>
                    )}

                    {!stripeStatus.isReady && (
                      <button
                        onClick={handleStripeOnboarding}
                        disabled={onboardingLoading}
                        className="mt-4 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {onboardingLoading
                          ? "Opening Stripe..."
                          : stripeStatus.type === "standard"
                            ? "Open Stripe dashboard"
                            : "Complete onboarding"}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm leading-6 opacity-90">No connected Stripe account was found for this shop.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {checkoutMessage && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            {checkoutMessage}
          </div>
        )}

        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Live Database Data
          </h3>
          
          {loading ? (
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-gray-500 font-medium">No products in database yet.</p>
              <p className="text-sm text-gray-400 mt-1">Ask the AI to generate some mock products!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-gray-100 relative">
                    {product.images ? (
                      <img 
                        src={JSON.parse(product.images)[0]} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h4 className="font-semibold text-gray-900 mb-1 line-clamp-1">{product.name}</h4>
                    <p className="text-green-600 font-bold">€{product.price?.toFixed(2)}</p>
                    <button
                      onClick={() => handleCheckout(product)}
                      disabled={checkoutLoadingId === product.id}
                      className="mt-4 w-full rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {checkoutLoadingId === product.id ? "Starting checkout..." : paymentState.ctaLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`
    },
    {
      path: "src/lib/db.ts",
      content: `import { createClient } from '@libsql/client/web'

/**
 * Turso Database Client
 * This client connects directly to your provisioned Turso edge database.
 * Use this to fetch and mutate real data instead of hardcoding state.
 */
export const db = createClient({
  url: "${dbUrl}",
  authToken: "${dbToken}",
})

export function generateId(): string {
  return crypto.randomUUID()
}

export function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/**
 * Ensures the database schema exists.
 * The AI uses this to bootstrap the shop tables.
 */
export async function ensureSchema() {
  await db.batch([
    "CREATE TABLE IF NOT EXISTS Customer (id TEXT PRIMARY KEY, email TEXT UNIQUE, firstName TEXT, lastName TEXT, address TEXT, city TEXT, country TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS [Order] (id TEXT PRIMARY KEY, customerId TEXT, totalAmount REAL, status TEXT, orderNumber TEXT, shippingAddress TEXT, billingAddress TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(customerId) REFERENCES Customer(id))",
    "CREATE TABLE IF NOT EXISTS OrderItem (id TEXT PRIMARY KEY, orderId TEXT, productId TEXT, quantity INTEGER, price REAL, FOREIGN KEY(orderId) REFERENCES [Order](id), FOREIGN KEY(productId) REFERENCES Product(id))",
    "CREATE TABLE IF NOT EXISTS Product (id TEXT PRIMARY KEY, name TEXT, description TEXT, price REAL, stock INTEGER, category TEXT, sku TEXT, isVirtual INTEGER DEFAULT 0, images TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)"
  ], "write");
}
`
    },
    {
      path: "src/lib/payments.ts",
      content: `type PaymentMode = "off" | "test" | "live";

interface CheckoutPayload {
  items: Array<{
    productId?: string;
    name: string;
    unitAmount: number;
    quantity: number;
    image?: string;
    isVirtual?: boolean;
  }>;
  successUrl?: string;
  cancelUrl?: string;
  requiresShipping?: boolean;
}

interface PaymentState {
  mode: PaymentMode;
  canCheckout: boolean;
  headline: string;
  message: string;
  ctaLabel: string;
}

interface StripeRequirements {
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  pendingVerification: string[];
  disabledReason: string | null;
}

export interface StripeAccountStatus {
  accountId: string;
  type: string;
  mode: Exclude<PaymentMode, "off">;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  transferCapabilityActive: boolean;
  requiresAction: boolean;
  isReady: boolean;
  summary: string;
  requirements: StripeRequirements;
}

const paymentMode = "off" as PaymentMode;

export function getPaymentState(): PaymentState {
  if (paymentMode === "live") {
    return {
      mode: "live",
      canCheckout: true,
      headline: "Live payments are active",
      message: "Customers can place real orders and Stripe will route payouts to the connected account.",
      ctaLabel: "Buy now",
    };
  }

  if (paymentMode === "test") {
    return {
      mode: "test",
      canCheckout: true,
      headline: "Test mode is active",
      message: "Use Stripe test cards to validate checkout, webhooks, and order creation before going live.",
      ctaLabel: "Test checkout",
    };
  }

  return {
    mode: "off",
    canCheckout: false,
    headline: "Publish to test payments",
    message: "Payments are not available in the live preview. Publish your shop to test checkout with Stripe.",
    ctaLabel: "Publish to test payments",
  };
}

function summarizeStripeStatus(status: StripeAccountStatus): string {
  if (status.requirements.currentlyDue.length > 0) {
    return "Stripe still needs: " + status.requirements.currentlyDue.join(", ");
  }

  if (!status.detailsSubmitted) {
    return "Finish Stripe onboarding to submit your connected account details.";
  }

  if (!status.chargesEnabled || !status.payoutsEnabled || !status.transferCapabilityActive) {
    return "Stripe account setup is incomplete. Review the connected account before accepting payments.";
  }

  if (status.requirements.pendingVerification.length > 0) {
    return "Stripe is reviewing submitted information for this connected account.";
  }

  return "Stripe is connected and ready to accept payments.";
}

export async function getStripeAccountStatus(): Promise<StripeAccountStatus | null> {
  if (paymentMode === "off") {
    return null;
  }

  const response = await fetch("/api/stripe/account-status");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to load Stripe account status");
  }

  const status: StripeAccountStatus = {
    accountId: data.accountId,
    type: data.type || "unknown",
    mode: data.mode,
    detailsSubmitted: Boolean(data.detailsSubmitted),
    chargesEnabled: Boolean(data.chargesEnabled),
    payoutsEnabled: Boolean(data.payoutsEnabled),
    transferCapabilityActive: Boolean(data.transferCapabilityActive),
    requiresAction: Boolean(data.requiresAction),
    isReady: Boolean(data.isReady),
    summary: "",
    requirements: {
      currentlyDue: data.requirements?.currentlyDue || [],
      eventuallyDue: data.requirements?.eventuallyDue || [],
      pastDue: data.requirements?.pastDue || [],
      pendingVerification: data.requirements?.pendingVerification || [],
      disabledReason: data.requirements?.disabledReason || null,
    },
  };

  status.summary = data.summary || summarizeStripeStatus(status);
  return status;
}

export async function startStripeOnboarding(returnUrl?: string) {
  if (paymentMode === "off") {
    throw new Error("Payments are disabled for this shop.");
  }

  const response = await fetch("/api/stripe/account-onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      returnUrl: returnUrl || window.location.href,
      refreshUrl: window.location.href,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.url) {
    throw new Error(data.error || "Failed to open Stripe onboarding");
  }

  return data.url as string;
}

export async function beginCheckout({
  items,
  successUrl,
  cancelUrl,
  requiresShipping = false,
}: CheckoutPayload) {
  const state = getPaymentState();

  if (!state.canCheckout) {
    throw new Error(state.message);
  }

  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items,
      currency: "eur",
      successUrl: successUrl || window.location.origin,
      cancelUrl: cancelUrl || window.location.origin,
      requiresShipping,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.url) {
    throw new Error(data.error || "Failed to initialize checkout");
  }

  return data.url as string;
}
`
    },
    {
      path: "src/index.tsx",
      content: `/**
 * index.tsx — Application entry point.
 * Renders the App component into the DOM root element.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`
    },
    {
      path: "src/index.css",
      content: `/*
 * Base styles for the app.
 * Tailwind utility classes are handled by the CDN script at runtime,
 * so no @tailwind directives are needed here.
 */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`
    },
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "project",
          private: true,
          version: "0.0.0",
          type: "module",
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
            "@libsql/client": "latest",
            "lucide-react": "latest",
          },
          devDependencies: {
            "@types/react": "^18.2.0",
            "@types/react-dom": "^18.2.0",
            tailwindcss: "^3.4.0",
            typescript: "^5.0.0",
          },
        },
        null,
        2
      ) + "\n",
    },
  ];
}

/**
 * Creates the initial version (version 0) for a new project.
 * This version contains the starter template files and records
 * that it was created as an "ai" type with an empty prompt.
 *
 * @param projectName - The name of the project
 * @param model - The AI model selected for this project
 * @returns A Version object for version 0
 */
export function createInitialVersion(
  projectName: string,
  projectId: string,
  model: string,
  type: "website" | "webshop" = "website",
  dbConfig?: { url: string; token: string },
  stripeKey: string = "",
  backendUrl: string = "http://localhost:8787",
  stripeAccountId?: string,
  templateId?: string
): Version {
  // If a named template is requested, use its files directly (fast remix)
  let files: ProjectFile[];
  if (templateId && templateId !== "blank-ai") {
    const templateFiles = getTemplateFiles(templateId);
    if (templateFiles) {
      files = rewriteAtAliasImportsForSandbox(templateFiles);

      // Keep template UX, but always include scratch webshop infra for parity:
      // Turso client + payments adapter + required deps.
      if (type === "webshop") {
        const webshopInfra = getWebshopProjectFiles(
          projectName,
          projectId,
          dbConfig?.url || "",
          dbConfig?.token || "",
          stripeKey,
          backendUrl,
          stripeAccountId,
        );
        files = mergeWebshopInfrastructureFiles(files, webshopInfra);
        if (dbConfig) {
          files = upsertFile(files, buildDynamicTemplateDataModule());
        }
      }
    } else {
      files = getDefaultProjectFiles(projectName);
    }
  } else if (type === "webshop" && dbConfig) {
    files = getWebshopProjectFiles(projectName, projectId, dbConfig.url, dbConfig.token, stripeKey, backendUrl, stripeAccountId);
  } else {
    files = getDefaultProjectFiles(projectName);
  }

  return {
    versionNumber: 0,
    prompt: templateId && templateId !== "blank-ai"
      ? `Remixed from template: ${templateId}`
      : "Initial project setup",
    model,
    files,
    changedFiles: files.map((file) => file.path),
    type: "manual",
    createdAt: new Date().toISOString(),
    fileCount: files.length,
  };
}