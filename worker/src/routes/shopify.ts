/**
 * worker/src/routes/shopify.ts
 *
 * Shopify OAuth + product import for Shop Manager.
 *
 * Flow:
 * 1. GET  /api/shopify/auth-url      — returns the Shopify OAuth install URL
 * 2. GET  /api/shopify/callback       — exchanges auth code for access token, stores it
 * 3. GET  /api/shopify/products/:pid  — fetches products from the connected Shopify store
 * 4. GET  /api/shopify/status/:pid    — checks if a Shopify store is connected
 * 5. POST /api/shopify/disconnect/:pid — removes the Shopify connection
 *
 * Access tokens are stored in KV as  shopify:{projectId}  →  { shop, accessToken }
 */

import { Hono } from "hono";
import type { Env, AppVariables } from "../types";

const shopifyRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const SHOPIFY_SCOPES = "read_products,read_product_listings,read_inventory";

interface ShopifyConnection {
  shop: string;
  accessToken: string;
  connectedAt: string;
}

// ---------------------------------------------------------------------------
// 1. Generate OAuth install URL
// ---------------------------------------------------------------------------
shopifyRoutes.get("/auth-url", async (c) => {
  const shop = c.req.query("shop");
  const projectId = c.req.query("projectId");

  if (!shop || !projectId) {
    return c.json({ error: "Missing shop or projectId" }, 400);
  }

  const normalizedShop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(normalizedShop)) {
    return c.json({ error: "Invalid Shopify store URL. Use yourstore.myshopify.com" }, 400);
  }

  const apiKey = c.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    return c.json({ error: "Shopify integration not configured" }, 500);
  }

  const frontendUrl = c.env.FRONTEND_URL || "http://localhost:3000";
  const workerUrl = c.env.PUBLIC_WORKER_URL || "http://localhost:8787";
  const redirectUri = `${workerUrl}/api/shopify/callback`;

  // Store state in KV for CSRF protection (expires in 10 minutes)
  const state = crypto.randomUUID();
  await c.env.METADATA.put(
    `shopify-oauth:${state}`,
    JSON.stringify({ projectId, shop: normalizedShop, frontendUrl }),
    { expirationTtl: 600 }
  );

  const installUrl =
    `https://${normalizedShop}/admin/oauth/authorize` +
    `?client_id=${apiKey}` +
    `&scope=${SHOPIFY_SCOPES}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  return c.json({ url: installUrl });
});

// ---------------------------------------------------------------------------
// 2. OAuth callback — exchange code for access token
// ---------------------------------------------------------------------------
shopifyRoutes.get("/callback", async (c) => {
  const { code, state, shop: shopParam, hmac: _hmac } = c.req.query() as Record<string, string>;

  if (!code || !state) {
    return c.text("Missing code or state", 400);
  }

  const stored = await c.env.METADATA.get<{ projectId: string; shop: string; frontendUrl: string }>(
    `shopify-oauth:${state}`,
    "json"
  );

  if (!stored) {
    return c.text("Invalid or expired state parameter", 400);
  }

  // Clean up the state
  await c.env.METADATA.delete(`shopify-oauth:${state}`);

  const shop = shopParam || stored.shop;
  const apiKey = c.env.SHOPIFY_API_KEY!;
  const apiSecret = c.env.SHOPIFY_API_SECRET!;

  // Exchange authorization code for a permanent access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error("[shopify] Token exchange failed:", errText);
    return c.text("Failed to connect to Shopify. Please try again.", 400);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string; scope: string };

  // Store the connection
  const connection: ShopifyConnection = {
    shop,
    accessToken: tokenData.access_token,
    connectedAt: new Date().toISOString(),
  };

  await c.env.METADATA.put(
    `shopify:${stored.projectId}`,
    JSON.stringify(connection)
  );

  // Redirect back to the frontend with success
  const redirectUrl = `${stored.frontendUrl}/project/${stored.projectId}?shopify=connected`;
  return c.redirect(redirectUrl, 302);
});

// ---------------------------------------------------------------------------
// 3. Fetch products from connected Shopify store
// ---------------------------------------------------------------------------
shopifyRoutes.get("/products/:projectId", async (c) => {
  const projectId = c.req.param("projectId");

  const connection = await c.env.METADATA.get<ShopifyConnection>(
    `shopify:${projectId}`,
    "json"
  );

  if (!connection) {
    return c.json({ error: "No Shopify store connected", code: "NOT_CONNECTED" }, 404);
  }

  const limit = parseInt(c.req.query("limit") || "50", 10);
  const cursor = c.req.query("cursor") || "";

  let url = `https://${connection.shop}/admin/api/2024-01/products.json?limit=${Math.min(limit, 250)}`;
  if (cursor) {
    url += `&page_info=${cursor}`;
  }

  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": connection.accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      await c.env.METADATA.delete(`shopify:${projectId}`);
      return c.json({ error: "Shopify access expired. Please reconnect.", code: "TOKEN_EXPIRED" }, 401);
    }
    return c.json({ error: "Failed to fetch Shopify products" }, 500);
  }

  const data = (await res.json()) as {
    products: ShopifyProduct[];
  };

  // Parse Link header for pagination
  const linkHeader = res.headers.get("Link") || "";
  let nextCursor: string | null = null;
  const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]*)[^>]*>;\s*rel="next"/);
  if (nextMatch) {
    nextCursor = nextMatch[1];
  }

  // Map to a simpler format for the frontend
  const products = data.products.map(mapShopifyProduct);

  return c.json({ products, nextCursor, shop: connection.shop });
});

