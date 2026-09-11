import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as statusGet } from "@/app/api/pots/[potId]/status/route";
import { createPot } from "@/lib/service";
import { __resetStoreForTests } from "@/lib/store";
import { hostContextForPot } from "@/lib/hosts";

/**
 * POST (create) always returns a pending link. GET (status) returns whatever
 * the test has queued for that link id, so we can complete links one at a time.
 */
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
    const id = String(url).split("/").pop() ?? "";
    const isDone = completed.has(id);
    return new Response(
      JSON.stringify({
        id,
        url: `https://pay.moove.test/${id}`,
        status: isDone ? "completed" : "pending",
        completedAt: isDone ? "2026-09-09T12:00:00.000Z" : null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });
}

describe("GET /api/pots/[potId]/status", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await __resetStoreForTests();
  });

  it("turns a row paid when Moove reports completed, and completes the pot when all are paid", async () => {
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
    const [first, second] = pot.participants;

    // nothing paid yet
    let res = await statusGet(new Request("http://localhost/x"), {
      params: { potId: pot.id },
    });
    expect(res.status).toBe(200);
    let body = await res.json();
    expect(body.status).toBe("open");
    expect(body.participants.every((p: any) => p.status === "unpaid")).toBe(true);

    // first link completes
    completed.add(first.mooveLinkId!);
    res = await statusGet(new Request("http://localhost/x"), {
      params: { potId: pot.id },
    });
    body = await res.json();
    expect(body.participants[0].status).toBe("paid");
    expect(body.participants[0].completedAt).toBe("2026-09-09T12:00:00.000Z");
    expect(body.participants[1].status).toBe("unpaid");
    expect(body.status).toBe("open");

    // second link completes -> pot complete
    completed.add(second.mooveLinkId!);
    res = await statusGet(new Request("http://localhost/x"), {
      params: { potId: pot.id },
    });
    body = await res.json();
    expect(body.participants.every((p: any) => p.status === "paid")).toBe(true);
    expect(body.status).toBe("complete");
  });

  it("returns 404 for an unknown pot", async () => {
    const res = await statusGet(new Request("http://localhost/x"), {
      params: { potId: "pot_missing" },
    });
    expect(res.status).toBe(404);
  });

  it("keeps a paid row paid and stops re-polling it", async () => {
    const completed = new Set<string>();
    const fetchMock = mockFetch(completed);
    vi.stubGlobal("fetch", fetchMock);

    const pot = await createPot(
      {
        title: "Trip",
        people: [
          { name: "Ada", amount: "10.00" },
          { name: "Chidi", amount: "10.00" },
        ],
      },
      await hostContextForPot(null)
    );
    completed.add(pot.participants[0].mooveLinkId!);

    await statusGet(new Request("http://localhost/x"), { params: { potId: pot.id } });
    const callsAfterFirst = fetchMock.mock.calls.length;

    await statusGet(new Request("http://localhost/x"), { params: { potId: pot.id } });
    const callsAfterSecond = fetchMock.mock.calls.length;

    // only the still-unpaid participant is polled on the second refresh
    expect(callsAfterSecond - callsAfterFirst).toBe(1);
  });
});
