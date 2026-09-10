"use client";

import { useState } from "react";
import { BRAND } from "@/lib/brand";

const MIN_PEOPLE = 2;
const MAX_PEOPLE = 12;

export default function HomePage() {
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [namesText, setNamesText] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = namesText
    .split(/[\n,]/)
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (names.length < MIN_PEOPLE || names.length > MAX_PEOPLE) {
      setError(`Add between ${MIN_PEOPLE} and ${MAX_PEOPLE} first names.`);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/pots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ title, total, names }),
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
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Start a pot</h1>
        <p className="text-neutral-600">{BRAND.tagline}</p>
      </section>

      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6">
        <div className="space-y-1">
          <label htmlFor="title" className="block text-sm font-medium">
            What is this pot for?
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dinner at Kalu's"
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="total" className="block text-sm font-medium">
            Total amount
          </label>
          <input
            id="total"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="80.00"
            inputMode="decimal"
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
          <p className="text-xs text-neutral-500">
            Denominated in your Moove settlement token.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="names" className="block text-sm font-medium">
            First names ({MIN_PEOPLE}–{MAX_PEOPLE}), one per line
          </label>
          <textarea
            id="names"
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
            rows={6}
            placeholder={"Ada\nChidi\nZara"}
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm"
          />
          <p className="text-xs text-neutral-500">{names.length} added</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="admin" className="block text-sm font-medium">
            Host token
          </label>
          <input
            id="admin"
            type="password"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            autoComplete="off"
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
          <p className="text-xs text-neutral-500">
            Only the host can create pots. Payers never need this.
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-neutral-900 px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Creating payment links…" : "Create pot"}
        </button>
      </form>

      <section className="space-y-2 text-sm text-neutral-600">
        <h2 className="font-medium text-neutral-900">How it works</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Splitpot divides the total evenly, to the cent.</li>
          <li>Each person gets their own one-time Moove payment link.</li>
          <li>They pay in any token on any chain.</li>
          <li>
            Moove settles it to {BRAND.handle}, and the board turns green as each
            link completes.
          </li>
        </ol>
      </section>
    </div>
  );
}
