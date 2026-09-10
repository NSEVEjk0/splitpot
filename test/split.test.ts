import { describe, expect, it } from "vitest";
import { fromCents, splitEvenly, toCents } from "@/lib/split";

function sum(shares: string[]): string {
  return fromCents(shares.reduce((acc, s) => acc + toCents(s), 0));
}

describe("splitEvenly", () => {
  it("splits 80.00 across 3 people so the last share absorbs the remainder", () => {
    const shares = splitEvenly("80.00", 3);
    expect(shares).toEqual(["26.66", "26.66", "26.68"]);
    expect(sum(shares)).toBe("80.00");
  });

  it("splits evenly when the total divides cleanly", () => {
    const shares = splitEvenly("100.00", 4);
    expect(shares).toEqual(["25.00", "25.00", "25.00", "25.00"]);
    expect(sum(shares)).toBe("100.00");
  });

  it("always sums back to the exact total for awkward amounts", () => {
    const cases: Array<[string, number]> = [
      ["0.03", 2],
      ["10.01", 3],
      ["99.99", 7],
      ["1.00", 12],
      ["123.45", 11],
      ["5", 3],
    ];
    for (const [total, n] of cases) {
      const shares = splitEvenly(total, n);
      expect(shares).toHaveLength(n);
      expect(sum(shares)).toBe(fromCents(toCents(total)));
    }
  });

  it("parses and formats amounts in whole cents", () => {
    expect(toCents("80")).toBe(8000);
    expect(toCents("80.5")).toBe(8050);
    expect(toCents("80.55")).toBe(8055);
    expect(fromCents(8055)).toBe("80.55");
    expect(() => toCents("abc")).toThrow();
  });
});
