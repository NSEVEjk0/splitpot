import { config } from "@/lib/config";
import { sessionTokenFor, upsertHost } from "@/lib/hosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/host/connect — a host pastes their Moove Handle + Receive API key.
 * The key is validated by creating a 1.00 test link under that key before it is
 * stored (so a typo'd key never gets saved), then encrypted at rest. The
 * session cookie holds only a signed host id — never the key.
 */

function sessionCookie(token: string, maxAgeSeconds: number): string {
  const parts = [
    `splitpot_session=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (config().hostKeySecret) parts.push("Secure");
  return parts.join("; ");
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const handle = typeof body?.handle === "string" ? body.handle.trim() : "";
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";

  if (!handle || !apiKey) {
    return Response.json(
      { error: "Handle and API key are required" },
      { status: 400 }
    );
  }

  // Validate the key against the real Moove API before storing it: a minimal
  // one-time link. Leftover validation links are harmless (single-use, unpaid).
  let ok = false;
  let mooveError = "";
  try {
    const res = await fetch(`${config().apiBaseUrl}/v1/payment-link`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        toAmount: "1.00",
        description: `splitpot-connect-validate`,
        maxUsage: 1,
      }),
    });
    if (res.ok) {
      ok = true;
    } else {
      mooveError = `Moove rejected that key (status ${res.status})`;
    }
  } catch {
    mooveError = "Could not reach Moove to validate that key";
  }
  if (!ok) {
    return Response.json({ error: mooveError || "Invalid API key" }, { status: 400 });
  }

  try {
    const host = await upsertHost(handle, apiKey);
    const token = sessionTokenFor(host);
    return Response.json(
      { handle: host.handle, keyLast4: host.keyLast4 },
      { status: 200, headers: { "Set-Cookie": sessionCookie(token, 60 * 60 * 24 * 30) } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save host";
    return Response.json({ error: message }, { status: 500 });
  }
}
