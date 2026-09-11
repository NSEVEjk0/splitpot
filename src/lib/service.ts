import { randomUUID } from "node:crypto";
import { config } from "./config";
import { hostContextForPot, type HostContext } from "./hosts";
import { createPaymentLink, getPaymentLink, isCompleted } from "./moove";
import { normalizeAmount, toCents, splitEvenly } from "./split";
import {
  getParticipant,
  getPotWithParticipants,
  insertPotWithParticipants,
  markParticipantPaid,
  setPotStatus,
  updateParticipantRaw,
} from "./store";
import type { Participant, Pot, PotWithParticipants } from "./types";

export const CURRENCY_NOTE = "settlement token";

export class ValidationError extends Error {}

export interface PersonInput {
  name: string;
  amount: string;
}

export interface CreatePotInput {
  title: string;
  people: PersonInput[];
  /**
   * Legacy shape (even split of one total) still accepted so the demo path and
   * the "same amount for everyone" helper keep working: { title, total, names }.
   */
  total?: string;
  names?: string[];
}

function genPotId(): string {
  return "pot_" + randomUUID().replace(/-/g, "").slice(0, 12);
}

function genParticipantId(): string {
  return "p_" + randomUUID().replace(/-/g, "").slice(0, 12);
}

function cleanName(n: unknown): string {
  return typeof n === "string" ? n.trim() : "";
}

/**
 * Validate and normalize a per-person amount: positive decimal with at most
 * two fractional digits.
 */
export function validateAmount(amount: unknown): string {
  const s = typeof amount === "string" ? amount.trim() : "";
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new ValidationError("Each amount must be a positive number with at most 2 decimals");
  }
  const normalized = normalizeAmount(s);
  if (toCents(normalized) <= 0) {
    throw new ValidationError("Each amount must be greater than zero");
  }
  return normalized;
}

function resolvePeople(input: CreatePotInput): PersonInput[] {
  if (Array.isArray(input.people) && input.people.length > 0) {
    return input.people.map((p) => ({
      name: cleanName(p?.name),
      amount: p?.amount as unknown as string,
    }));
  }
  // Legacy even-split shape.
  const names = (input.names ?? [])
    .map(cleanName)
    .filter((n: string) => n.length > 0);
  if (names.length === 0 || !input.total) return [];
  const shares = splitEvenly(input.total, names.length);
  return names.map((name: string, i: number) => ({ name, amount: shares[i] }));
}

export async function createPot(
  input: CreatePotInput,
  host: HostContext
): Promise<PotWithParticipants> {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    throw new ValidationError("Title is required");
  }

  if (!host.apiKey) {
    throw new ValidationError("No Moove API key available for this host");
  }

  const people = resolvePeople(input);
  if (people.length < 2 || people.length > 12) {
    throw new ValidationError("A pot needs between 2 and 12 people");
  }

  const cleaned = people.map((p) => ({
    name: p.name,
    amount: validateAmount(p.amount),
  }));
  if (cleaned.some((p) => !p.name)) {
    throw new ValidationError("Every person needs a name");
  }

  const total = fromCentsSafe(
    cleaned.reduce((acc, p) => acc + toCents(p.amount), 0)
  );

  const potId = genPotId();
  const createdAt = new Date().toISOString();

  const pot: Pot = {
    id: potId,
    title,
    totalAmount: total,
    currencyNote: CURRENCY_NOTE,
    status: "open",
    createdAt,
    hostId: host.hostId,
    hostHandle: host.handle,
    isDemoHost: host.isDemoHost,
  };

  // Create one one-time Moove payment link per participant, under the host's key.
  const participants: Participant[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const participantId = genParticipantId();
    const link = await createPaymentLink(
      {
        toAmount: cleaned[i].amount,
        description: `${potId}:${participantId}`,
        maxUsage: 1,
      },
      host.apiKey
    );
    participants.push({
      id: participantId,
      potId,
      name: cleaned[i].name,
      shareAmount: cleaned[i].amount,
      mooveLinkId: link.id || null,
      moovePayUrl: link.url || null,
      status: isCompleted(link.status) ? "paid" : "unpaid",
      completedAt: isCompleted(link.status) ? link.completedAt : null,
      rawMooveJson: JSON.stringify(link.raw ?? null),
      position: i,
    });
  }

  await insertPotWithParticipants(pot, participants);
  return { ...pot, participants };
}

function fromCentsSafe(cents: number): string {
  const whole = Math.floor(cents / 100);
  const frac = cents % 100;
  return `${whole}.${String(frac).padStart(2, "0")}`;
}

/**
 * Refresh every unpaid participant's link from Moove, persist any that have
 * completed, and mark the pot complete once all participants are paid.
 * Uses the Moove key of whichever host owns the pot.
 */
export async function refreshPotStatus(
  potId: string
): Promise<PotWithParticipants | null> {
  const pot = await getPotWithParticipants(potId);
  if (!pot) return null;

  const host = await hostContextForPot(pot.hostId);
  if (!host.apiKey) return pot;

  for (const p of pot.participants) {
    if (p.status === "paid" || !p.mooveLinkId) continue;
    try {
      const link = await getPaymentLink(p.mooveLinkId, host.apiKey);
      if (isCompleted(link.status)) {
        const completedAt = link.completedAt ?? new Date().toISOString();
        await markParticipantPaid(p.id, completedAt, JSON.stringify(link.raw ?? null));
        p.status = "paid";
        p.completedAt = completedAt;
        p.rawMooveJson = JSON.stringify(link.raw ?? null);
      } else {
        await updateParticipantRaw(p.id, JSON.stringify(link.raw ?? null));
        p.rawMooveJson = JSON.stringify(link.raw ?? null);
      }
    } catch {
      // Leave this participant unchanged on a transient Moove error.
    }
  }

  const allPaid = pot.participants.every((p) => p.status === "paid");
  if (allPaid && pot.status !== "complete") {
    await setPotStatus(potId, "complete");
    pot.status = "complete";
  }

  return pot;
}

export interface VerifyResult {
  paid: boolean;
  amounts: { share: string; total: string; currencyNote: string };
  mooveLinkId: string | null;
  handle: string;
  completedAt: string | null;
  name: string;
  potTitle: string;
}

export async function verify(
  potId: string,
  participantId: string
): Promise<VerifyResult | null> {
  const pot = await getPotWithParticipants(potId);
  if (!pot) return null;
  const participant =
    pot.participants.find((p) => p.id === participantId) ??
    (await getParticipant(potId, participantId));
  if (!participant) return null;

  // The settlement handle is whichever host owns the pot, falling back to env.
  const handle = pot.hostHandle ?? config().handle;

  return {
    paid: participant.status === "paid",
    amounts: {
      share: participant.shareAmount,
      total: pot.totalAmount,
      currencyNote: pot.currencyNote,
    },
    mooveLinkId: participant.mooveLinkId,
    handle,
    completedAt: participant.completedAt,
    name: participant.name,
    potTitle: pot.title,
  };
}

export { getPotWithParticipants };
