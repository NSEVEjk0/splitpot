import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

let loaded = false;

/**
 * Load environment from ~/.proofgate.env (if present) and then .env.local,
 * without overriding anything already set in the process environment. This
 * means values injected by the hosting platform (e.g. Vercel) always win.
 */
function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;

  if (process.env.SPLITPOT_SKIP_DOTENV === "1") return;

  const home = homedir();
  const candidates = [join(home, ".proofgate.env"), ".env.local"];
  for (const path of candidates) {
    try {
      if (existsSync(path)) {
        loadDotenv({ path, override: false });
      }
    } catch {
      // best-effort: missing files are fine
    }
  }
}

export interface AppConfig {
  apiBaseUrl: string;
  apiKey: string;
  handle: string;
  adminToken: string;
  tursoUrl?: string;
  tursoAuthToken?: string;
}

export function config(): AppConfig {
  ensureLoaded();
  return {
    apiBaseUrl: (process.env.MOOVE_API_BASE_URL || "https://api.moove.xyz").replace(/\/+$/, ""),
    apiKey: process.env.MOOVE_API_KEY || "",
    handle: process.env.MOOVE_HANDLE || "@ckay",
    adminToken: process.env.ADMIN_TOKEN || "",
    tursoUrl: process.env.TURSO_DATABASE_URL || undefined,
    tursoAuthToken: process.env.TURSO_AUTH_TOKEN || undefined,
  };
}
