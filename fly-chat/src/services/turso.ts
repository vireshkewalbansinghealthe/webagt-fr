/**
 * Turso database provisioning — adapted for Fly.io (uses Env interface with env vars).
 * Logic matches worker/src/services/turso.ts.
 */

import type { Env } from "../types.js";

interface TursoDatabaseResult {
  url: string;
  token: string;
  name: string;
}

export async function createTursoDatabase(env: Env, dbName: string): Promise<TursoDatabaseResult> {
  const token = env.TURSO_API_TOKEN;
  const baseUrl = env.TURSO_API_URL || "https://api.turso.tech/v1";

  // Resolve org slug
  let orgSlug = env.TURSO_ORG_SLUG || "";
  if (!orgSlug) {
    const orgsRes = await fetch(`${baseUrl}/organizations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (orgsRes.ok) {
      const orgs = (await orgsRes.json()) as any[];
      if (orgs.length > 0) orgSlug = orgs[0].slug;
    }
  }

  if (!orgSlug) {
    throw new Error("Could not resolve Turso organization slug");
  }

  // Resolve group
  let groupName = "default";
  try {
    const groupsRes = await fetch(`${baseUrl}/organizations/${orgSlug}/groups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (groupsRes.ok) {
      const data = (await groupsRes.json()) as { groups?: { name: string }[] };
      if (data.groups && data.groups.length > 0) {
        groupName = data.groups[0].name;
      }
    }
  } catch { /* use default */ }

  // Create database
  console.log(`[Turso] Creating database ${dbName} in group ${groupName}...`);
  const createRes = await fetch(`${baseUrl}/organizations/${orgSlug}/databases`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: dbName, group: groupName }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    console.error(`[Turso Error] Create DB failed: Status ${createRes.status}, Body: ${body}`);
    throw new Error(`Failed to create Turso database: ${body}`);
  }

  const createData = (await createRes.json()) as any;
  console.log(`[Turso] Created DB payload:`, JSON.stringify(createData));

  // Resolve hostname
  let hostname = createData.database?.Hostname || createData.database?.hostname || "";
  if (!hostname) {
    const infoRes = await fetch(`${baseUrl}/organizations/${orgSlug}/databases/${dbName}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (infoRes.ok) {
      const info = (await infoRes.json()) as any;
      hostname = info.database?.hostname || info.database?.Hostname || `${dbName}-${orgSlug}.aws-eu-west-1.turso.io`;
    }
  }

  const url = `libsql://${hostname}`;

  // Generate auth token (with retry delay for propagation)
  await new Promise(r => setTimeout(r, 3000));

  console.log(`[Turso] Generating auth token for ${dbName}...`);
  const tokenRes = await fetch(`${baseUrl}/organizations/${orgSlug}/databases/${dbName}/auth/tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  let dbToken = "";
  if (tokenRes.ok) {
    const tokenData = (await tokenRes.json()) as { jwt?: string };
    dbToken = tokenData.jwt || "";
    console.log(`[Turso] Successfully generated auth token for ${dbName}`);
  } else {
    console.error(`[Turso] Failed to generate token: ${tokenRes.status}`);
  }

  return { url, token: dbToken, name: dbName };
}

export async function createWebshopSchema(dbUrl: string, authToken: string): Promise<void> {
  const httpsUrl = dbUrl.replace("libsql://", "https://");

  const statements = [
    `CREATE TABLE IF NOT EXISTS Product (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE, description TEXT, price REAL NOT NULL DEFAULT 0, compareAtPrice REAL, images TEXT DEFAULT '[]', category TEXT, tags TEXT DEFAULT '[]', active INTEGER DEFAULT 1, featured INTEGER DEFAULT 0, trackStock INTEGER DEFAULT 0, stock INTEGER DEFAULT 0, sku TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS ProductVariant (id INTEGER PRIMARY KEY AUTOINCREMENT, productId INTEGER NOT NULL REFERENCES Product(id), name TEXT NOT NULL, sku TEXT, price REAL, stock INTEGER DEFAULT 0, options TEXT DEFAULT '{}', active INTEGER DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS [Order] (id INTEGER PRIMARY KEY AUTOINCREMENT, stripeSessionId TEXT UNIQUE, customerEmail TEXT, customerName TEXT, shippingAddress TEXT, items TEXT DEFAULT '[]', subtotal REAL DEFAULT 0, shippingCost REAL DEFAULT 0, taxAmount REAL DEFAULT 0, total REAL DEFAULT 0, status TEXT DEFAULT 'pending', currency TEXT DEFAULT 'eur', createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS ShippingRate (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0, minOrderAmount REAL, maxOrderAmount REAL, estimatedDays TEXT, active INTEGER DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS ShippingZone (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, countries TEXT DEFAULT '[]', rateId INTEGER REFERENCES ShippingRate(id))`,
    `CREATE TABLE IF NOT EXISTS TaxGroup (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, rate REAL NOT NULL DEFAULT 0, country TEXT, isDefault INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS [_AppLog] (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL DEFAULT 'info', source TEXT, message TEXT NOT NULL, detail TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`,
  ];

  for (const sql of statements) {
    try {
      await fetch(httpsUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ statements: [{ q: sql }] }),
      });
    } catch (e: any) {
      console.error(`[Turso] Schema statement failed:`, e.message);
    }
  }
}
