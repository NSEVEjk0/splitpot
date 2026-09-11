import { config } from "@/lib/config";
import { hostContextFromSessionToken } from "@/lib/hosts";
import { createPot, ValidationError } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/pots
 *
 * Two ways to create a pot:
 *  - A connected host (valid session cookie) creates pots under their own
 *    Moove key and Handle. No admin token needed.
 *  - Without a session, the admin token gates the default demo host (@ckay).
 *    The session path and the admin path are mutually exclusive: a request
 *    with a session never falls through to the admin check.
 */

function adminOk(req: Request): boolean {
  const expected = config().adminToken;
  if (!expected) return false;
  const header = req.headers.get("x-admin-token");
  const bearer = req.headers.get("authorization");
  const fromBearer = bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined;
  return header === expected || fromBearer === expected;
}

function parseSessionCookie(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq) === "splitpot_session") {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

export async function POST(req: Request) {
  const sessionToken = parseSessionCookie(req.headers.get("cookie"));
  const hostContext = await hostContextFromSessionToken(sessionToken);

  if (hostContext && !hostContext.isDemoHost) {
    // Connected host: their key, their handle, no admin token required.
    return createPotFor(req, hostContext);
  }

  if (!adminOk(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = config();
  const demoContext = {
    apiKey: cfg.apiKey,
    handle: cfg.handle,
    hostId: null,
    isDemoHost: true,
  };
  return createPotFor(req, demoContext);
}

async function createPotFor(req: Request, host: Awaited<ReturnType<typeof hostContextFromSessionToken>>) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const pot = await createPot(
      {
        title: body?.title,
        people: body?.people,
        total: body?.total,
        names: body?.names,
      },
      host!
    );
    return Response.json(pot, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Could not create the pot";
    return Response.json({ error: message }, { status: 502 });
  }
}
