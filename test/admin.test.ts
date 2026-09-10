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

describe("POST /api/pots admin gate", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await __resetStoreForTests();
  });

  it("returns 401 without an admin token", async () => {
    const res = await POST(
      req({ title: "Dinner", total: "80.00", names: ["Ada", "Chidi", "Zara"] })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 with the wrong admin token", async () => {
    const res = await POST(
      req(
        { title: "Dinner", total: "80.00", names: ["Ada", "Chidi"] },
        { "x-admin-token": "nope" }
      )
    );
    expect(res.status).toBe(401);
  });

  it("creates the pot with the correct admin token", async () => {
    vi.stubGlobal("fetch", mockMooveCreate());
    const res = await POST(
      req(
        { title: "Dinner", total: "80.00", names: ["Ada", "Chidi", "Zara"] },
        { "x-admin-token": "test-admin" }
      )
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Dinner");
    expect(body.participants).toHaveLength(3);
  });

  it("accepts the admin token as a bearer credential", async () => {
    vi.stubGlobal("fetch", mockMooveCreate());
    const res = await POST(
      req(
        { title: "Lunch", total: "10.00", names: ["Ada", "Chidi"] },
        { authorization: "Bearer test-admin" }
      )
    );
    expect(res.status).toBe(201);
  });

  it("rejects a pot with fewer than 2 or more than 12 people", async () => {
    vi.stubGlobal("fetch", mockMooveCreate());
    const tooFew = await POST(
      req({ title: "Solo", total: "10.00", names: ["Ada"] }, { "x-admin-token": "test-admin" })
    );
    expect(tooFew.status).toBe(400);

    const tooMany = await POST(
      req(
        {
          title: "Crowd",
          total: "10.00",
          names: Array.from({ length: 13 }, (_, i) => `P${i}`),
        },
        { "x-admin-token": "test-admin" }
      )
    );
    expect(tooMany.status).toBe(400);
  });
});
