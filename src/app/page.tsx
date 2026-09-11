"use client";
import { HomeIntro } from "@/components/HomeIntro";

import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";

const MIN_PEOPLE = 2;
const MAX_PEOPLE = 12;

interface Row {
  name: string;
  amount: string;
}

function emptyRow(): Row {
  return { name: "", amount: "" };
}

function sumRows(rows: Row[]): string {
  let cents = 0;
  for (const r of rows) {
    const s = r.amount.trim();
    if (!s) continue;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) continue;
    const [whole, frac = ""] = s.split(".");
    cents += parseInt(whole, 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
  }
  const whole = Math.floor(cents / 100);
  const frac = cents % 100;
  return `${whole}.${String(frac).padStart(2, "0")}`;
}

export default function HomePage() {
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);
  const [evenAmount, setEvenAmount] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [host, setHost] = useState<{ handle: string; keyLast4: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/host/me")
      .then((r) => r.json())
      .then((b) => setHost(b?.host ?? null))
      .catch(() => setHost(null));
  }, []);

  const filled = rows.filter((r) => r.name.trim().length > 0);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function applySameForEveryone() {
    const s = evenAmount.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return;
    setRows((prev) => prev.map(() => ({ name: "", amount: s })));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const people = rows
      .map((r) => ({ name: r.name.trim(), amount: r.amount.trim() }))
      .filter((r) => r.name.length > 0 || r.amount.length > 0);

    if (people.length < MIN_PEOPLE || people.length > MAX_PEOPLE) {
      setError(`Add between ${MIN_PEOPLE} and ${MAX_PEOPLE} people.`);
      return;
    }
    if (people.some((p) => !p.name || !p.amount)) {
      setError("Every person needs a name and an amount.");
      return;
    }
    if (people.some((p) => !/^\d+(\.\d{1,2})?$/.test(p.amount) || Number(p.amount) <= 0)) {
      setError("Each amount must be a positive number with at most 2 decimals.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/pots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(host ? {} : { "x-admin-token": adminToken }),
        },
        body: JSON.stringify({ title, people }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || `Could not create the pot (${res.status}).`);
        setBusy(false);
        return;
      }
      window.location.href = `/pots/${body.id}`;
    } catch {
      setError("Network error while creating the pot.");
      setBusy(false);
    }
  }

  return (
    <>
      <HomeIntro />

      <div style={{ marginTop: 48 }}>
        {host ? (
          <p className="sub" style={{ marginBottom: 8 }}>
            Creating as <strong>{host.handle}</strong> — pots settle to your Handle.{" "}
            <a href="/connect">Change host</a>
          </p>
        ) : (
          <p className="sub" style={{ marginBottom: 8 }}>
            Not connected. Pots you create use the default demo host{" "}
            <strong>{BRAND.handle}</strong>.{" "}
            <a href="/connect">Connect your own Moove account</a> to receive payments
            yourself.
          </p>
        )}

        <form onSubmit={onSubmit}>
          <label htmlFor="title">Pot title</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dinner at KFC's"
            required
          />

          <label htmlFor="people">
            People and amounts ({MIN_PEOPLE}–{MAX_PEOPLE})
          </label>
          {rows.map((row, i) => (
            <div
              key={i}
              style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}
            >
              <input
                aria-label={`Name ${i + 1}`}
                value={row.name}
                onChange={(e) => updateRow(i, { name: e.target.value })}
                placeholder={i === 0 ? "Franklin" : "Name"}
                style={{ flex: 1 }}
              />
              <input
                aria-label={`Amount ${i + 1}`}
                value={row.amount}
                onChange={(e) => updateRow(i, { amount: e.target.value })}
                placeholder={i === 0 ? "10.00" : "0.00"}
                inputMode="decimal"
                style={{ flex: "0 0 8.5rem" }}
                className="amt"
              />
              {rows.length > MIN_PEOPLE ? (
                <button
                  type="button"
                  aria-label={`Remove person ${i + 1}`}
                  onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                  style={{ padding: "10px 14px", background: "transparent", color: "var(--mute)" }}
                >
                  ✕
                </button>
              ) : null}
            </div>
          ))}
          {rows.length < MAX_PEOPLE ? (
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
              style={{ background: "transparent", color: "var(--gold)", padding: "8px 0" }}
            >
              + Add person
            </button>
          ) : null}

          <label htmlFor="evensplit">Same amount for everyone (optional)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="evensplit"
              value={evenAmount}
              onChange={(e) => setEvenAmount(e.target.value)}
              placeholder="12.50"
              inputMode="decimal"
              style={{ flex: "0 0 8.5rem" }}
              className="amt"
            />
            <button
              type="button"
              className="btn-terra"
              onClick={applySameForEveryone}
              disabled={!/^\d+(\.\d{1,2})?$/.test(evenAmount.trim())}
            >
              Fill every row
            </button>
          </div>
          <p className="sub" style={{ marginTop: 6 }}>
            Only fills the amount boxes — names stay as you typed them.
          </p>

          <label htmlFor="total">Total (sum of rows)</label>
          <input
            id="total"
            value={sumRows(rows)}
            readOnly
            tabIndex={-1}
            className="amt"
            style={{ opacity: 0.7 }}
          />
          <p className="sub" style={{ marginTop: 6 }}>
            Display only. The total is computed from the rows above.
          </p>

          {!host ? (
            <>
              <label htmlFor="admin">Demo host token</label>
              <input
                id="admin"
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                autoComplete="off"
                required
              />
              <p className="sub" style={{ marginTop: 6 }}>
                Only needed while using the default demo host ({BRAND.handle}).
                Connected hosts do not need a token.
              </p>
            </>
          ) : null}

          {error ? (
            <p style={{ color: "#e11d48", marginTop: 12 }} role="alert">
              {error}
            </p>
          ) : null}

          <div style={{ marginTop: 18 }}>
            <button type="submit" className="btn-gold" disabled={busy}>
              {busy ? "Creating payment links…" : "Create pot"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
