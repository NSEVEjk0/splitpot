import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPot } from "@/lib/service";
import { __resetStoreForTests, getPotWithParticipants } from "@/lib/store";
import { hostContextForPot, upsertHost } from "@/lib/hosts";
import { toCents, fromCents } from "@/lib/split";

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
}

function mockFetch(captured: Captured[]) {
  let n = 0;
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    n += 1;
    const headers: Record<string, string> = {};
    const h = init?.headers as Record<string, string> | undefined;
    if (h) for (const [k, v] of Object.entries(h)) headers[k.toLowerCase()] = String(v);
    captured.push({
      url: String(url),
      method: String(init?.method ?? "GET"),
      headers,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(
      JSON.stringify({
        id: `link_${n}`,
        url: `https://pay.moove.test/link_${n}`,
        status: "pending",
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  });
}

/** Default demo host context (env key). */
async function demoContext() {
  return hostContextForPot(null);
}

describe("createPot with per-person amounts", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await __resetStoreForTests();
  });

  it("sends each person's own amount to Moove as toAmount and stores it", async () => {
    const captured: Captured[] = [];
    vi.stubGlobal("fetch", mockFetch(captured));

    const pot = await createPot(
      {
        title: "Dinner at Kalu's",
        people: [
          { name: "Franklin", amount: "10.00" },
          { name: "Jake", amount: "15.00" },
          { name: "Sophia", amount: "7.25" },
        ],
      },
      await demoContext()
    );

    // one POST per participant, each with that person's amount
    expect(captured).toHaveLength(3);
    const amounts = captured.map((c) => c.body.toAmount);
    expect(amounts).toEqual(["10.00", "15.00", "7.25"]);
    for (const call of captured) {
      expect(call.method).toBe("POST");
      expect(call.url).toBe("https://api.moove.test/v1/payment-link");
      expect(call.headers["x-api-key"]).toBe("test-key");
      expect(call.body.maxUsage).toBe(1);
      expect(call.body.description).toMatch(/^pot_[0-9a-f]{12}:p_[0-9a-f]{12}$/);
    }

    // total is the sum of the rows
    expect(pot.totalAmount).toBe("32.25");
    expect(pot.participants.map((p) => p.shareAmount)).toEqual([
      "10.00",
      "15.00",
      "7.25",
    ]);

    // persisted with per-person amounts
    const stored = await getPotWithParticipants(pot.id);
    expect(stored?.participants.map((p) => p.shareAmount)).toEqual([
      "10.00",
      "15.00",
      "7.25",
    ]);
  });

  it("still supports the even-split shape and sums exactly", async () => {
    const captured: Captured[] = [];
    vi.stubGlobal("fetch", mockFetch(captured));

    const pot = await createPot(
      { title: "Trip", total: "80.00", names: ["Ada", "Chidi", "Zara"] },
      await demoContext()
    );

    const amounts = captured.map((c) => c.body.toAmount);
    expect(amounts).toEqual(["26.66", "26.66", "26.68"]);
    const summed = fromCents(amounts.reduce((acc, a) => acc + toCents(a), 0));
    expect(summed).toBe("80.00");
    expect(pot.totalAmount).toBe("80.00");
  });

  it("rejects invalid per-person amounts", async () => {
    vi.stubGlobal("fetch", mockFetch([]));
    const ctx = await demoContext();

    await expect(
      createPot(
        {
          title: "Bad",
          people: [
            { name: "A", amount: "10.00" },
            { name: "B", amount: "0" },
          ],
        },
        ctx
      )
    ).rejects.toThrow();

    await expect(
      createPot(
        {
          title: "Bad",
          people: [
            { name: "A", amount: "10.00" },
            { name: "B", amount: "1.234" },
          ],
        },
        ctx
      )
    ).rejects.toThrow();
  });

  it("uses the connected host's key, not the env key, when a host owns the pot", async () => {
    const captured: Captured[] = [];
    vi.stubGlobal("fetch", mockFetch(captured));

    const host = await upsertHost("@frank", "mk_live_hostkey42");
    const ctx = await hostContextForPot(host.id);

    const pot = await createPot(
      {
        title: "Frank's pot",
        people: [
          { name: "Franklin", amount: "10.00" },
          { name: "Jake", amount: "15.00" },
        ],
      },
      ctx
    );

    expect(pot.hostId).toBe(host.id);
    expect(pot.hostHandle).toBe("@frank");
    expect(pot.isDemoHost).toBe(false);
    for (const call of captured) {
      expect(call.headers["x-api-key"]).toBe("mk_live_hostkey42");
      expect(call.headers["x-api-key"]).not.toBe("test-key");
    }

    const stored = await getPotWithParticipants(pot.id);
    expect(stored?.hostHandle).toBe("@frank");
  });

  it("gives every participant a distinct description so links never collide", async () => {
    const captured: Captured[] = [];
    vi.stubGlobal("fetch", mockFetch(captured));
    await createPot(
      {
        title: "Trip",
        people: [
          { name: "Ada", amount: "5.00" },
          { name: "Chidi", amount: "5.00" },
        ],
      },
      await demoContext()
    );
    const descriptions = captured.map((c) => c.body.description);
    expect(new Set(descriptions).size).toBe(2);
  });
});
