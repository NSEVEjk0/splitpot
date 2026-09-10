import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPot } from "@/lib/service";
import { __resetStoreForTests, getPotWithParticipants } from "@/lib/store";
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

describe("createPot creates one Moove link per participant", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await __resetStoreForTests();
  });

  it("posts one payment link per person with maxUsage 1 and the right amount", async () => {
    const captured: Captured[] = [];
    vi.stubGlobal("fetch", mockFetch(captured));

    const pot = await createPot({
      title: "Dinner at Kalu's",
      total: "80.00",
      names: ["Ada", "Chidi", "Zara"],
    });

    // one POST per participant
    expect(captured).toHaveLength(3);
    for (const call of captured) {
      expect(call.method).toBe("POST");
      expect(call.url).toBe("https://api.moove.test/v1/payment-link");
      expect(call.headers["x-api-key"]).toBe("test-key");
      expect(call.body.maxUsage).toBe(1);
      expect(typeof call.body.toAmount).toBe("string");
      expect(call.body.description).toContain(pot.id);
    }

    // amounts match the split and sum to the total exactly
    const amounts = captured.map((c) => c.body.toAmount);
    expect(amounts).toEqual(["26.66", "26.66", "26.68"]);
    const summed = fromCents(amounts.reduce((acc, a) => acc + toCents(a), 0));
    expect(summed).toBe("80.00");

    // each participant carries its own link id and pay url, unpaid to start
    expect(pot.participants.map((p) => p.mooveLinkId)).toEqual([
      "link_1",
      "link_2",
      "link_3",
    ]);
    for (const p of pot.participants) {
      expect(p.moovePayUrl).toContain("https://pay.moove.test/");
      expect(p.status).toBe("unpaid");
    }
    expect(pot.status).toBe("open");
    expect(pot.currencyNote).toBe("settlement token");

    // and it was persisted
    const stored = await getPotWithParticipants(pot.id);
    expect(stored?.participants).toHaveLength(3);
    expect(stored?.participants.map((p) => p.name)).toEqual(["Ada", "Chidi", "Zara"]);
  });

  it("gives every participant a distinct description so links never collide", async () => {
    const captured: Captured[] = [];
    vi.stubGlobal("fetch", mockFetch(captured));
    await createPot({ title: "Trip", total: "30.00", names: ["Ada", "Chidi"] });
    const descriptions = captured.map((c) => c.body.description);
    expect(new Set(descriptions).size).toBe(2);
  });
});
