export type PotStatus = "open" | "complete";
export type ParticipantStatus = "unpaid" | "paid";

export interface Participant {
  id: string;
  potId: string;
  name: string;
  shareAmount: string;
  mooveLinkId: string | null;
  moovePayUrl: string | null;
  status: ParticipantStatus;
  completedAt: string | null;
  rawMooveJson: string | null;
  position: number;
}

export interface Pot {
  id: string;
  title: string;
  totalAmount: string;
  currencyNote: string;
  status: PotStatus;
  createdAt: string;
  hostId: string | null;
  hostHandle: string | null;
  isDemoHost: boolean;
}

export interface PotWithParticipants extends Pot {
  participants: Participant[];
}
