#!/usr/bin/env node
/**
 * Live smoke test against the Moove Receive Agent API.
 *
 * Creates two one-time payment links at 1.00 each, reads them back, and prints
 * PASS or FAIL. It never prints the API key. Leftover test links can be ignored.
 *
 *   npm run smoke
 */
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

for (const path of [join(homedir(), ".proofgate.env"), ".env.local"]) {
  if (existsSync(path)) loadDotenv({ path, override: false });
}

const BASE = (process.env.MOOVE_API_BASE_URL || "https://api.moove.xyz").replace(/\/+$/, "");
const KEY = process.env.MOOVE_API_KEY || "";
const HANDLE = process.env.MOOVE_HANDLE || "@ckay";

function headers() {
  return {
    "X-API-Key": KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function parseLink(body) {
  const data = body && typeof body === "object" && "data" in body ? body.data : body;
  return {
    id: pick(data, ["id", "paymentLinkId", "linkId", "paymentId"]),
    url: pick(data, ["url", "paymentUrl", "checkoutUrl", "link", "hostedUrl", "payUrl"]),
    status: pick(data, ["status", "state"]) ?? "pending",
  };
}

async function main() {
  if (!KEY) {
    console.log("FAIL — MOOVE_API_KEY is not set (checked ~/.proofgate.env and .env.local)");
    process.exit(1);
  }

  console.log(`Moove base URL: ${BASE}`);
  console.log(`Settling to handle: ${HANDLE}`);
  console.log("API key: present (value not printed)");
  console.log("");

  const stamp = Date.now();
  const created = [];

  for (const who of ["smoke-a", "smoke-b"]) {
    const res = await fetch(`${BASE}/v1/payment-link`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        toAmount: "1.00",
        description: `splitpot-smoke:${stamp}:${who}`,
        maxUsage: 1,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.log(`FAIL — create ${who} returned ${res.status}: ${text.slice(0, 300)}`);
      process.exit(1);
    }
    const link = parseLink(JSON.parse(text || "{}"));
    if (!link.id || !link.url) {
      console.log(`FAIL — create ${who} response missing id or url: ${text.slice(0, 300)}`);
      process.exit(1);
    }
    created.push(link);
    console.log(`created ${who}: id=${link.id} status=${link.status}`);
    console.log(`  pay url: ${link.url}`);
  }

  console.log("");

  for (const link of created) {
    const res = await fetch(`${BASE}/v1/payment-link/${encodeURIComponent(link.id)}`, {
      method: "GET",
      headers: headers(),
    });
    const text = await res.text();
    if (!res.ok) {
      console.log(`FAIL — read ${link.id} returned ${res.status}: ${text.slice(0, 300)}`);
      process.exit(1);
    }
    const read = parseLink(JSON.parse(text || "{}"));
    console.log(`read ${link.id}: status=${read.status}`);
  }

  console.log("");
  console.log("PASS — created 2 one-time links at 1.00 each and read both back.");
  console.log("Leftover smoke links can be ignored; they are single-use and unpaid.");
}

main().catch((err) => {
  console.log(`FAIL — ${err && err.message ? err.message : String(err)}`);
  process.exit(1);
});
