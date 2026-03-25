export async function createTursoDatabase(env: any, dbName: string) {
  const TURSO_API_URL = env.TURSO_API_URL || 'https://api.turso.tech/v1';
  const TURSO_API_TOKEN = env.TURSO_API_TOKEN;

  if (!TURSO_API_TOKEN) {
    throw new Error('TURSO_API_TOKEN is not set in environment');
  }

  try {
    // 1. Get organizations to find the primary one
    const orgsRes = await fetch(`${TURSO_API_URL}/organizations`, {
      headers: {
        'Authorization': `Bearer ${TURSO_API_TOKEN}`
      }
    });

    let orgSlug = "default";
    let isOrgAccount = true;

    if (!orgsRes.ok) {
      // If /organizations fails with 404, it means it's a personal account, not an organization account.
      console.log(`[Turso] User is likely on a personal account (no organizations).`);
      isOrgAccount = false;
    } else {
      const orgsData: any = await orgsRes.json();
      const org = Array.isArray(orgsData) ? orgsData[0] : orgsData.organizations?.[0];
      if (org?.slug || org?.name) {
        orgSlug = org.slug || org.name;
      }
    }

    console.log(`[Turso] Using scope: ${isOrgAccount ? 'organization ' + orgSlug : 'personal account'}`);

    // Try to get groups if it's an org to know which group to use, 
    // otherwise fallback to 'default'
    let groupName = 'default';
    if (isOrgAccount) {
      try {
        const groupsRes = await fetch(`${TURSO_API_URL}/organizations/${orgSlug}/groups`, {
          headers: { 'Authorization': `Bearer ${TURSO_API_TOKEN}` }
        });
        if (groupsRes.ok) {
          const groupsData: any = await groupsRes.json();
          if (groupsData.groups && groupsData.groups.length > 0) {
            // Automatically use the first available group, or 'default' if it exists
            const defaultGroup = groupsData.groups.find((g: any) => g.name === 'default');
            groupName = defaultGroup ? 'default' : groupsData.groups[0].name;
            console.log(`[Turso] Using group: ${groupName}`);
          }
        }
      } catch (e) {
        // Ignore and fallback
        console.log(`[Turso] Failed to get groups, using default group: ${groupName}`);
      }
    }

    // Double check that we don't try to use an invalid group
    if (groupName === 'default' && orgSlug !== 'default') {
      groupName = orgSlug; // Fallback to orgSlug as group name if we couldn't fetch groups and it's an org
    }

    // 2. Create the database
    console.log(`[Turso] Creating database ${dbName} in group ${groupName}...`);
    // Hardcode the org URL for webagt since we know it's an org account and /databases fails with "group not found"
    // We should use the organizations endpoint if it's an org account.
    const createUrl = isOrgAccount 
      ? `${TURSO_API_URL}/organizations/${orgSlug}/databases`
      : `${TURSO_API_URL}/databases`;

    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TURSO_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: dbName,
        group: groupName
      })
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      // If it already exists, that's fine
      if (err.includes('already exists')) {
        console.log(`[Turso] Database ${dbName} already exists.`);
      } else {
        console.error(`[Turso Error] Create DB failed: Status ${createRes.status}, Body: ${err}`);
        throw new Error(`Failed to create Turso database: ${err}`);
      }
    } else {
      const createData = await createRes.json();
      console.log(`[Turso] Created DB payload: ${JSON.stringify(createData)}`);
    }

    // Determine hostname correctly
    let hostname = `${dbName}.turso.io`; // Fallback
    
    // Fetch the DB specifically to get its hostname
    const getUrl = isOrgAccount
      ? `${TURSO_API_URL}/organizations/${orgSlug}/databases/${dbName}`
      : `${TURSO_API_URL}/databases/${dbName}`;

    try {
      const getRes = await fetch(getUrl, {
        headers: {
          'Authorization': `Bearer ${TURSO_API_TOKEN}`
        }
      });
      
      if (getRes.ok) {
        const dbInfo: any = await getRes.json();
        console.log(`[Turso] Fetched DB info: ${JSON.stringify(dbInfo)}`);
        if (dbInfo.database?.Hostname) {
          hostname = dbInfo.database.Hostname;
        } else if (dbInfo.database?.hostname) {
          hostname = dbInfo.database.hostname;
        }
      } else {
         console.log(`[Turso] Failed to get DB info: ${await getRes.text()}`);
         
         // In webagt org, the hostname format is typically: {dbName}-{orgSlug}.aws-eu-west-1.turso.io
         // or {dbName}-{orgSlug}.turso.io
         // Let's fallback to the structure we saw in our test if it's an org account
         if (isOrgAccount) {
            hostname = `${dbName}-${orgSlug}.aws-eu-west-1.turso.io`;
            console.log(`[Turso] Using fallback org hostname format: ${hostname}`);
         }
         
         // Fallback: list all databases and find it
         const listUrl = isOrgAccount
          ? `${TURSO_API_URL}/organizations/${orgSlug}/databases`
          : `${TURSO_API_URL}/databases`;
          
         try {
           const listRes = await fetch(listUrl, {
             headers: { 'Authorization': `Bearer ${TURSO_API_TOKEN}` }
           });
           
           if (listRes.ok) {
             const listData: any = await listRes.json();
             const db = listData.databases?.find((d: any) => d.name === dbName || d.Name === dbName);
             if (db) {
               hostname = db.Hostname || db.hostname || hostname;
             }
           }
         } catch (e) {
           console.log(`[Turso] Error getting db list: ${e}`);
         }
      }
    } catch (e) {
      console.log(`[Turso] Exception getting DB info: ${e}`);
      if (isOrgAccount) {
         hostname = `${dbName}-${orgSlug}.aws-eu-west-1.turso.io`;
      }
    }
    
    const dbUrl = `libsql://${hostname}`;

    // 3. Create an auth token for this database
    console.log(`[Turso] Generating auth token for ${dbName}...`);
    const tokenUrl = isOrgAccount
      ? `${TURSO_API_URL}/organizations/${orgSlug}/databases/${dbName}/auth/tokens`
      : `${TURSO_API_URL}/databases/${dbName}/auth/tokens`;

    // Wait a bit to ensure database is fully ready before generating token
    await new Promise(resolve => setTimeout(resolve, 3000));

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TURSO_API_TOKEN}`
      }
    });

    // Set up databaseUrl and databaseToken with default empty values so we don't throw ReferenceError
    let databaseUrl: string | undefined = undefined;
    let databaseToken: string | undefined = undefined;

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.log(`[Turso] Failed to create token at ${tokenUrl}. Trying fallback... Error: ${err}`);
      
      // Fallback for getting token - Try user database endpoint
      const fallbackTokenUrl = `${TURSO_API_URL}/databases/${dbName}/auth/tokens`;
      const fallbackTokenRes = await fetch(fallbackTokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TURSO_API_TOKEN}`
        }
      });
      
      if (!fallbackTokenRes.ok) {
        console.log(`[Turso] Failed to create token at fallback ${fallbackTokenUrl}. Error: ${await fallbackTokenRes.text()}`);
        
        // Wait a bit and try one more time on the original endpoint
        await new Promise(resolve => setTimeout(resolve, 3000));
        const retryTokenRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TURSO_API_TOKEN}`
          }
        });
        
        if (!retryTokenRes.ok) {
           console.log(`[Turso] Token generation completely failed. Continuing without token, some webshop functionality might be limited.`);
           return {
             url: dbUrl,
             token: "", // Return empty token so project creation doesn't fail completely
             name: dbName
           };
        }
        
        const retryTokenData: any = await retryTokenRes.json();
        console.log(`[Turso] Successfully generated auth token for ${dbName} on retry`);
        return {
          url: dbUrl,
          token: retryTokenData.jwt,
          name: dbName
        };
      }
      
      const tokenData: any = await fallbackTokenRes.json();
      console.log(`[Turso] Successfully generated auth token for ${dbName} using fallback`);
      return {
        url: dbUrl,
        token: tokenData.jwt,
        name: dbName
      };
    }

    const tokenData: any = await tokenRes.json();
    console.log(`[Turso] Successfully generated auth token for ${dbName}`);
    
    return {
      url: dbUrl,
      token: tokenData.jwt,
      name: dbName
    };
  } catch (error) {
    console.error('[Turso Error]', error);
    throw error;
  }
}

// Robust SQL splitting that respects single quotes, double quotes, and brackets
function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBracket = false;
  let parenDepth = 0;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const prev = i > 0 ? sql[i - 1] : '';

    if (char === "'" && prev !== '\\' && !inDoubleQuote && !inBracket) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && prev !== '\\' && !inSingleQuote && !inBracket) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '[' && !inSingleQuote && !inDoubleQuote) {
      inBracket = true;
    } else if (char === ']' && !inSingleQuote && !inDoubleQuote) {
      inBracket = false;
    } else if (char === '(' && !inSingleQuote && !inDoubleQuote && !inBracket) {
      parenDepth++;
    } else if (char === ')' && !inSingleQuote && !inDoubleQuote && !inBracket) {
      parenDepth--;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote && !inBracket && parenDepth === 0) {
      if (current.trim()) statements.push(current.trim() + ';');
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) statements.push(current.trim() + ';');
  return statements;
}

// Execute SQL directly on Turso database via HTTP API
export async function executeTursoSQL(dbUrl: string, authToken: string, sql: string) {
  // Convert libsql:// URL to HTTPS URL for HTTP API
  const httpUrl = dbUrl.replace('libsql://', 'https://');
  
  const statements = splitSql(sql);
  
  const response = await fetch(httpUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      statements: statements
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Turso HTTP error: ${err}`);
  }

  const result: any = await response.json();
  
  // Turso returns an array of results, one for each statement.
  if (Array.isArray(result)) {
    result.forEach((res, i) => {
      if (res.error) {
        const message = String(res.error.message || res.error || "");
        if (message.toLowerCase().includes("duplicate column name")) {
          return;
        }
        console.error(`[Turso Statement Error] Statement ${i}: ${statements[i]}`, res.error);
        throw new Error(`Statement ${i} failed: ${res.error.message}`);
      }
    });
  }

  return result;
}

