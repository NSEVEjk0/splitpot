import { notFound } from "next/navigation";
import { getPotWithParticipants } from "@/lib/store";
import Board from "./Board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PotPage({ params }: { params: { potId: string } }) {
  const pot = await getPotWithParticipants(params.potId);
  if (!pot) notFound();
  return <Board initialPot={pot} />;
}
