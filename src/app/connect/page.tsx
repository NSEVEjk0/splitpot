"use client";

import { useState } from "react";

export default function ConnectPage() {
  const [handle, setHandle] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<{ handle: string; keyLast4: string } | null>(
    null
  );

  async function onConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/host/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, apiKey }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || `Could not connect (${res.status}).`);
      } else {
        setConnected({ handle: body.handle, keyLast4: body.keyLast4 });
        setApiKey("");
      }
    } catch {
      setError("Network error while connecting.");
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await fetch("/api/host/logout", { method: "POST" });
    setConnected(null);
  }

  return (
    <div>
      <p className="kicker">Host setup</p>
      <h1>Connect your Moove account</h1>
      <p className="lead">
        Paste your Moove Handle and your Receive API key. Pots you create will
        settle to your Handle, and each payment link is created with your key.
      </p>

      <form onSubmit={onConnect} style={{ maxWidth: "30rem", marginTop: 28 }}>
        <label htmlFor="handle">Moove Handle</label>
        <input
          id="handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@yourhandle"
          required
        />

        <label htmlFor="apikey">Moove Receive API key</label>
        <input
          id="apikey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="mk_..."
          autoComplete="off"
          required
        />
        <p className="sub" style={{ marginTop: 6 }}>
          Your key is encrypted before it is stored and is never shown again —
          only its last 4 characters.
        </p>

        {error ? (
          <p style={{ color: "#e11d48", marginTop: 12 }} role="alert">
            {error}
          </p>
        ) : null}

        <div style={{ marginTop: 18 }}>
          <button type="submit" className="btn-gold" disabled={busy}>
            {busy ? "Connecting…" : "Connect"}
          </button>
        </div>
      </form>

      {connected ? (
        <div className="card" style={{ maxWidth: "30rem", marginTop: 24 }}>
          <h2>Connected as {connected.handle}</h2>
          <p>
            API key ending in <span className="amt">…{connected.keyLast4}</span>. Pots
            you create now settle to {connected.handle}.
          </p>
          <p>
            <button className="btn-terra" onClick={onLogout}>
              Disconnect
            </button>
          </p>
        </div>
      ) : null}
    </div>
  );
}
