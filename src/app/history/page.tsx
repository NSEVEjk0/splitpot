"use client";

import { useEffect, useState } from "react";

interface PaymentRow {
  name: string;
  shareAmount: string;
  status: "paid" | "unpaid";
  completedAt: string | null;
  mooveLinkId: string | null;
  txUrl: string | null;
}

interface PotRow {
  id: string;
  title: string;
  totalAmount: string;
  currencyNote: string;
  status: string;
  createdAt: string;
  paidCount: number;
  participants: PaymentRow[];
}

interface History {
  handle: string;
  keyLast4: string;
  pots: PotRow[];
  stats: {
    pots: number;
    completedPots: number;
    paymentsPaid: number;
    paymentsUnpaid: number;
    amountReceived: string;
    amountOutstanding: string;
  };
}

export default function HistoryPage() {
  const [history, setHistory] = useState<History | null>(null);
  const [needsConnect, setNeedsConnect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/host/history")
      .then(async (r) => {
        if (r.status === 401) {
          setNeedsConnect(true);
          return null;
        }
        const body = await r.json();
        if (!r.ok) {
          setError(body?.error || `Could not load history (${r.status}).`);
          return null;
        }
        return body;
      })
      .then((h) => h && setHistory(h))
      .catch(() => setError("Network error while loading history."));
  }, []);

  if (needsConnect) {
    return (
      <div>
        <p className="kicker">History</p>
        <h1>Your transaction history</h1>
        <p className="lead">
          Connect your Moove account to see every pot you have created and the
          outcome of each payment — successful and unsuccessful.
        </p>
        <p style={{ marginTop: 24 }}>
          <a className="btn btn-gold" href="/connect">
            Connect on Moove
          </a>
        </p>
      </div>
    );
  }

  if (error) {
    return <p className="error">{error}</p>;
  }

  if (!history) {
    return <p className="sub" style={{ marginTop: 48 }}>Loading…</p>;
  }

  return (
    <div>
      <p className="kicker">History</p>
      <h1 className="board-title" style={{ marginTop: 0 }}>
        Your transaction history
      </h1>
      <p className="sub">
        Connected as <strong>{history.handle}</strong> · key ending …
        {history.keyLast4}
      </p>

      <div className="cases" style={{ marginTop: 28, marginBottom: 8 }}>
        <div className="card">
          <h2>{history.stats.pots}</h2>
          <p>
            pots created · {history.stats.completedPots} complete
          </p>
        </div>
        <div className="card">
          <h2 className="amt">{history.stats.amountReceived}</h2>
          <p>received across {history.stats.paymentsPaid} successful payments</p>
        </div>
        <div className="card">
          <h2 className="amt">{history.stats.amountOutstanding}</h2>
          <p>outstanding across {history.stats.paymentsUnpaid} unpaid payments</p>
        </div>
      </div>

      {history.pots.length === 0 ? (
        <p className="sub" style={{ marginTop: 32 }}>
          No pots yet. Create one from the home page and it will show up here
          with every payment&apos;s outcome.
        </p>
      ) : (
        history.pots.map((pot) => (
          <div key={pot.id} style={{ marginTop: 36 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontFamily: "var(--display)", fontWeight: 500, margin: 0, fontSize: "1.4rem" }}>
                {pot.title}
              </h2>
              <span className="sub" style={{ fontSize: ".85rem" }}>
                {new Date(pot.createdAt).toISOString().slice(0, 10)} · {pot.paidCount}/
                {pot.participants.length} paid
              </span>
            </div>
            <div style={{ marginTop: 12 }}>
              {pot.participants.map((p, i) => (
                <div key={i} className={`row ${p.status === "paid" ? "paid" : ""}`}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{p.name}</p>
                    <p className="sub" style={{ margin: 0 }}>
                      <span className="amt">{p.shareAmount}</span> {pot.currencyNote} ·{" "}
                      {p.status === "paid" ? "paid" : "unpaid"}
                      {p.completedAt
                        ? ` on ${new Date(p.completedAt).toISOString().slice(0, 16).replace("T", " ")}`
                        : ""}
                    </p>
                  </div>
                  <div style={{ fontSize: ".85rem" }}>
                    {p.txUrl ? (
                      <a href={p.txUrl} target="_blank" rel="noreferrer" style={{ color: "var(--gold)" }}>
                        View transaction
                      </a>
                    ) : p.status === "paid" ? (
                      <span className="sub">receipt pending</span>
                    ) : (
                      <a href={`/pots/${pot.id}`} style={{ color: "var(--gold)" }}>
                        Open board
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
