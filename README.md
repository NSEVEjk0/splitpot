# Splitpot

**Split any bill. Each person pays in any token on any chain. It settles to @ckay on Moove.**

Splitpot turns one shared bill into one payment link per person. The host enters a
title, a total, and 2–12 first names. Splitpot divides the total evenly to the cent,
creates a separate one-time payment link for each person through **Moove Agentic
Payments**, and publishes a public board. Each payer opens their own link, pays with
whatever token on whatever chain they already hold, and the board turns their row
green the moment Moove reports the link completed. When every link is complete, the
board reads **Pot complete**.

Splitpot does not move money. Moove does. Splitpot creates payment links and reads
their completion status.

- Moove Handle: [@ckay](https://www.moove.xyz/@ckay)
- X: [https://x.com/CRYPTFRANI](https://x.com/CRYPTFRANI)

Built by @ckay · https://x.com/CRYPTFRANI

---

## Why Moove Agentic Payments

Splitting a bill across a group is a coordination problem, and crypto makes it worse:
everybody holds a different token on a different chain, and the person fronting the
bill ends up chasing people, reconciling transfers by hand, and eating the difference
on whatever arrived in the wrong asset.

The Moove **Receive Agent** removes all of that. One API call produces a hosted
checkout link for an exact amount in the recipient's settlement token. The payer
brings any token on any chain; Moove handles the conversion and the settlement, and
the funds land on the recipient's Moove Handle. The link reports its own status, so
software can watch for completion instead of asking people for screenshots.

That is the whole basis of this product:

| Splitpot needs | Moove provides |
| --- | --- |
| An exact amount owed by one specific person | `toAmount` on a payment link, in the settlement token |
| A link that can only be paid once | `maxUsage: 1` |
| A way to tie a payment back to a row in our board | `description`, which carries our own pot and participant id |
| Truth about whether that person actually paid | `status === "completed"` and `completedAt` |
| Money that arrives in one asset, on one account | Moove settlement to the `@ckay` Handle |

Splitpot uses exactly one Moove surface — the Receive Agent. No send, swap, or ramp
agents, no wallets, no custody, no bridges, no token of its own.

## How it works

1. The host opens `/`, enters a title, a total, and 2–12 first names, and submits with
   the host token.
2. Splitpot converts the total to integer cents and splits it evenly. The last share
   absorbs the remainder, so the shares always sum back to the total exactly —
   `80.00` across 3 people is `26.66 + 26.66 + 26.68`, never `79.98`.
3. For each person, Splitpot calls `POST /v1/payment-link` with that person's share as
   `toAmount`, `maxUsage: 1`, and a `description` of `splitpot:<potId>:<participantId>`.
4. The public board at `/pots/<potId>` lists every person, their amount, their status,
   and a **Pay** button pointing at their own Moove link.
5. The board polls `/api/pots/<potId>/status` every 3 seconds. That route re-reads every
   unpaid link from Moove, persists any that completed, and marks the pot complete once
   all of them have.
6. Every payer gets a public proof page at `/pots/<potId>/p/<participantId>` — a
   settlement story in plain language — plus a machine-readable JSON verification
   endpoint.

## Pages and API

| Route | Access | Purpose |
| --- | --- | --- |
| `GET /` | Host token | Create-pot form |
| `GET /pots/[potId]` | Public | The pot board: every person, amount, status, Pay button |
| `GET /pots/[potId]/p/[participantId]` | Public | Settlement story / proof page |
| `POST /api/pots` | Host token | Create a pot and one Moove link per person |
| `GET /api/pots/[potId]` | Public | The pot as stored |
| `GET /api/pots/[potId]/status` | Public | Refresh every link from Moove and persist |
| `GET /api/verify/[potId]/[participantId]` | Public | `{ paid, amounts, mooveLinkId, handle, completedAt }` |

`POST /api/pots` accepts the host token as either an `x-admin-token` header or an
`Authorization: Bearer` credential. Everything else on the list is public by design —
the board and the proof pages are meant to be shared.

## Data model

**Pot** — `id`, `title`, `totalAmount`, `currencyNote` (always `"settlement token"`),
`status` (`open` | `complete`), `createdAt`.

**Participant** — `id`, `name`, `shareAmount`, `mooveLinkId`, `moovePayUrl`,
`status` (`unpaid` | `paid`), `completedAt`, `rawMooveJson`.

`rawMooveJson` keeps the last raw Moove response for each participant, so a proof page
can always be reconciled against what the API actually said.

## Setup

### 1. Moove account

1. Create a Moove account and claim a Handle. This project settles to `@ckay`.
2. Set the settlement token on the account. Every `toAmount` Splitpot sends is
   denominated in that token, which is why the UI says "settlement token" rather than
   naming a currency.
3. Generate a Receive Agent API key from the Moove dashboard. It is sent as the
   `X-API-Key` header on every request.

### 2. Environment

Copy `.env.example` and fill it in. Splitpot reads `~/.proofgate.env` first, then
`.env.local`, and never overrides variables already present in the environment — so
values set in a hosting dashboard always win.

| Variable | Required | Notes |
| --- | --- | --- |
| `MOOVE_API_KEY` | yes | Receive Agent API key. Secret. |
| `MOOVE_API_BASE_URL` | no | Defaults to `https://api.moove.xyz` |
| `MOOVE_HANDLE` | no | Defaults to `@ckay` |
| `ADMIN_TOKEN` | yes | Gates pot creation. Secret. |
| `TURSO_DATABASE_URL` | no | Hosted SQLite. Omit for a local file DB. |
| `TURSO_AUTH_TOKEN` | no | Required if `TURSO_DATABASE_URL` is set. |

### 3. Run locally

```bash
npm install
npm test          # unit + route tests, no network
npm run dev       # http://localhost:3000
```

Storage resolves in this order: `SPLITPOT_DB_URL` (tests), then
`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`, then a local `file:splitpot.db`. One
client library covers all three, so local and hosted behave identically.

To check the live Moove integration without touching the app:

```bash
npm run smoke     # creates 2 one-time links at 1.00 each and reads them back
```

The smoke script prints PASS or FAIL and never prints the API key. The links it
creates are single-use and unpaid; they can be ignored.

### 4. Deploy

The app deploys to Vercel as-is. Set these environment variables in the Vercel
dashboard (names only — never pass secrets on the command line):

- `MOOVE_API_KEY`
- `ADMIN_TOKEN`
- `MOOVE_API_BASE_URL` (optional)
- `MOOVE_HANDLE` (optional)
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (recommended in production, so pots
  survive redeploys)

On Vercel's free tier the filesystem is ephemeral, so a local file DB will not persist
between deployments. Point the app at Turso for anything beyond a demo.

## Demo script

Two minutes, for a review call:

1. Open `/`. Create a pot: **"Dinner at Kalu's"**, total **80.00**, three names —
   Ada, Chidi, Zara. Submit.
2. Land on the public board. Point out the split: `26.66 / 26.66 / 26.68`. It sums to
   `80.00` exactly, and the last share carries the odd cent.
3. Note that each row has its own Pay button. These are three separate one-time Moove
   links, not one shared link.
4. Open Ada's Pay link in a new tab and complete it with any token on any chain.
5. Return to the board without touching it. Within three seconds Ada's row turns
   green and reads **paid**.
6. Click **Proof** on Ada's row. Read the settlement story, then open **Verify as
   JSON** to show the same fact machine-readably: `paid`, the amounts, the Moove link
   id, the handle, and `completedAt`.
7. Complete the remaining two links. The board heading changes to **Pot complete**.

## Tests

`npm test` covers:

1. The split is exact — the last share absorbs the remainder and shares always sum to
   the total.
2. `POST /api/pots` returns 401 without the host token and 201 with it.
3. Creating a pot issues exactly one Moove link per participant, each with
   `maxUsage: 1` and that participant's amount.
4. The status route marks a row paid when Moove reports `completed`, and marks the pot
   complete when every row is paid.
5. The verify endpoint returns the documented payload for both unpaid and paid
   participants.
6. The Moove handle and the X link are present in the site header and footer, which
   render on every page.

All tests mock the Moove API and use an in-memory database, so the suite runs without
network access or credentials.

## Roadmap

- **Live demo** — a deployed URL with a real pot that a reviewer can pay into.
- **10 completed links across 3 pots** — evidence the flow works repeatedly, not once.
- **5 unique payers** — evidence it works for people who are not the host.
- **Open repository** — this repo, public, with the full integration readable.

Beyond v0: recurring pots for rent and subscriptions, a host dashboard across pots,
reminder links for unpaid rows, and optional per-person custom amounts for bills that
are not split evenly.

## License

MIT
