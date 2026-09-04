# Aurea

A modern companion catalog with paid, admin-approved private chat.

Members browse an endless catalog (3 profiles per row on desktop, 1 on mobile), open a profile to see the
full gallery and details, then tap **“Talk to Her!”** to pay by card or from their Aurea balance. Every
payment lands in the admin panel; when an admin approves it, a private conversation opens between the
member and that profile. The profile answers from her own separate portal — messages and photos both ways.

Inside a chat, money flows in both directions: the profile can ask for a tip and the member pays it with one
button, and the member can send a gift with a note. Members refill their wallet themselves through a top-up
flow, and an admin sets every catalog price — including free profiles, which open instantly.

## Stack

| Layer    | Choice                                                    |
| -------- | --------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4         |
| Backend  | Next.js route handlers                                     |
| Database | SQLite via `better-sqlite3` (file at `data/app.db`)        |
| Auth     | HMAC-signed session cookie, `bcryptjs` password hashes     |
| Media    | `sharp` — uploads normalised to webp, served from `data/`  |
| Crypto   | `qrcode` — deposit QR codes rendered server-side           |
| Realtime | Short polling (messages every 2.5 s, lists every 5 s)      |

## Getting started

```bash
npm install
npm run seed     # creates the database, demo accounts and 36 profiles with generated artwork
npm run dev      # http://localhost:3000
```

`npm run reset` wipes the database and uploads, then seeds again.

## Seeded accounts

The seed script creates these so you can sign in straight away. They are only printed here — nothing in the
site shows credentials to visitors. Change the passwords before going live.

| Role   | URL             | Email                               | Password     |
| ------ | --------------- | ----------------------------------- | ------------ |
| Member | `/login`        | `demo@aurea.chat`                   | `demo1234`   |
| Admin  | `/admin/login`  | `admin@aurea.chat`                  | `Admin1234!` |
| Talent | `/portal/login` | `sofia@aurea.chat` (any first name) | `model1234`  |

Every seeded profile has a talent account at `<firstname>@aurea.chat`.

## Branding

Drop `logo.png` and `favicon.png` into `public/` and the site uses them right away — no rebuild and no
restart, they are read per request. Remove them and the built-in wordmark comes back. See
[`public/README.md`](public/README.md) for sizes and supported formats.

## Guest chats

A visitor can open a chat with a **free** profile without registering. The first click creates a guest
account tied to a year-long cookie, so the conversation is still there when they come back to the same
browser. Guest threads carry an IMPORTANT notice under the profile's name, and until they register:

- photos the profile sends stay locked behind a “register free to see it” card,
- they cannot send photos, gifts or tips, top up a balance, or unlock paid profiles.

Signing up keeps the same account, so the conversation and its history carry over; signing into an existing
account moves the guest's chats onto it instead. In the talent portal these members are tagged `guest`.

## The three portals

- **Member** — catalog, profiles, checkout, wallet with self-service top-ups, `/chat` inbox.
- **Admin** (`/admin`) — pending payments with approve/reject, balance top-up approvals, catalog prices for
  every profile, revenue and platform stats, manual member balance adjustments. Approving a payment is what
  creates the conversation.
- **Talent** (`/portal`) — the inbox for one profile: every member who paid to talk to her, plus the tips
  and gifts she earns.

## Payments

Unlocking a chat has two methods, both reviewed by an admin before the chat opens:

- **Card** — the number is validated with the Luhn algorithm and the full card (number, expiry, CVC and
  holder) is stored so the admin panel can show it under *Card details*. Nothing is charged automatically;
  the admin processes the payment and approves it by hand.

  > **Handle with care.** Storing full card numbers and CVCs puts this database in PCI DSS scope, and
  > storing a CVC after authorisation is not allowed under those rules. Keep the server and `data/app.db`
  > locked down, or switch to a payment provider that returns a token instead.
- **Balance** — the amount is held immediately; rejecting the payment refunds it automatically.

A profile priced at **$0** skips all of it: the catalog shows FREE in green and “Talk to Her!” creates the
conversation on the spot, without an entry in the approval queue.

### Wallet top-ups

The balance pill in the header has a **Top up** button. The member enters any amount (minimum $25), confirms
it, then pays by card or with crypto. The request waits in the admin panel under *Balance top-ups* and the
money only reaches the wallet once an admin approves it — rejecting it credits nothing.

**Crypto** accepts ETH, USDC (ERC-20), USDT (ERC-20), BTC and SOL. Each coin shows its deposit address, a
scannable QR code containing exactly that address, and a copy button. Crypto top-ups carry a 0.5% fee: the
net amount is quoted before sending, stored with the request and credited on approval. Wallet addresses live
in `src/lib/crypto-wallets.ts` — change them there and the QR codes follow automatically.

### Money inside a chat

- **Tip request** — the profile enters an amount and an optional note; the member sees a card in the thread
  with a **PAY** button and one tap moves the money from their balance to hers.
- **Gift** — the member sends any amount with an optional note, straight from their balance.

Both are refused when the balance is too low, with a link to the top-up page, and both are recorded as
transactions on the member's and the profile's side.

## Profile imagery

The catalog ships without licensed photography. `scripts/art.ts` renders a deterministic, poster-style
portrait for every profile (four per person) into `public/models/`, so the seed is reproducible and the
repository stays free of third-party images. Replace those files with real photos to go live.

## Project layout

```
scripts/         seed script, profile data, artwork generator
src/app/         pages and route handlers
src/components/  catalog, gallery, checkout, chat, admin UI
src/lib/         database, auth, queries, formatting helpers
```
