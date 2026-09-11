import { beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import {
  getHostByHandle,
  getHostById,
  hostContextForPot,
  sessionTokenFor,
  upsertHost,
  verifySessionToken,
} from "@/lib/hosts";
import { __resetStoreForTests } from "@/lib/store";

describe("host key encryption", () => {
  it("round-trips a key and never stores plaintext", () => {
    const envelope = encryptSecret("mk_live_secret123", "test-host-key-secret");
    expect(envelope).not.toContain("mk_live_secret123");
    expect(decryptSecret(envelope, "test-host-key-secret")).toBe("mk_live_secret123");
  });

  it("refuses to decrypt with the wrong secret or a tampered envelope", () => {
    const envelope = encryptSecret("mk_live_secret123", "test-host-key-secret");
    expect(() => decryptSecret(envelope, "wrong-secret")).toThrow();
    const parts = envelope.split(".");
    parts[1] = Buffer.from("tampered-iv!!").toString("base64");
    expect(() => decryptSecret(parts.join("."), "test-host-key-secret")).toThrow();
  });
});

describe("hosts store", () => {
  beforeEach(async () => {
    await __resetStoreForTests();
  });

  it("stores a host encrypted, exposes last 4 only, and resolves its context", async () => {
    const host = await upsertHost("frank", "mk_live_hostkey42");
    expect(host.handle).toBe("@frank");
    expect(host.keyLast4).toBe("ey42");
    expect(host.keyEncrypted).not.toContain("mk_live_hostkey42");

    const byHandle = await getHostByHandle("@frank");
    expect(byHandle?.id).toBe(host.id);

    const byId = await getHostById(host.id);
    expect(byId?.keyEncrypted).not.toContain("mk_live_hostkey42");

    const ctx = await hostContextForPot(host.id);
    expect(ctx.apiKey).toBe("mk_live_hostkey42");
    expect(ctx.handle).toBe("@frank");
    expect(ctx.isDemoHost).toBe(false);
  });

  it("normalizes handles without a leading @", async () => {
    const host = await upsertHost("sophia", "mk_live_x1234");
    expect(host.handle).toBe("@sophia");
  });

  it("falls back to the demo host context for unknown host ids", async () => {
    const ctx = await hostContextForPot("host_missing");
    expect(ctx.apiKey).toBe("test-key");
    expect(ctx.handle).toBe("@ckay");
    expect(ctx.isDemoHost).toBe(true);
  });

  it("rotates the key when the same handle reconnects", async () => {
    const first = await upsertHost("@frank", "mk_live_aaaa1111");
    const second = await upsertHost("@frank", "mk_live_bbbb2222");
    expect(second.id).toBe(first.id);
    expect(second.keyLast4).toBe("2222");
    const ctx = await hostContextForPot(second.id);
    expect(ctx.apiKey).toBe("mk_live_bbbb2222");
  });

  it("issues session tokens that verify but reject tampering", async () => {
    const host = await upsertHost("@frank", "mk_live_hostkey42");
    const token = sessionTokenFor(host);
    expect(verifySessionToken(token)).toBe(host.id);
    // Corrupt the signature half (after the first dot) — must not verify.
    const dot = token.indexOf(".");
    const tampered = `${token.slice(0, dot)}.${token.slice(dot + 1)}x`;
    expect(verifySessionToken(tampered)).toBeNull();
    expect(verifySessionToken("garbage")).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
  });
});
