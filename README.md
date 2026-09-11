# Splitpot

Splitpot splits a group bill into **one Moove payment link per person**. Each
friend opens their own link and pays with any crypto they already hold. The
board turns green as each person pays, and says **Pot complete** when everyone
is done.

**Live demo: https://splitpot-mu.vercel.app**

## Who gets the money?

The **host**. A host connects their own Moove account on `/connect` by pasting
their Moove Handle and their Moove Receive API key. Every payment link created
after that settles to that host's Handle, using that host's key.

If nobody is connected, pots run on the default demo host, **@ckay**.

Payers never need a key, an account, or a login. They just open a link and pay.

## Per-person amounts

The host sets the amount **each person** pays — for example Franklin $10 and
Jake $15. There is also a "same amount for everyone" helper that fills every
row with one amount, and a display-only total that shows the sum of the rows.

Amounts are positive decimals with at most 2 decimal places. A pot has between
2 and 12 people.

## How to test it (2 minutes)

1. Open the [live demo](https://splitpot-mu.vercel.app).
2. Either connect your own Moove Receive key on `/connect`, or use the demo
   host token to create a pot as @ckay.
3. Create a pot: title "Dinner", people **Franklin 10.00** and **Jake 15.00**.
4. You land on a public board. Each row has its own **Pay** button — a
   one-time Moove payment link for that person's amount.
5. Open a Pay link and pay with any token on any chain.
6. The board refreshes every 3 seconds. The row turns green within seconds of
   payment, and the pot shows **Pot complete** when all rows are paid.
7. Each person also has a public proof page with a JSON verification link.

## Stack

- **Next.js** (App Router) + TypeScript + custom CSS
- **Turso** (libSQL) for storage — local SQLite file when Turso vars are unset
- **Moove Receive API only**: `POST /v1/payment-link` to create a one-time
  payment link, `GET /v1/payment-link/{id}` to check status. `status ===
  "completed"` means paid.

Splitpot does not move funds. It creates payment links and reads their
completion status. Moove Agentic Payments moves the funds and settles them to
the host's Handle.

### Honest limit

Splitpot uses the **Receive** agent only. Money can only settle to the host
who connected their key (or the demo host @ckay). You **cannot** type an
arbitrary Handle or wallet and send payments to it.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. Copy `.env.example` to `.env.local` and fill
in the values you have.

Environment variable names (values live in your `.env.local` or host platform,
never in git):

| Variable | Purpose |
| --- | --- |
| `MOOVE_API_KEY` | Moove Receive key for the default demo host |
| `MOOVE_API_BASE_URL` | Defaults to `https://api.moove.xyz` |
| `MOOVE_HANDLE` | Defaults to `@ckay` |
| `ADMIN_TOKEN` | Gates pot creation on the demo host |
| `TURSO_DATABASE_URL` | Hosted SQLite (optional; local file if unset) |
| `TURSO_AUTH_TOKEN` | Auth for Turso |
| `HOST_KEY_SECRET` | Encrypts connected hosts' API keys at rest |

Connected hosts paste their key on `/connect`; it is encrypted at rest with
`HOST_KEY_SECRET`, held in an httpOnly session cookie, and never shown again —
only its last 4 characters.

## Tests

```bash
npm test
```

32 tests covering the even-split helper, per-person amounts, the admin gate,
connected-host key usage, board status refresh, verification payloads, host
key encryption, and page branding.

## Links

- Moove Handle: [@ckay](https://www.moove.xyz/@ckay)
- X: [https://x.com/CRYPTFRANI](https://x.com/CRYPTFRANI)
- [Moove on X](https://x.com/moovexyz) · [Use Moove](https://www.moove.xyz)

Built by @ckay · https://x.com/CRYPTFRANI
