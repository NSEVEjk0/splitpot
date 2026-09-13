import { getPotsByHostWithParticipants } from "@/lib/store";
import { getHostById, SESSION_COOKIE, verifySessionToken } from "@/lib/hosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/host/history — the connected host's transaction history:
 * every pot they created and the outcome of each payment (paid, with the
 * Moove transaction link where known, or unpaid). Requires a host session.
 */

function parseCookie(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq) === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

/** The Moove transaction URL, if the last raw response carried one. */
function txUrlOf(rawMooveJson: string | null): string | null {
  if (!rawMooveJson) return null;
  try {
    const j = JSON.parse(rawMooveJson);
    const d = j && typeof j === "object" && "data" in j ? j.data : j;
    const url = d?.transactionUrl ?? j?.transactionUrl ?? null;
    return typeof url === "string" && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const hostId = verifySessionToken(parseCookie(req.headers.get("cookie")));
  if (!hostId) {
    return Response.json({ error: "Connect your Moove account first" }, { status: 401 });
  }
  const host = await getHostById(hostId);
  if (!host) {
    return Response.json({ error: "Connect your Moove account first" }, { status: 401 });
  }

  const pots = await getPotsByHostWithParticipants(host.id);

  const shaped = pots.map((pot) => ({
    id: pot.id,
    title: pot.title,
    totalAmount: pot.totalAmount,
    currencyNote: pot.currencyNote,
    status: pot.status,
    createdAt: pot.createdAt,
    paidCount: pot.participants.filter((p) => p.status === "paid").length,
    participants: pot.participants.map((p) => ({
      name: p.name,
      shareAmount: p.shareAmount,
      status: p.status,
      completedAt: p.completedAt,
      mooveLinkId: p.mooveLinkId,
      txUrl: txUrlOf(p.rawMooveJson),
    })),
  }));

  const allPayments = shaped.flatMap((p) => p.participants);
  const paid = allPayments.filter((p) => p.status === "paid");
  const sum = (arr: { shareAmount: string }[]) =>
    (arr.reduce((acc, p) => acc + Math.round(parseFloat(p.shareAmount) * 100), 0) / 100).toFixed(2);

  return Response.json({
    handle: host.handle,
    keyLast4: host.keyLast4,
    pots: shaped,
    stats: {
      pots: shaped.length,
      completedPots: shaped.filter((p) => p.status === "complete").length,
      paymentsPaid: paid.length,
      paymentsUnpaid: allPayments.length - paid.length,
      amountReceived: sum(paid),
      amountOutstanding: sum(allPayments.filter((p) => p.status !== "paid")),
    },
  });
}
