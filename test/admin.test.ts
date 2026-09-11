import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/pots/route";
import { __resetStoreForTests } from "@/lib/store";

function mockMooveCreate() {
  let n = 0;
  return vi.fn(async (_url: string | URL, _init?: RequestInit) => {
    n += 1;
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

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/pots", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const PEOPLE = [
  { name: "Ada", amount: "26.66" },
  { name: "Chidi", amount: "26.66" },
  { name: "Zara", amount: "26.68" },
];

describe("POST /api/pots auth", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await __resetStoreForTests();
  });

  it("returns 401 without a session or admin token", async () => {
    const res = await POST(req({ title: "Dinner", people: PEOPLE }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 with the wrong admin token", async () => {
    const res = await POST(
      req({ title: "Dinner", people: PEOPLE.slice(0, 2) }, { "x-admin-token": "nope" })
    );
    expect(res.status).toBe(401);
  });

  it("creates the pot with the correct admin token (demo host)", async () => {
    vi.stubGlobal("fetch", mockMooveCreate());
    const res = await POST(
      req({ title: "Dinner", people: PEOPLE }, { "x-admin-token": "test-admin" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Dinner");
    expect(body.participants).toHaveLength(3);
    expect(body.isDemoHost).toBe(true);
  });

  it("accepts the admin token as a bearer credential", async () => {
    vi.stubGlobal("fetch", mockMooveCreate());
    const res = await POST(
      req(
        {
          title: "Lunch",
          people: [
            { name: "Ada", amount: "5.00" },
            { name: "Chidi", amount: "5.00" },
          ],
        },
        { authorization: "Bearer test-admin" }
      )
    );
    expect(res.status).toBe(201);
  });

  it("rejects a pot with fewer than 2 or more than 12 people", async () => {
    vi.stubGlobal("fetch", mockMooveCreate());
    const tooFew = await POST(
      req(
        { title: "Solo", people: [{ name: "Ada", amount: "10.00" }] },
        { "x-admin-token": "test-admin" }
      )
    );
    expect(tooFew.status).toBe(400);

    const tooMany = await POST(
      req(
        {
          title: "Crowd",
          people: Array.from({ length: 13 }, (_, i) => ({
            name: `P${i}`,
            amount: "1.00",
          })),
        },
        { "x-admin-token": "test-admin" }
      )
    );
    expect(tooMany.status).toBe(400);
  });

  it("lets a connected host create a pot with no admin token, under their own key", async () => {
    const fetchMock = mockMooveCreate();
    vi.stubGlobal("fetch", fetchMock);

    const { upsertHost, sessionTokenFor } = await import("@/lib/hosts");
    const host = await upsertHost("@frank", "mk_host_key_9911");

    const res = await POST(
      req(
        {
          title: "Franklin's dinner",
          people: [
            { name: "Franklin", amount: "10.00" },
            { name: "Jake", amount: "15.00" },
          ],
        },
        { cookie: `splitpot_session=${sessionTokenFor(host)}` }
      )
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.isDemoHost).toBe(false);
    expect(body.hostHandle).toBe("@frank");

    // The link-creation calls used the host's key, not the env key.
    const keys = fetchMock.mock.calls.map(
      (c) => (c[1]?.headers as Record<string, string>)["X-API-Key"]
    );
    expect(keys.every((k) => k === "mk_host_key_9911")).toBe(true);
    expect(keys).not.toContain("test-key");
  });
});
