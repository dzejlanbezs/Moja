# Aurea

A modern companion catalog with paid, admin-approved private chat.

Members browse an endless catalog (3 profiles per row on desktop, 1 on mobile), open a profile to see the
full gallery and details, then tap **“Talk to Her!”** to pay by card or from their Aurea balance. Every
payment lands in the admin panel; when an admin approves it, a private conversation opens between the
member and that profile. The profile answers from her own separate portal — messages and photos both ways.

## Stack

| Layer    | Choice                                                    |
| -------- | --------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4         |
| Backend  | Next.js route handlers                                     |
| Database | SQLite via `better-sqlite3` (file at `data/app.db`)        |
| Auth     | HMAC-signed session cookie, `bcryptjs` password hashes     |
| Media    | `sharp` — uploads normalised to webp, served from `data/`  |
| Realtime | Short polling (messages every 2.5 s, lists every 5 s)      |

## Getting started

```bash
npm install
npm run seed     # creates the database, demo accounts and 36 profiles with generated artwork
npm run dev      # http://localhost:3000
```

`npm run reset` wipes the database and uploads, then seeds again.

## Demo accounts

| Role   | URL             | Email                              | Password     |
| ------ | --------------- | ---------------------------------- | ------------ |
| Member | `/login`        | `demo@aurea.chat`                  | `demo1234`   |
| Admin  | `/admin/login`  | `admin@aurea.chat`                 | `Admin1234!` |
| Talent | `/portal/login` | `sofia@aurea.chat` (any first name) | `model1234`  |

Every seeded profile has a talent account at `<firstname>@aurea.chat`.

## The three portals

- **Member** — catalog, profiles, checkout, wallet, `/chat` inbox.
- **Admin** (`/admin`) — pending payments with approve/reject, revenue and platform stats, member balance
  top-ups. Approving a payment is what creates the conversation.
- **Talent** (`/portal`) — the inbox for one profile: every member who paid to talk to her.

## Payments

Two methods, both reviewed by an admin before the chat opens:

- **Card** — a demo checkout. The number is validated with the Luhn algorithm and only the brand and last
  four digits are stored. No real charge ever happens and no PAN is persisted.
- **Balance** — the amount is held immediately; rejecting the payment refunds it automatically.

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
