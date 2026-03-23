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
 * App.tsx — Main application component.
 * This is your starting point. Edit this file or ask AI to generate code.
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
      content: `import React, { useEffect, useState } from "react";
import { db } from "./lib/db";

export default function App() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-black tracking-tight text-gray-900">
            \${projectName}
          </h1>
          <button className="bg-black text-white px-6 py-2.5 rounded-full font-medium hover:bg-gray-800 transition-colors">
            Cart (0)
          </button>
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center mb-12">
          <div className="text-4xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Your Webshop Backend is Live!
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto">
            A real Turso database has been provisioned and connected. 
            Describe your store in the chat, and the AI will generate the full frontend and insert real products into your database!
          </p>
        </div>

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
    "CREATE TABLE IF NOT EXISTS [Order] (id TEXT PRIMARY KEY, customerId TEXT, totalAmount REAL, status TEXT, orderNumber TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(customerId) REFERENCES Customer(id))",
    "CREATE TABLE IF NOT EXISTS OrderItem (id TEXT PRIMARY KEY, orderId TEXT, productId TEXT, quantity INTEGER, price REAL, FOREIGN KEY(orderId) REFERENCES [Order](id), FOREIGN KEY(productId) REFERENCES Product(id))",
    "CREATE TABLE IF NOT EXISTS Product (id TEXT PRIMARY KEY, name TEXT, description TEXT, price REAL, stock INTEGER, category TEXT, images TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)"
  ], "write");
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
            "@stripe/stripe-js": "latest",
            "@stripe/react-stripe-js": "latest",
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
  stripeAccountId?: string
): Version {
  const files = type === "webshop" && dbConfig
    ? getWebshopProjectFiles(projectName, projectId, dbConfig.url, dbConfig.token, stripeKey, backendUrl, stripeAccountId)
    : getDefaultProjectFiles(projectName);
  
  return {
    versionNumber: 0,
    prompt: "Initial project setup",
    model,
    files,
    changedFiles: files.map((file) => file.path),
    type: "manual",
    createdAt: new Date().toISOString(),
    fileCount: files.length,
  };
}