// Create the webshop schema directly on Turso
export async function createWebshopSchema(dbUrl: string, authToken: string) {
  const schema = `
    CREATE TABLE IF NOT EXISTS [Customer] (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      firstName TEXT,
      lastName TEXT,
      phone TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS [Category] (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      image TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS [Product] (
      id TEXT PRIMARY KEY,
      categoryId TEXT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      originalPrice REAL, -- aka compareAtPrice
      compareAtPrice REAL,
      sku TEXT,
      images TEXT, -- JSON array of URLs
      featured INTEGER DEFAULT 0,
      inventory INTEGER DEFAULT 0,
      stock INTEGER DEFAULT 0, -- alias for inventory
      isVirtual INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE',
      rating REAL DEFAULT 0,
      reviews INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categoryId) REFERENCES [Category](id)
    );

    CREATE TABLE IF NOT EXISTS [Order] (
      id TEXT PRIMARY KEY,
      orderNumber TEXT UNIQUE NOT NULL,
      customerId TEXT,
      status TEXT DEFAULT 'PENDING',
      totalAmount REAL NOT NULL,
      shippingAddress TEXT, -- JSON object
      billingAddress TEXT, -- JSON object
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customerId) REFERENCES [Customer](id)
    );

    CREATE TABLE IF NOT EXISTS [OrderItem] (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      productId TEXT,
      quantity INTEGER NOT NULL,
      unitPrice REAL NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (orderId) REFERENCES [Order](id),
      FOREIGN KEY (productId) REFERENCES [Product](id)
    );

    ALTER TABLE [Product] ADD COLUMN sku TEXT;
    ALTER TABLE [Product] ADD COLUMN isVirtual INTEGER DEFAULT 0;
    ALTER TABLE [Order] ADD COLUMN shippingAddress TEXT;
    ALTER TABLE [Order] ADD COLUMN billingAddress TEXT;
  `;

  await executeTursoSQL(dbUrl, authToken, schema);
}