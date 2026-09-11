import { createClient, type Client } from "@libsql/client";
import { config } from "./config";

let client: Client | null = null;

function resolveUrl(): { url: string; authToken?: string } {
  // Tests and local overrides take precedence.
  const testUrl = process.env.SPLITPOT_DB_URL;
  if (testUrl) return { url: testUrl };

  const cfg = config();
  if (cfg.tursoUrl) {
    return { url: cfg.tursoUrl, authToken: cfg.tursoAuthToken };
  }
  return { url: "file:splitpot.db" };
}

export function getDb(): Client {
  if (client) return client;
  const { url, authToken } = resolveUrl();
  client = createClient(authToken ? { url, authToken } : { url });
  return client;
}

let schemaPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (schemaPromise) return schemaPromise;
  const db = getDb();
  schemaPromise = (async () => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS hosts (
        id TEXT PRIMARY KEY,
        handle TEXT NOT NULL UNIQUE,
        key_encrypted TEXT NOT NULL,
        key_last4 TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS pots (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        total_amount TEXT NOT NULL,
        currency_note TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        host_id TEXT
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        pot_id TEXT NOT NULL,
        name TEXT NOT NULL,
        share_amount TEXT NOT NULL,
        moove_link_id TEXT,
        moove_pay_url TEXT,
        status TEXT NOT NULL,
        completed_at TEXT,
        raw_moove_json TEXT,
        position INTEGER NOT NULL
      )
    `);
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_participants_pot ON participants (pot_id)`
    );
    // Migration for databases created before hosts existed: add pots.host_id.
    // SQLite has no ADD COLUMN IF NOT EXISTS, so ignore the duplicate error.
    try {
      await db.execute(`ALTER TABLE pots ADD COLUMN host_id TEXT`);
    } catch {
      // column already exists
    }
  })();
  return schemaPromise;
}

// Testing hook: drop the memoized client/schema so a fresh in-memory DB is used.
export function __resetDbForTests(): void {
  client = null;
  schemaPromise = null;
}
