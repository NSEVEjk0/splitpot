import { refreshPotStatus } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { potId: string } }
) {
  const pot = await refreshPotStatus(params.potId);
  if (!pot) {
    return Response.json({ error: "Pot not found" }, { status: 404 });
  }
  return Response.json(pot, {
    headers: { "Cache-Control": "no-store" },
  });
}
