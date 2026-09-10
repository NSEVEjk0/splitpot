"use client";

import { useEffect, useState } from "react";
import type { PotWithParticipants } from "@/lib/types";

const POLL_MS = 3000;

export default function Board({ initialPot }: { initialPot: PotWithParticipants }) {
  const [pot, setPot] = useState<PotWithParticipants>(initialPot);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/pots/${initialPot.id}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const next = (await res.json()) as PotWithParticipants;
        if (!cancelled && next && Array.isArray(next.participants)) {
          setPot(next);
        }
      } catch {
        // transient: keep the last known state and try again on the next tick
      }
    }

    const timer = setInterval(poll, POLL_MS);
    poll();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [initialPot.id]);

  const paidCount = pot.participants.filter((p) => p.status === "paid").length;
  const complete = pot.status === "complete";

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{pot.title}</h1>
        <p className="text-neutral-600">
          Total {pot.totalAmount} {pot.currencyNote} · {paidCount} of{" "}
          {pot.participants.length} paid
        </p>
      </section>

      {complete ? (
        <p className="rounded-lg bg-green-100 px-4 py-3 text-lg font-semibold text-green-900">
          Pot complete
        </p>
      ) : null}

      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {pot.participants.map((p) => {
          const paid = p.status === "paid";
          return (
            <li
              key={p.id}
              className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                paid ? "bg-green-50" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-neutral-600">
                  {p.shareAmount} {pot.currencyNote} ·{" "}
                  <span className={paid ? "font-medium text-green-700" : "text-neutral-500"}>
                    {paid ? "paid" : "unpaid"}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {paid ? (
                  <span className="rounded-full bg-green-600 px-3 py-1 font-medium text-white">
                    Paid
                  </span>
                ) : p.moovePayUrl ? (
                  <a
                    href={p.moovePayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white"
                  >
                    Pay
                  </a>
                ) : (
                  <span className="text-neutral-400">no link</span>
                )}
                <a
                  href={`/pots/${pot.id}/p/${p.id}`}
                  className="text-neutral-600 underline hover:text-neutral-900"
                >
                  Proof
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-neutral-500">
        This board refreshes every 3 seconds straight from Moove.
      </p>
    </div>
  );
}
