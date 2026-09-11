import { getHostById, SESSION_COOKIE, verifySessionToken } from "@/lib/hosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/host/me — who is connected? Returns handle + key last-4 (never the
 * full key), or { host: null } when running on the default demo host.
 */

function parseCookie(header: string): string | null {
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq) === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

export async function GET(req: Request) {
  const token = parseCookie(req.headers.get("cookie") ?? "");
  const hostId = verifySessionToken(token);
  if (!hostId) return Response.json({ host: null });
  const host = await getHostById(hostId);
  if (!host) return Response.json({ host: null });
  return Response.json({
    host: { handle: host.handle, keyLast4: host.keyLast4 },
  });
}
