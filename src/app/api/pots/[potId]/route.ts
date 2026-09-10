import { getPotWithParticipants } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { potId: string } }
) {
  const pot = await getPotWithParticipants(params.potId);
  if (!pot) {
    return Response.json({ error: "Pot not found" }, { status: 404 });
  }
  return Response.json(pot);
}
