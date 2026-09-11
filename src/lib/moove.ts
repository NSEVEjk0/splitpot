import { config } from "./config";

/**
 * Thin client for the Moove Receive Agent API.
 *
 * We create a hosted, one-time payment link per participant and later read its
 * completion status. Splitpot never moves funds — Moove does. We only create
 * links and read whether they have been paid.
 *
 * The API key is passed explicitly: a connected host's own key when they have
 * a session, the default demo host's env key otherwise.
 *
 * The response shape is parsed defensively: Moove's OpenAPI schema is the
 * source of truth, and different deployments have surfaced the same values
 * under slightly different field names, so we accept the common aliases.
 */

export interface CreatePaymentLinkInput {
  /** Decimal string in the account settlement token, e.g. "26.68". */
  toAmount: string;
  /** Our own identifier for the link (stored as the Moove description). */
  description: string;
  /** How many times the link may be paid. Splitpot always uses 1. */
  maxUsage?: number;
}

export interface PaymentLink {
  id: string;
  url: string;
  status: string;
  completedAt: string | null;
  raw: unknown;
}

const CREATE_PATH = "/v1/payment-link";
const GET_PATH = "/v1/payment-link"; // + "/{id}"

function headers(apiKey: string): Record<string, string> {
  return {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function pick(obj: any, keys: string[]): unknown {
  for (const k of keys) {
    if (obj == null) continue;
    const v = obj[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function parsePaymentLink(body: any): PaymentLink {
  const data = body && typeof body === "object" && "data" in body ? body.data : body;

  const id = pick(data, ["id", "paymentLinkId", "linkId", "paymentId"]) ?? pick(body, ["id"]);
  const url =
    pick(data, ["url", "paymentUrl", "checkoutUrl", "link", "hostedUrl", "payUrl"]) ??
    pick(body, ["url"]);
  const status = pick(data, ["status", "state"]) ?? pick(body, ["status"]) ?? "pending";
  const completedAt =
    pick(data, ["completedAt", "completed_at", "paidAt", "paid_at", "settledAt"]) ?? null;

  return {
    id: id == null ? "" : String(id),
    url: url == null ? "" : String(url),
    status: String(status),
    completedAt: completedAt == null ? null : String(completedAt),
    raw: body,
  };
}

async function readBody(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function createPaymentLink(
  input: CreatePaymentLinkInput,
  apiKey: string
): Promise<PaymentLink> {
  const { apiBaseUrl } = config();
  const res = await fetch(`${apiBaseUrl}${CREATE_PATH}`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      toAmount: input.toAmount,
      description: input.description,
      maxUsage: input.maxUsage ?? 1,
    }),
  });
  const body = await readBody(res);
  if (!res.ok) {
    throw new Error(
      `Moove create payment-link failed (${res.status}): ${JSON.stringify(body)}`
    );
  }
  return parsePaymentLink(body);
}

export async function getPaymentLink(id: string, apiKey: string): Promise<PaymentLink> {
  const { apiBaseUrl } = config();
  const res = await fetch(`${apiBaseUrl}${GET_PATH}/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: headers(apiKey),
  });
  const body = await readBody(res);
  if (!res.ok) {
    throw new Error(
      `Moove get payment-link failed (${res.status}): ${JSON.stringify(body)}`
    );
  }
  return parsePaymentLink(body);
}

/** A link is considered paid only when Moove reports it completed. */
export function isCompleted(status: string): boolean {
  return String(status).toLowerCase() === "completed";
}
