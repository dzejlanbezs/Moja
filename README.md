# Dicey — casino front-end + accounts backend

A dependency-free casino site: lobby, VIP club, races, promotions, a live prematch
sportsbook, cashier, ten playable in-browser originals, real player accounts and an
admin dashboard.

It runs in two modes.

| | Demo mode | Server mode |
| --- | --- | --- |
| How | open `index.html` directly | `node server.js`, then open the printed URL |
| Wallet | play money in `localStorage` | real per-account balance stored server side |
| Accounts | none | register / log in, sessions, referral codes |
| Cashier | instant play money | deposit and withdrawal requests an admin resolves |
| Admin | — | dashboard with every player, round, request and IP |

## Run it

**Demo mode** — unzip and open `index.html`. Nothing to install.

**Server mode** — needs [Node.js](https://nodejs.org) 18 or newer. The first run also sets
the admin password:

```bash
node server.js --admin-password "your admin password"
# afterwards just:
node server.js
```

Then open <http://localhost:3000>. Use `PORT=8080 node server.js` for a different port.

The admin account is `infektorr234@gmail.com` by default; change it with
`DICEY_ADMIN_EMAIL=you@example.com`. If you start the server without ever setting a
password, one is generated and written to `data/admin-password.txt`.

Everything lives in `data/db.json` (git-ignored). Delete that folder to start over.
Passwords are stored as scrypt hashes with a per-user salt, never in plain text.

## Accounts

Register asks for an email, a password (8+ characters) and an optional code. That one
field takes either another player's **referral code** or one of **your promo codes**.
New accounts start at **$0.00**.

Accounts are permanent: the record, the balance, the bet history and the login all stay in
`data/db.json` until you delete them, and the session cookie is good for ten years, so a
returning player is still signed in.

### Promo codes and the deposit bonus

`DXDXDA` and `FGASDK` out of the box, changeable with
`DICEY_PROMO_CODES="CODE1,CODE2"`. Anyone who signs up with one sees the yellow
**100% Sports Bonus** panel on the deposit page ("Receive 100% First Deposit Bonus as
Free Bet!" / "No Wager Requirement"), their promo code shows in the admin player table,
and their first deposit is tagged with the bonus so you know to hand it out. The panel
disappears once that first deposit is credited.

Granting the free bet itself is a manual step — use the balance field in the admin player
panel. There is no separate bonus-balance wallet yet.

## VIP ranks

Rank follows lifetime amount wagered and moves on its own as the player bets. The
progress bar, the topbar chip, the profile badge and the admin table all read from it.

| Rank | Wagered | Weekly cashback |
| --- | --- | --- |
| Bronze | $0 – $10,000 | 5% |
| Silver | $10,001 – $50,000 | 10% |
| Gold | $50,001 – $200,000 | 15% |
| Platinum | $200,001 – $1,000,000 | 20% |
| Diamond | $1,000,001 – $10,000,000 | 25% |
| Legend | $10,000,001+ | 30% |

Cashback and perks are advertising copy — nothing pays them out automatically.

## Rewards

A gold gift button in the topbar opens the bonus panel. Everything accrues on the server
as bets are placed, so nothing has to be recalculated from the bet log.

| Bonus | Formula | When it can be collected |
| --- | --- | --- |
| Rakeback | 0.05% of wagered | any time |
| Daily | 0.10% of wagered + 1% lossback | once per day, window runs 02:00 → 02:00 |
| Weekly | 0.20% of wagered + 3% lossback | Sundays after 02:00, window runs Monday → Sunday |
| Monthly | 1.00% of wagered + 15% lossback | on the 1st after 02:00, for the month that just ended |

"Lossback" is the net loss inside that window, so a player who came out ahead only gets
the wagered part. The rates live in `REWARD_RATES` at the top of `server.js`.

The 02:00 boundary follows `DICEY_TZ_OFFSET` (default `2`, i.e. Serbian summer time). Set
it to your own UTC offset so the day rolls over at the right moment.

Only rakeback shows a figure. Daily, weekly and monthly sit behind a padlock until they
can be opened, and their amounts never reach the browser at all — the API leaves the
numbers out rather than hiding them in the page.

### Promo free bet

A player who signed up with one of your promo codes earns a free sports bet worth 100% of
their **first deposit** the moment it credits. The Sports icon in the rail starts glowing
gold, and clicking it explains the offer: the amount, allowed odds of 1.50–5.00 and no
wager requirement. Cap it with `DICEY_FREEBET_MAX` if you want an upper limit. Settling
the bet is manual, since the sportsbook is still a preview.

## Sportsbook

Prematch fixtures and odds come live from the bet365 feed via
[b365api](https://b365api.com). Put your token in **`data/b365-token.txt`** (git-ignored)
or the `DICEY_B365_TOKEN` environment variable; without it the Sports page says so plainly
instead of showing filler.

* 28 sports, `sport_id`s as published by the provider
* `/v1/bet365/upcoming` gives the fixture list, `/v4/bet365/prematch` the markets
* `sports.js` flattens bet365's nested payload (`main`, `goals`, `half`, `asian_lines`,
  `others`, per-period groups, plus the reduced `schedule` shape) into plain markets with
  readable selections — "Feyenoord (W) -1.0" rather than `header: 1, handicap: -1.0`
* markets that pack Spread / Money Line / Total together are split apart, duplicates
  across groups are dropped, and simulated leagues (e-soccer and friends) sort last
* everything is cached — fixtures 90s, odds 45s — and only the first dozen fixtures on a
  page get their headline market fetched, which keeps the request count sane

### Betting

The slip does singles and combos, with a stake per pick or one shared stake. Two picks from
the same match cannot be combined. A promo free bet can be applied to a single inside its
odds range. The gear toggle decides whether a moved price is accepted automatically.

**Prices are re-read on the server before a bet is accepted.** Whatever the browser sends
is checked against the live feed; if the selection is gone or the price moved, the bet is
rejected with the new price rather than taken at a stale one.

Bets are settled by hand for now: `POST /api/admin/sports/settle` with `won`, `lost` or
`void` (won pays the potential, void refunds). Sports stakes count towards wagering, so
they feed VIP progress, rakeback and the weekly race.

| Variable | Default | What it does |
| --- | --- | --- |
| `DICEY_B365_TOKEN` | `data/b365-token.txt` | feed token |
| `DICEY_SPORTS_LIST_TTL` | `90000` | fixture cache, ms |
| `DICEY_SPORTS_ODDS_TTL` | `45000` | odds cache, ms |
| `DICEY_SPORTS_ODDS_PER_PAGE` | `12` | fixtures per page that get headline odds |

In-play is not wired up yet — this is the prematch feed only.

## Weekly race

$15,000 split between the ten biggest wagerers. The race runs Sunday 02:00 to Sunday
02:00, every bet adds to the player's total live, and the server pays the prizes out on
its own the moment the week rolls over — no button to press.

| Place | Prize | | Place | Prize |
| --- | --- | --- | --- | --- |
| 1st | $6,000 | | 6th | $100 |
| 2nd | $4,500 | | 7th | $100 |
| 3rd | $2,500 | | 8th | $100 |
| 4th | $1,000 | | 9th | $100 |
| 5th | $500 | | 10th | $100 |

Prizes land as a `race` transaction on the winner's balance and the finished board is kept
as "Last race" on the Races page. The ladder lives in `RACE_PRIZES` in `server.js`; the
02:00 boundary follows the same `DICEY_TZ_OFFSET` as the bonuses.

## Cashier

### Every player gets their own deposit addresses

One BIP39 mnemonic gives each account its own address on every chain, derived with
standard paths so any wallet can recover them:

| Coin | Path | Address type |
| --- | --- | --- |
| ETH, USDT, USDC | `m/44'/60'/0'/0/<index>` | one Ethereum address for all three |
| BTC | `m/84'/0'/0'/0/<index>` | native segwit (`bc1…`) |
| SOL | `m/44'/501'/<index>'/0'` | Solana |

Put the mnemonic in **`data/seed.txt`** (git-ignored) or the `DICEY_MNEMONIC` environment
variable. Without it the cashier falls back to the manual "report your deposit" flow.
Index 1 goes to the first account created, and the QR code beside each address is a real
scannable QR of that exact address.

Because every address belongs to exactly one player, a deposit needs nothing else: the
player sees an address and a QR code, sends, and the balance moves on its own. There is no
form to fill in and nothing for an admin to approve.

* ERC-20 transfers and plain ETH transfers are picked up from Ethereum logs and blocks
* BTC and SOL addresses are polled for a rise in total received
* USDT and USDC credit 1:1; ETH, BTC and SOL convert at the live Coinbase spot price
* anything worth at least `DICEY_MIN_DEPOSIT_USD` (default $10) is credited automatically
  once it has `DICEY_CONFIRMATIONS` (default 3) confirmations; smaller dust is logged as
  pending so you can decide what to do with it
* when a deposit lands the player gets a toast and a glowing pill in the topbar showing
  the amount and the coin
* anything that arrives at an address we do not recognise waits in the admin panel

**Why a deposit can never be counted twice.** Every detection path — a transfer log, a
block scan, the background sweep — funnels through one function that credits *the
difference between the confirmed on-chain balance and what has already been credited*,
then writes the new total back. Seeing the same deposit again is simply a no-op, and a
deposit that arrives while the server is down is picked up by the next sweep. An address
being watched for the first time is only baselined, so restoring a backup never
re-credits balances that were already there.

Upgrading from an older build? Start once with `node server.js --resync-deposits` to
forget the old ledger and re-baseline every address from the chain.

One operational note: because crediting compares balances, avoid sweeping funds out of a
player address in the same minute a deposit lands, or the two can cancel out. Deposits are
credited within a poll cycle (20 seconds by default), so in practice just sweep whenever.

| Variable | Default | What it does |
| --- | --- | --- |
| `DICEY_MNEMONIC` | `data/seed.txt` | the BIP39 mnemonic addresses are derived from |
| `DICEY_RPC_URL` | `https://ethereum-rpc.publicnode.com` | Ethereum JSON-RPC endpoint |
| `DICEY_SOL_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana JSON-RPC endpoint |
| `DICEY_BTC_API_URL` | `https://blockstream.info/api` | Bitcoin address API |
| `DICEY_CONFIRMATIONS` | `3` | confirmations before crediting |
| `DICEY_MIN_DEPOSIT_USD` | `10` | smallest deposit that credits by itself |
| `DICEY_ETH_USD` | live price | fixed ETH price instead of the feed |
| `DICEY_WATCH_ETH` / `_BTC` / `_SOL` | `1` | set any to `0` to stop watching that chain |
| `DICEY_POLL_MS` | `20000` | how often to poll |
| `DICEY_RECONCILE_BATCH` | `6` | addresses checked per sweep |

### The server never touches the money

`hd.js` derives addresses and nothing else: no private key is stored, and there is no code
anywhere in this project that can sign or broadcast a transaction. Deposits therefore stay
on the address they landed on until **you** move them, by importing the same mnemonic into
a wallet you control (any BIP39 wallet with the standard paths above will show every
balance). That is deliberate — an automatic sweeper needs live keys and gas on every
address, and a bug in one would cost real money.

**Treat the mnemonic like the money itself.** Anyone who reads it owns every coin on every
derived address. Keep it out of screenshots, chats and git, and if it has ever been
exposed, move the funds and start from a fresh phrase.

### Withdrawals are manual

A withdrawal request deducts the balance immediately and waits as `Pending`. You send the
coin yourself from your wallet, then hit **Confirm** — rejecting refunds the player
automatically. The site never has the ability to pay anyone out on its own.

## Admin dashboard

Visible in the left rail only for admin accounts. It shows:

* totals — players, deposits, withdrawals, outstanding balances, wagered, house profit
* every pending deposit and withdrawal with the player, coin, address and amount, plus
  Confirm / Reject buttons
* a player table with balance, deposits, withdrawals, wagered, VIP rank, bets, their
  referral code, who referred them, the promo code they signed up with, last IP and last seen
* unidentified on-chain deposits, with a field to assign them to a player by email
* a per-player panel with their signup and last IP, the players they invited, their full
  transaction list and their last 60 rounds, a field to add or subtract balance with a
  note, and a block switch

## Games

Clicking a lobby tile opens the game in a popup with its own bet panel.

| Game | How it plays | Edge |
| --- | --- | --- |
| Dice | Roll over/under a target from 2–98 | 1% |
| Limbo | Set a target multiplier, the round has to reach it | 1% |
| Coinflip | Heads or tails at 1.98×, ride the streak or collect | 1% |
| Mines | 5×5 field, pick your mine count, cash out any time | 1% |
| Blackjack | 6-deck shoe, dealer stands on 17, blackjack pays 3:2 | ~0.5% |
| Keno | Pick up to 10 of 40, ten are drawn | classic paytable |
| Dig Dig | Climb 8 levels, dodge the rocks, cash out any time | 1% |
| Black Holes | Open 3 of 16 holes and add up the multipliers | ~2% |
| Plinko | Drop balls through 12 peg rows, three risk levels | 1% |
| Wheel | 12 segments, three risk levels | 1–5% |

All outcomes come from `crypto.getRandomValues`.

## Before using this with real money

This is a working demo, not a hardened casino. At minimum you would need to:

* **Move the game RNG to the server.** Rounds are currently played in the browser and the
  result is reported to `/api/play/round`, so a determined player could post a fake win.
  The server already owns the balance, the bet log and every transaction — the outcomes
  are the missing piece.
* Serve it over HTTPS behind a reverse proxy and set the session cookie to `Secure`.
* Add real deposit detection instead of the manual confirm step, plus KYC, limits and
  responsible-gambling controls as your licence requires.

## Layout

```
index.html                 page shell (sidebar, topbar, pages, modals)
server.js                  accounts, wallet, rewards, admin API + static file server
chain.js                   read-only deposit watching for Ethereum, Bitcoin and Solana
hd.js                      BIP39/BIP32 address derivation (keccak, bech32, base58)
sports.js                  bet365 prematch feed: fetch, cache and flatten markets
data/seed.txt              your mnemonic, git-ignored
data/b365-token.txt        your sportsbook token, git-ignored
data/db.json               created at runtime, git-ignored
assets/css/app.css         shell, auth, feed and admin styling
assets/css/games.css       game modal + per-game styling
assets/js/core.js          RNG, formatting, wallet store, toasts
assets/js/api.js           backend client, mode detection, balance sync
assets/js/game-modal.js    game registry, modal, shared bet-panel widgets
assets/js/games/*.js       one file per game
assets/js/app.js           lobby, navigation, cashier, page data
assets/js/qr.js            QR encoder (byte mode, level M, versions 1–10)
assets/js/vip.js           the VIP ladder and everything that displays it
assets/js/feed.js          Live Wins / My Bets / High Rollers / Lucky Wins / Wager Race
assets/js/rewards.js       the rewards popup
assets/js/race.js          weekly race board and countdown
assets/js/deposits.js      deposit alerts and the sports free bet
assets/js/sports.js        sportsbook page, markets and the bet slip
assets/js/account.js       register / log in / log out and session UI
assets/js/admin.js         admin dashboard
```

### Adding a game

```js
Dicey.registerGame({
  id: 'mygame',
  name: 'My Game',
  mount(ctx) {
    const amount = ctx.ui.amount();
    const play = ctx.ui.action('Play');
    ctx.panel.append(amount.node, play);
    play.addEventListener('click', () => {
      const bet = amount.get();
      if (!ctx.bet(bet)) return;          // takes the stake, false if unaffordable
      ctx.settle(bet, bet * 2, 2);        // credits the return and logs the round
    });
  },
});
```

Add matching metadata (name, badge, tile art) to `Dicey.games` in `assets/js/app.js`
so the game shows up in the lobby, then load the file from `index.html`. In server mode
`ctx.settle` also reports the round to the backend, so it shows up in the admin dashboard
with no extra work.
