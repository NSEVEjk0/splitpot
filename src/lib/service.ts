import { randomUUID } from "node:crypto";
import { config } from "./config";
import { createPaymentLink, getPaymentLink, isCompleted } from "./moove";
import { normalizeAmount, splitEvenly } from "./split";
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

export interface CreatePotInput {
  title: string;
  total: string;
  names: string[];
}

function genPotId(): string {
  return "pot_" + randomUUID().replace(/-/g, "").slice(0, 12);
}

function genParticipantId(): string {
  return "p_" + randomUUID().replace(/-/g, "").slice(0, 12);
}

function cleanNames(names: unknown): string[] {
  if (!Array.isArray(names)) {
    throw new ValidationError("names must be an array");
  }
  const cleaned = names
    .map((n) => (typeof n === "string" ? n.trim() : ""))
    .filter((n) => n.length > 0);
  return cleaned;
}

export async function createPot(input: CreatePotInput): Promise<PotWithParticipants> {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    throw new ValidationError("Title is required");
  }

  let total: string;
  try {
    total = normalizeAmount(input.total);
  } catch {
    throw new ValidationError("Total must be a positive decimal amount");
  }
  if (Number(total) <= 0) {
    throw new ValidationError("Total must be greater than zero");
  }

  const names = cleanNames(input.names);
  if (names.length < 2 || names.length > 12) {
    throw new ValidationError("A pot needs between 2 and 12 people");
  }

  const shares = splitEvenly(total, names.length);
  const potId = genPotId();
  const createdAt = new Date().toISOString();

  const pot: Pot = {
    id: potId,
    title,
    totalAmount: total,
    currencyNote: CURRENCY_NOTE,
    status: "open",
    createdAt,
  };

  // Create one one-time Moove payment link per participant.
  const participants: Participant[] = [];
  for (let i = 0; i < names.length; i++) {
    const participantId = genParticipantId();
    const share = shares[i];
    const link = await createPaymentLink({
      toAmount: share,
      description: `splitpot:${potId}:${participantId}`,
      maxUsage: 1,
    });
    participants.push({
      id: participantId,
      potId,
      name: names[i],
      shareAmount: share,
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

/**
 * Refresh every unpaid participant's link from Moove, persist any that have
 * completed, and mark the pot complete once all participants are paid.
 */
export async function refreshPotStatus(
  potId: string
): Promise<PotWithParticipants | null> {
  const pot = await getPotWithParticipants(potId);
  if (!pot) return null;

  for (const p of pot.participants) {
    if (p.status === "paid" || !p.mooveLinkId) continue;
    try {
      const link = await getPaymentLink(p.mooveLinkId);
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

  return {
    paid: participant.status === "paid",
    amounts: {
      share: participant.shareAmount,
      total: pot.totalAmount,
      currencyNote: pot.currencyNote,
    },
    mooveLinkId: participant.mooveLinkId,
    handle: config().handle,
    completedAt: participant.completedAt,
    name: participant.name,
    potTitle: pot.title,
  };
}

export { getPotWithParticipants };
