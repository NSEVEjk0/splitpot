import { createHmac, randomUUID } from "node:crypto";
import { config } from "./config";
import { decryptSecret, encryptSecret, safeEqual } from "./crypto";
import { getDb, ensureSchema } from "./db";

/**
 * Connected hosts. A host pastes their own Moove Receive API key + Handle on
 * /connect; the key is encrypted at rest and only ever sent back as last-4.
 * Pots they create are paid to their Handle, not to the default demo host.
 */

export interface Host {
  id: string;
  handle: string;
  keyEncrypted: string;
  keyLast4: string;
  createdAt: string;
}

/** Resolved host context for Moove calls: which key and handle to use. */
export interface HostContext {
  apiKey: string;
  handle: string;
  hostId: string | null;
  isDemoHost: boolean;
}

export const SESSION_COOKIE = "splitpot_session";

function rowToHost(r: any): Host {
  return {
    id: String(r.id),
    handle: String(r.handle),
    keyEncrypted: String(r.key_encrypted),
    keyLast4: String(r.key_last4),
    createdAt: String(r.created_at),
  };
}

export function sessionSecret(): string {
  const cfg = config();
  if (cfg.sessionSecret) return cfg.sessionSecret;
  if (cfg.hostKeySecret) return cfg.hostKeySecret;
  // Dev fallback so the app still runs; production should set HOST_KEY_SECRET.
  return "splitpot-dev-secret";
}

function makeSessionToken(hostId: string): string {
  const secret = sessionSecret();
  // token = hostId.hmac(hostId) — verifiable without a DB round-trip.
  return `${hostId}.${createHmacToken(hostId, secret)}`;
}

function createHmacToken(hostId: string, secret: string): string {
  return createHmac("sha256", secret).update(hostId).digest("base64url");
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const idx = token.indexOf(".");
  if (idx <= 0) return null;
  const hostId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmacToken(hostId, sessionSecret());
  if (safeEqual(sig, expected)) return hostId;
  return null;
}

export function normalizeHandle(handle: string): string {
  const trimmed = (handle || "").trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export async function upsertHost(handle: string, apiKey: string): Promise<Host> {
  await ensureSchema();
  const db = getDb();
  const cfg = config();
  const normalized = normalizeHandle(handle);

  if (!cfg.hostKeySecret) {
    throw new Error("HOST_KEY_SECRET is not configured");
  }

  const id = "host_" + randomUUID().replace(/-/g, "").slice(0, 12);
  const keyEncrypted = encryptSecret(apiKey, cfg.hostKeySecret);
  const keyLast4 = apiKey.slice(-4);
  const createdAt = new Date().toISOString();

  const existing = await db.execute({
    sql: `SELECT * FROM hosts WHERE handle = ?`,
    args: [normalized],
  });

  if (existing.rows.length > 0) {
    // Same handle reconnecting: rotate the key.
    await db.execute({
      sql: `UPDATE hosts SET key_encrypted = ?, key_last4 = ? WHERE handle = ?`,
      args: [keyEncrypted, keyLast4, normalized],
    });
    const res = await db.execute({
      sql: `SELECT * FROM hosts WHERE handle = ?`,
      args: [normalized],
    });
    return rowToHost(res.rows[0]);
  }

  await db.execute({
    sql: `INSERT INTO hosts (id, handle, key_encrypted, key_last4, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [id, normalized, keyEncrypted, keyLast4, createdAt],
  });
  return { id, handle: normalized, keyEncrypted, keyLast4, createdAt };
}

export async function getHostByHandle(handle: string): Promise<Host | null> {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT * FROM hosts WHERE handle = ?`,
    args: [normalizeHandle(handle)],
  });
  if (res.rows.length === 0) return null;
  return rowToHost(res.rows[0]);
}

export async function getHostById(hostId: string): Promise<Host | null> {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT * FROM hosts WHERE id = ?`,
    args: [hostId],
  });
  if (res.rows.length === 0) return null;
  return rowToHost(res.rows[0]);
}

export function sessionTokenFor(host: Host): string {
  return makeSessionToken(host.id);
}

/**
 * Resolve the host context for a pot: a connected host's own key and handle,
 * or the default demo host from env when there is no session.
 */
export async function hostContextForPot(hostId: string | null): Promise<HostContext> {
  if (hostId) {
    const host = await getHostById(hostId);
    if (host) {
      const apiKey = decryptSecret(host.keyEncrypted, config().hostKeySecret);
      return { apiKey, handle: host.handle, hostId: host.id, isDemoHost: false };
    }
  }
  const cfg = config();
  return { apiKey: cfg.apiKey, handle: cfg.handle, hostId: null, isDemoHost: true };
}

/** Resolve the host context from a session cookie value (no pot row involved). */
export async function hostContextFromSessionToken(
  token: string | undefined | null
): Promise<HostContext | null> {
  const hostId = verifySessionToken(token);
  if (!hostId) return null;
  return hostContextForPot(hostId);
}
