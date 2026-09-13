import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as historyGet } from "@/app/api/host/history/route";
import { createPot } from "@/lib/service";
import { __resetStoreForTests, getPotWithParticipants } from "@/lib/store";
import { hostContextForPot, sessionTokenFor, upsertHost } from "@/lib/hosts";
import { GET as statusGet } from "@/app/api/pots/[potId]/status/route";

function mockMoove(completed: Set<string>) {
  let n = 0;
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const method = String(init?.method ?? "GET").toUpperCase();
    if (method === "POST") {
      n += 1;
      return new Response(
        JSON.stringify({
          id: `link_${n}`,
          url: `https://moove.xyz/@host/pay/link_${n}`,
          status: "pending",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }
    const id = String(url).split("/").pop() ?? "";
    const done = completed.has(id);
    return new Response(
      JSON.stringify({
        id,
        status: done ? "completed" : "active",
        completedAt: done ? "2026-09-13T12:00:00.000Z" : null,
        transactionUrl: done ? `https://moove.xyz/tx/${id}` : null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });
}

function reqWithSession(token: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `splitpot_session=${token}`;
  return new Request("http://localhost/api/host/history", { headers });
}

describe("GET /api/host/history", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await __resetStoreForTests();
  });

  it("returns 401 without a host session", async () => {
    const res = await historyGet(reqWithSession(null));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Connect");
  });

  it("returns only the connected host's pots with payment outcomes", async () => {
    const completed = new Set<string>();
    vi.stubGlobal("fetch", mockMoove(completed));

    const host = await upsertHost("@frank", "mk_live_hostkey42");
    const ctx = await hostContextForPot(host.id);

    // A paid pot and an unpaid pot for this host.
    const paidPot = await createPot(
      {
        title: "Frank's dinner",
        people: [
          { name: "Franklin", amount: "10.00" },
          { name: "Jake", amount: "15.00" },
        ],
      },
      ctx
    );
    const unpaidPot = await createPot(
      {
        title: "Later",
        people: [
          { name: "Ada", amount: "5.00" },
          { name: "Chidi", amount: "5.00" },
        ],
      },
      ctx
    );

    // A demo-host pot that must NOT appear in @frank's history.
    await createPot(
      {
        title: "Demo pot",
        people: [
          { name: "X", amount: "1.00" },
          { name: "Y", amount: "1.00" },
        ],
      },
      await hostContextForPot(null)
    );

    // Another host's pot, also excluded.
    const other = await upsertHost("@zara", "mk_live_other9999");
    await createPot(
      {
        title: "Zara's pot",
        people: [
          { name: "X", amount: "1.00" },
          { name: "Y", amount: "1.00" },
        ],
      },
      await hostContextForPot(other.id)
    );

    // Complete Franklin's payment so one row is successful with a tx link.
    completed.add(paidPot.participants[0].mooveLinkId!);
    await statusGet(
      new Request("http://localhost/x", {
        headers: { "x-admin-token": "test-admin" },
      }),
      { params: { potId: paidPot.id } }
    );

    const token = sessionTokenFor(host);
    const res = await historyGet(reqWithSession(token));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.handle).toBe("@frank");
    expect(body.pots.map((p: any) => p.title).sort()).toEqual([
      "Frank's dinner",
      "Later",
    ]);

    const dinner = body.pots.find((p: any) => p.title === "Frank's dinner");
    expect(dinner.paidCount).toBe(1);
    const franklin = dinner.participants.find((p: any) => p.name === "Franklin");
    expect(franklin.status).toBe("paid");
    expect(franklin.completedAt).toBe("2026-09-13T12:00:00.000Z");
    expect(franklin.txUrl).toBe(
      `https://moove.xyz/tx/${paidPot.participants[0].mooveLinkId}`
    );
    const jake = dinner.participants.find((p: any) => p.name === "Jake");
    expect(jake.status).toBe("unpaid");
    expect(jake.txUrl).toBeNull();

    expect(body.stats.paymentsPaid).toBe(1);
    expect(body.stats.paymentsUnpaid).toBe(3);
    expect(body.stats.amountReceived).toBe("10.00");
    expect(body.stats.amountOutstanding).toBe("25.00");
    expect(body.stats.pots).toBe(2);

    // The unpaid pot is still there with both rows unpaid.
    const later = body.pots.find((p: any) => p.title === "Later");
    expect(later.participants.every((p: any) => p.status === "unpaid")).toBe(true);
    void unpaidPot;
  });
});
