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
  const hostHandle = pot.hostHandle ?? "@ckay";

  return (
    <div>
      <h1 className="board-title">{pot.title}</h1>
      <p className="sub">
        Total {pot.totalAmount} {pot.currencyNote} · Money goes to the host ({hostHandle})
      </p>
      <p className="progress">
        {paidCount} of {pot.participants.length} paid
      </p>
      {complete ? (
        <p
          style={{
            fontWeight: 700,
            color: "#9adbc4",
            background: "rgba(47,111,100,.35)",
            borderRadius: 14,
            padding: "14px 18px",
          }}
        >
          Pot complete
        </p>
      ) : null}

      <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
        {pot.participants.map((p) => {
          const paid = p.status === "paid";
          return (
            <li key={p.id} className={`row ${paid ? "paid" : ""}`}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{p.name}</p>
                <p className="sub" style={{ margin: 0 }}>
                  <span className="amt">{p.shareAmount}</span> {pot.currencyNote} ·{" "}
                  {paid ? "paid" : "unpaid"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {paid ? (
                  <span className="btn" style={{ background: "var(--teal)", color: "#eafff7" }}>
                    Paid
                  </span>
                ) : p.moovePayUrl ? (
                  <a
                    href={p.moovePayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-gold"
                  >
                    Pay
                  </a>
                ) : (
                  <span className="sub">no link</span>
                )}
                <a
                  href={`/pots/${pot.id}/p/${p.id}`}
                  style={{ color: "var(--gold)", fontSize: ".92rem" }}
                >
                  Proof
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="sub" style={{ marginTop: 20 }}>
        This board refreshes every 3 seconds straight from Moove.
      </p>
    </div>
  );
}
