import { verify } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { potId: string; participantId: string } }
) {
  const result = await verify(params.potId, params.participantId);
  if (!result) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({
    paid: result.paid,
    amounts: result.amounts,
    mooveLinkId: result.mooveLinkId,
    handle: result.handle,
    completedAt: result.completedAt,
  });
}
