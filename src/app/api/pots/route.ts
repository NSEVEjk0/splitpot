import { config } from "@/lib/config";
import { createPot, ValidationError } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminOk(req: Request): boolean {
  const expected = config().adminToken;
  if (!expected) return false;
  const header = req.headers.get("x-admin-token");
  const bearer = req.headers.get("authorization");
  const fromBearer = bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined;
  return header === expected || fromBearer === expected;
}

export async function POST(req: Request) {
  if (!adminOk(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const pot = await createPot({
      title: body?.title,
      total: body?.total,
      names: body?.names,
    });
    return Response.json(pot, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Could not create the pot";
    return Response.json({ error: message }, { status: 502 });
  }
}
