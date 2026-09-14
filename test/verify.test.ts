import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as verifyGet } from "@/app/api/verify/[potId]/[participantId]/route";
import { GET as statusGet } from "@/app/api/pots/[potId]/status/route";
import { createPot } from "@/lib/service";
import { __resetStoreForTests } from "@/lib/store";
import { hostContextForPot, upsertHost } from "@/lib/hosts";

function mockFetch(completed: Set<string>) {
  let n = 0;
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const method = String(init?.method ?? "GET").toUpperCase();
    if (method === "POST") {
      n += 1;
      return new Response(
        JSON.stringify({
          id: `link_${n}`,
          url: `https://pay.moove.test/link_${n}`,
          status: "pending",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }
    const id = String(url).split("/").pop()?.split("?")[0] ?? "";
    const isDone = completed.has(id);
    return new Response(
      JSON.stringify({
        id,
        status: isDone ? "completed" : "pending",
        completedAt: isDone ? "2026-09-09T12:00:00.000Z" : null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });
}

describe("GET /api/verify/[potId]/[participantId]", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await __resetStoreForTests();
  });

  it("returns the public verify payload for an unpaid participant", async () => {
    const completed = new Set<string>();
    vi.stubGlobal("fetch", mockFetch(completed));

    const pot = await createPot(
      {
        title: "Dinner",
        people: [
          { name: "Ada", amount: "26.66" },
          { name: "Chidi", amount: "26.66" },
          { name: "Zara", amount: "26.68" },
        ],
      },
      await hostContextForPot(null)
    );
    const p = pot.participants[2];

    const res = await verifyGet(new Request("http://localhost/x"), {
      params: { potId: pot.id, participantId: p.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toEqual({
      paid: false,
      amounts: { share: "26.68", total: "80.00", currencyNote: "settlement token" },
      mooveLinkId: p.mooveLinkId,
      handle: "@ckay",
      completedAt: null,
    });
  });

  it("reports paid with a completedAt once the link has completed", async () => {
    const completed = new Set<string>();
    vi.stubGlobal("fetch", mockFetch(completed));

    const pot = await createPot(
      {
        title: "Dinner",
        people: [
          { name: "Ada", amount: "15.00" },
          { name: "Chidi", amount: "15.00" },
        ],
      },
      await hostContextForPot(null)
    );
    const p = pot.participants[0];
    completed.add(p.mooveLinkId!);

    await statusGet(new Request("http://localhost/x"), { params: { potId: pot.id } });

    const res = await verifyGet(new Request("http://localhost/x"), {
      params: { potId: pot.id, participantId: p.id },
    });
    const body = await res.json();
    expect(body.paid).toBe(true);
    expect(body.completedAt).toBe("2026-09-09T12:00:00.000Z");
    expect(body.handle).toBe("@ckay");
    expect(body.amounts.share).toBe("15.00");
  });

  it("reports the connected host's handle when the pot belongs to one", async () => {
    const completed = new Set<string>();
    vi.stubGlobal("fetch", mockFetch(completed));

    const host = await upsertHost("@frank", "mk_live_hostkey42");
    const pot = await createPot(
      {
        title: "Frank's pot",
        people: [
          { name: "Franklin", amount: "10.00" },
          { name: "Jake", amount: "15.00" },
        ],
      },
      await hostContextForPot(host.id)
    );
    const p = pot.participants[0];

    const res = await verifyGet(new Request("http://localhost/x"), {
      params: { potId: pot.id, participantId: p.id },
    });
    const body = await res.json();
    expect(body.handle).toBe("@frank");
    expect(body.handle).not.toBe("@ckay");
  });

  it("404s for an unknown pot or participant", async () => {
    vi.stubGlobal("fetch", mockFetch(new Set()));
    const pot = await createPot(
      {
        title: "Dinner",
        people: [
          { name: "Ada", amount: "15.00" },
          { name: "Chidi", amount: "15.00" },
        ],
      },
      await hostContextForPot(null)
    );

    const badPot = await verifyGet(new Request("http://localhost/x"), {
      params: { potId: "pot_missing", participantId: pot.participants[0].id },
    });
    expect(badPot.status).toBe(404);

    const badParticipant = await verifyGet(new Request("http://localhost/x"), {
      params: { potId: pot.id, participantId: "p_missing" },
    });
    expect(badParticipant.status).toBe(404);
  });
});
