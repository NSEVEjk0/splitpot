import type { Row } from "@libsql/client";
import { getDb, ensureSchema } from "./db";
import type {
  Participant,
  ParticipantStatus,
  Pot,
  PotStatus,
  PotWithParticipants,
} from "./types";

function rowToPot(r: Row): Pot {
  return {
    id: String(r.id),
    title: String(r.title),
    totalAmount: String(r.total_amount),
    currencyNote: String(r.currency_note),
    status: String(r.status) as PotStatus,
    createdAt: String(r.created_at),
  };
}

function rowToParticipant(r: Row): Participant {
  return {
    id: String(r.id),
    potId: String(r.pot_id),
    name: String(r.name),
    shareAmount: String(r.share_amount),
    mooveLinkId: r.moove_link_id == null ? null : String(r.moove_link_id),
    moovePayUrl: r.moove_pay_url == null ? null : String(r.moove_pay_url),
    status: String(r.status) as ParticipantStatus,
    completedAt: r.completed_at == null ? null : String(r.completed_at),
    rawMooveJson: r.raw_moove_json == null ? null : String(r.raw_moove_json),
    position: Number(r.position),
  };
}

export async function insertPotWithParticipants(
  pot: Pot,
  participants: Participant[]
): Promise<void> {
  await ensureSchema();
  const db = getDb();
  const stmts = [
    {
      sql: `INSERT INTO pots (id, title, total_amount, currency_note, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        pot.id,
        pot.title,
        pot.totalAmount,
        pot.currencyNote,
        pot.status,
        pot.createdAt,
      ],
    },
    ...participants.map((p) => ({
      sql: `INSERT INTO participants
            (id, pot_id, name, share_amount, moove_link_id, moove_pay_url, status, completed_at, raw_moove_json, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        p.id,
        p.potId,
        p.name,
        p.shareAmount,
        p.mooveLinkId,
        p.moovePayUrl,
        p.status,
        p.completedAt,
        p.rawMooveJson,
        p.position,
      ],
    })),
  ];
  await db.batch(stmts, "write");
}

export async function getPotWithParticipants(
  potId: string
): Promise<PotWithParticipants | null> {
  await ensureSchema();
  const db = getDb();
  const potRes = await db.execute({
    sql: `SELECT * FROM pots WHERE id = ?`,
    args: [potId],
  });
  if (potRes.rows.length === 0) return null;
  const pot = rowToPot(potRes.rows[0]);
  const partRes = await db.execute({
    sql: `SELECT * FROM participants WHERE pot_id = ? ORDER BY position ASC`,
    args: [potId],
  });
  return { ...pot, participants: partRes.rows.map(rowToParticipant) };
}

export async function getParticipant(
  potId: string,
  participantId: string
): Promise<Participant | null> {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT * FROM participants WHERE id = ? AND pot_id = ?`,
    args: [participantId, potId],
  });
  if (res.rows.length === 0) return null;
  return rowToParticipant(res.rows[0]);
}

export async function markParticipantPaid(
  participantId: string,
  completedAt: string,
  rawMooveJson: string
): Promise<void> {
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `UPDATE participants
          SET status = 'paid', completed_at = ?, raw_moove_json = ?
          WHERE id = ?`,
    args: [completedAt, rawMooveJson, participantId],
  });
}

export async function updateParticipantRaw(
  participantId: string,
  rawMooveJson: string
): Promise<void> {
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `UPDATE participants SET raw_moove_json = ? WHERE id = ?`,
    args: [rawMooveJson, participantId],
  });
}

export async function setPotStatus(
  potId: string,
  status: PotStatus
): Promise<void> {
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `UPDATE pots SET status = ? WHERE id = ?`,
    args: [status, potId],
  });
}

// Testing hook: wipe all rows.
export async function __resetStoreForTests(): Promise<void> {
  await ensureSchema();
  const db = getDb();
  await db.execute(`DELETE FROM participants`);
  await db.execute(`DELETE FROM pots`);
}
