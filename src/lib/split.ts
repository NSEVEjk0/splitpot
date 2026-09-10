/**
 * Money helpers that work in integer cents so a split always sums back to the
 * original total exactly. All amounts are decimal strings in the settlement
 * token (two fractional digits).
 */

export class AmountError extends Error {}

const AMOUNT_RE = /^\d+(\.\d+)?$/;

/** Parse a decimal string like "80" or "80.5" or "80.55" into integer cents. */
export function toCents(amount: string): number {
  const s = String(amount).trim();
  if (!AMOUNT_RE.test(s)) {
    throw new AmountError(`Invalid amount: ${JSON.stringify(amount)}`);
  }
  const [whole, frac = ""] = s.split(".");
  const cents = parseInt(whole, 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
  return cents;
}

/** Format integer cents back into a "X.YY" decimal string. */
export function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole}.${String(frac).padStart(2, "0")}`;
}

/** Normalize a user-supplied amount to a canonical "X.YY" string. */
export function normalizeAmount(amount: string): string {
  return fromCents(toCents(amount));
}

/**
 * Split a total evenly across n shares. Every share is floor(total/n) except
 * the last, which absorbs the remainder so the shares sum to the total exactly.
 * Returns an array of "X.YY" strings of length n.
 */
export function splitEvenly(total: string, n: number): string[] {
  if (!Number.isInteger(n) || n < 1) {
    throw new AmountError(`Invalid participant count: ${n}`);
  }
  const totalCents = toCents(total);
  const base = Math.floor(totalCents / n);
  const shares: number[] = new Array(n).fill(base);
  const remainder = totalCents - base * n;
  shares[n - 1] += remainder;
  return shares.map(fromCents);
}