// ---------------------------------------------------------------------------
// 4. Check connection status
// ---------------------------------------------------------------------------
shopifyRoutes.get("/status/:projectId", async (c) => {
  const projectId = c.req.param("projectId");

  const connection = await c.env.METADATA.get<ShopifyConnection>(
    `shopify:${projectId}`,
    "json"
  );

  if (!connection) {
    return c.json({ connected: false });
  }

  return c.json({
    connected: true,
    shop: connection.shop,
    connectedAt: connection.connectedAt,
  });
});

// ---------------------------------------------------------------------------
// 5. Disconnect
// ---------------------------------------------------------------------------
shopifyRoutes.post("/disconnect/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  await c.env.METADATA.delete(`shopify:${projectId}`);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Shopify product type + mapper
// ---------------------------------------------------------------------------
interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  status: string;
  tags: string;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    compare_at_price: string | null;
    sku: string | null;
    inventory_quantity: number;
    inventory_management: string | null;
    option1: string | null;
    option2: string | null;
    option3: string | null;
  }>;
  options: Array<{
    id: number;
    name: string;
    values: string[];
  }>;
  images: Array<{
    id: number;
    src: string;
    alt: string | null;
  }>;
  image: { src: string } | null;
}

interface MappedProduct {
  shopifyId: number;
  name: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  sku: string;
  stock: number;
  trackStock: boolean;
  status: "active" | "draft";
  images: string[];
  variants: Array<{
    title: string;
    price: number;
    compareAtPrice: number | null;
    sku: string;
    stock: number;
    trackStock: boolean;
    option1: string | null;
    option2: string | null;
    option3: string | null;
  }>;
  options: Array<{
    name: string;
    values: string[];
  }>;
  vendor: string;
  productType: string;
  tags: string[];
}

function mapShopifyProduct(p: ShopifyProduct): MappedProduct {
  const firstVariant = p.variants[0];
  const price = firstVariant ? parseFloat(firstVariant.price) : 0;
  const compareAtPrice = firstVariant?.compare_at_price
    ? parseFloat(firstVariant.compare_at_price)
    : null;

  return {
    shopifyId: p.id,
    name: p.title,
    description: stripHtml(p.body_html || ""),
    price,
    compareAtPrice,
    sku: firstVariant?.sku || "",
    stock: firstVariant?.inventory_quantity ?? 0,
    trackStock: firstVariant?.inventory_management === "shopify",
    status: p.status === "active" ? "active" : "draft",
    images: p.images.map((img) => img.src),
    variants: p.variants.map((v) => ({
      title: v.title,
      price: parseFloat(v.price),
      compareAtPrice: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
      sku: v.sku || "",
      stock: v.inventory_quantity,
      trackStock: v.inventory_management === "shopify",
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
    })),
    options: p.options.map((o) => ({ name: o.name, values: o.values })),
    vendor: p.vendor,
    productType: p.product_type,
    tags: p.tags ? p.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export { shopifyRoutes };
