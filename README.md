# Virtusjack — casino front-end + accounts backend

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
`VIRTUSJACK_ADMIN_EMAIL=you@example.com`. If you start the server without ever setting a
password, one is generated and written to `data/admin-password.txt`.

Everything lives in `data/db.json` (git-ignored). Delete that folder to start over.
Passwords are stored as scrypt hashes with a per-user salt, never in plain text.

Every setting below is read from a `VIRTUSJACK_*` environment variable. The older
`DICEY_*` names are still honoured, so anything you had set keeps working.

## Accounts

Register asks for an email, a password (8+ characters) and an optional code. That one
field takes either another player's **referral code** or one of **your promo codes**.
New accounts start at **$0.00**.

Accounts are permanent: the record, the balance, the bet history and the login all stay in
`data/db.json` until you delete them, and the session cookie is good for ten years, so a
returning player is still signed in.

### Promo codes and the deposit bonus

`DXDXDA` and `FGASDK` out of the box, changeable with
`VIRTUSJACK_PROMO_CODES="CODE1,CODE2"`. Anyone who signs up with one sees the yellow
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

The 02:00 boundary follows `VIRTUSJACK_TZ_OFFSET` (default `2`, i.e. Serbian summer time). Set
it to your own UTC offset so the day rolls over at the right moment.

Only rakeback shows a figure. Daily, weekly and monthly sit behind a padlock until they
can be opened, and their amounts never reach the browser at all — the API leaves the
numbers out rather than hiding them in the page.

### Promo free bet

A player who signed up with one of your promo codes earns a free sports bet worth 100% of
their **first deposit** the moment it credits. The Sports icon in the rail starts glowing
gold, and clicking it explains the offer: the amount, allowed odds of 1.50–5.00 and no
wager requirement. Cap it with `VIRTUSJACK_FREEBET_MAX` if you want an upper limit. Settling
the bet is manual, since the sportsbook is still a preview.

## Sportsbook

Prematch fixtures and odds come live from the bet365 feed via
[b365api](https://b365api.com). Put your token in **`data/b365-token.txt`** (git-ignored)
or the `VIRTUSJACK_B365_TOKEN` environment variable; without it the Sports page says so plainly
instead of showing filler.

* 28 sports, `sport_id`s as published by the provider, each with its own icon
* `/v1/bet365/upcoming` gives the fixture list, `/v4/bet365/prematch` the markets
* **team crests** come from `/v1/event/view`, which returns both sides' `image_id` in a
  single request — note that `/v1/team/info` will not accept the team ids found in the
  bet365 payload, only the provider's own ids. Crests are validated once (the feed serves a
  43-byte placeholder when a club has no badge), remembered on disk in `data/teams.json`
  keyed by team name, and served through `/api/sports/logo` so the browser only ever talks
  to us. Anything missing or broken falls back to the initial in a coloured circle
* prices refresh every 30 seconds and flash green with an up arrow or red with a down
  arrow as they move
* `sports.js` flattens bet365's nested payload (`main`, `goals`, `half`, `asian_lines`,
  `others`, per-period groups, plus the reduced `schedule` shape) into plain markets with
  readable selections — "Feyenoord (W) -1.0" rather than `header: 1, handicap: -1.0`
* markets that pack Spread / Money Line / Total together are split apart, duplicates
  across groups are dropped, and simulated leagues (e-soccer and friends) sort last
* the fixture list paints straight away and prices stream in behind it: `FI` accepts ten
  events per request, so twenty rows cost two calls instead of twenty, and crests resolve
  in the background. Fixtures cache for 90s and odds for 25s

### Trending Now

Three matches sit at the top of the Sports page with their headline prices, the number of
markets, and a crowd figure. They fill themselves with the next MLB games, so the strip is
never empty, and an admin can pin any three matches instead — search a sport by team or
league in the **Trending Now** panel of the admin dashboard, hit **Pin**, and they take
over. The same panel edits the number of people watching, and **Back to automatic** hands
the strip back to the feed. A pinned match drops off by itself once it has started.

Drop any single image into `assets/img/trending/` and it becomes the background of all
three cards; the filename does not matter.

### Promo banners

Three banners sit above the sport tabs: the 100% sports bonus, "Sportsbook is live now"
and the XP boost. Clicking them opens the cashier, jumps to the fixtures, or goes to the
VIP page.

Each one draws itself from CSS, so the strip looks finished out of the box. To use your own
artwork, drop these files into `assets/img/promo/` (1024×576 works well):

```
sports-bonus.jpg      sportsbook-live.jpg      level-up.jpg
```

A banner switches to the image as soon as it loads and hides its own overlay text, since
finished artwork already carries the wording. Names and copy live in the `PROMOS` list at
the top of `assets/js/sports.js`.

### Finding a match

The search box above the list scans the first few pages of the chosen sport by team or
league name. Clicking the `+N` button on a row opens a page for that match alone: both
crests and the kick-off time in a hero card, a breadcrumb, standard-markets and
same-game-parlay tabs, and a chip row built from what that match actually offers — Main,
Player Props, Innings (or Halves, Quarters, Periods, Sets), Totals and More — plus a
magnifier that searches the market names.

Markets that price one thing at several lines are laid out the way a sportsbook does it:
one row per side, either Over and Under or a crest and team name, with the lines side by
side. The rows scroll together so a line always sits above its opposite number, and
**View all lines** wraps every line into view at once. Everything else stays a plain pair
of buttons with the name on the left and the price on the right.

### Betting

The slip does singles and combos, with a stake per pick or one shared stake. Two picks from
the same match cannot be combined. A promo free bet can be applied to a single inside its
odds range. The gear toggle decides whether a moved price is accepted automatically.

**Prices are re-read on the server before a bet is accepted.** Whatever the browser sends
is checked against the live feed; if the selection is gone or the price moved, the bet is
rejected with the new price rather than taken at a stale one.

Bets are settled by hand from the admin dashboard. The **Sports bets** panel lists every
bet with the player, stake, odds, potential return and the picks, filtered by status, and
each pending bet has **Win / Loss / Void**: win pays the potential return, void refunds the
stake, loss pays nothing. The same buttons appear inside a player's detail panel. Sports
stakes count towards wagering, so they feed VIP progress, rakeback and the weekly race.

Team crests follow a bet all the way through — the slip, the placed-bet card and the bets
list show the crest of the team the selection names. Match pages request the larger crest
variant (`/images/team/b/`) so the header badges stay sharp.

| Variable | Default | What it does |
| --- | --- | --- |
| `VIRTUSJACK_B365_TOKEN` | `data/b365-token.txt` | feed token |
| `VIRTUSJACK_SPORTS_LIST_TTL` | `90000` | fixture cache, ms |
| `VIRTUSJACK_SPORTS_ODDS_TTL` | `25000` | odds cache, ms |
| `VIRTUSJACK_SPORTS_ODDS_PER_PAGE` | `20` | fixtures per page that get headline odds |

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
02:00 boundary follows the same `VIRTUSJACK_TZ_OFFSET` as the bonuses.

## Cashier

### Every player gets their own deposit addresses

One BIP39 mnemonic gives each account its own address on every chain, derived with
standard paths so any wallet can recover them:

| Chain | Path | Address type | Carries |
| --- | --- | --- | --- |
| Ethereum | `m/44'/60'/0'/0/<index>` | `0x…` | ETH, USDT and USDC as ERC-20 |
| Bitcoin | `m/84'/0'/0'/0/<index>` | native segwit (`bc1…`) | BTC |
| Solana | `m/44'/501'/<index>'/0'` | base58 | SOL, USDT and USDC as SPL |
| Tron | `m/44'/195'/0'/0/<index>` | `T…` | TRX, USDT and USDC as TRC-20 |

### USDT and USDC pick their network

Both stablecoins are offered on **Ethereum (ERC-20), Solana (SPL) and Tron (TRC-20)**.
The cashier shows a network row under the coins; picking a network swaps the address, the
QR code and the warning line, because each network pays into the player's address on
*that* chain. Coins that live on one chain only (ETH, BTC, SOL, TRX) show no network row.

Nothing extra is needed to receive SPL tokens: the sender creates the associated token
account, so the plain Solana address is all a player ever hands out. USDT and USDC credit
1:1 whichever network they arrive on.

Put the mnemonic in **`data/seed.txt`** (git-ignored) or the `VIRTUSJACK_MNEMONIC` environment
variable. Without it the cashier falls back to the manual "report your deposit" flow.
Index 1 goes to the first account created, and the QR code beside each address is a real
scannable QR of that exact address.

Because every address belongs to exactly one player, a deposit needs nothing else: the
player sees an address and a QR code, sends, and the balance moves on its own. There is no
form to fill in and nothing for an admin to approve.

* ERC-20 transfers and plain ETH transfers are picked up from Ethereum logs and blocks
* BTC, SOL and TRX addresses are polled for a rise in balance, and so are the SPL token
  accounts on Solana and the TRC-20 balances on Tron
* USDT and USDC credit 1:1 on every network; ETH, BTC, SOL and TRX convert at the live
  Coinbase spot price
* anything worth at least `VIRTUSJACK_MIN_DEPOSIT_USD` (default $10) is credited automatically
  once it has `VIRTUSJACK_CONFIRMATIONS` (default 3) confirmations; smaller dust is logged as
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
| `VIRTUSJACK_MNEMONIC` | `data/seed.txt` | the BIP39 mnemonic addresses are derived from |
| `VIRTUSJACK_RPC_URL` | `https://ethereum-rpc.publicnode.com` | Ethereum JSON-RPC endpoint |
| `VIRTUSJACK_SOL_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana JSON-RPC endpoint |
| `VIRTUSJACK_BTC_API_URL` | `https://blockstream.info/api` | Bitcoin address API |
| `VIRTUSJACK_TRON_API_URL` | `https://api.trongrid.io` | Tron account API |
| `VIRTUSJACK_TRON_API_KEY` | none | TronGrid API key; without one TronGrid allows one account lookup per second |
| `VIRTUSJACK_CONFIRMATIONS` | `3` | confirmations before crediting |
| `VIRTUSJACK_MIN_DEPOSIT_USD` | `10` | smallest deposit that credits by itself |
| `VIRTUSJACK_ETH_USD` | live price | fixed ETH price instead of the feed |
| `VIRTUSJACK_WATCH_ETH` / `_BTC` / `_SOL` / `_TRON` | `1` | set any to `0` to stop watching that chain |
| `VIRTUSJACK_POLL_MS` | `20000` | how often to poll |
| `VIRTUSJACK_RECONCILE_BATCH` | `6` | Ethereum addresses checked per sweep |
| `VIRTUSJACK_SOL_BATCH` | `8` | Solana addresses checked per poll |
| `VIRTUSJACK_TRON_BATCH` | `5` | Tron addresses checked per poll |
| `VIRTUSJACK_TRON_GAP_MS` | `1200` | pause between Tron lookups, to stay inside the rate limit |

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

The player picks a network for USDT and USDC here too, and the request is refused unless
the address really belongs to that chain: checksums are verified, so a Tron address typed
into an ERC-20 withdrawal, or a single mistyped character, is caught before you ever see
it. The network is shown next to every request in the admin panel so you know which wallet
to pay from.

## Admin dashboard

Visible in the left rail only for admin accounts. It shows:

* totals — players, deposits, withdrawals, outstanding balances, wagered, house profit
* every pending deposit and withdrawal with the player, coin, address and amount, plus
  Confirm / Reject buttons
* a player table with balance, deposits, withdrawals, wagered, VIP rank, bets, their
  referral code, who referred them, the promo code they signed up with, last IP and last seen
* unidentified on-chain deposits, with a field to assign them to a player by email
* a per-player panel with their signup and last IP, the players they invited, their deposit
  address on every chain (click one to copy it), their sports bets with Win / Loss / Void,
  their full transaction list and their last 60 rounds, a field to add or subtract balance
  with a note, and a block switch
* the Trending Now panel, for pinning the three matches on the Sports page and setting how
  many people each one says are watching

## Swapping the artwork

Everything visual in the lobby can be replaced by dropping files into
`assets/img/`. The server lists what is actually there, so a missing file simply
means the built-in artwork stays — nothing to configure and nothing breaks.

| Folder | File | Where it shows |
| --- | --- | --- |
| `banners/` | `race`, `vip` | background of the two lobby banners |
| `games/` | `blackholes`, `blackjack`, `coinflip`, `dice`, `digdig`, `keno`, `limbo`, `mines`, `plinko`, `wheel` | game tile backgrounds, and the thumbnail wherever that game appears in a feed |
| `sports/` | `logo` | thumbnail for sportsbook bets in the feeds |
| `coins/` | `usdt`, `usdc`, `eth`, `btc`, `sol`, `trx` | currency icons in the cashier, deposit and withdraw |
| `promo/` | `sports-bonus`, `sportsbook-live`, `level-up` | the three sportsbook banners |
| `trending/` | any single image | the background behind all three Trending Now cards |
| `nav/` | `casino`, `sports` | the two picture tiles at the top of the left rail |
| `wins/` | one per original | the square beside every win in the Live Wins strip, and in that game's header |
| `logo/` | `mark`, `full` | your own logo: `mark` swaps the square, `full` replaces the whole wordmark |

`.jpg .jpeg .png .webp .avif` all work and names are matched loosely, so
`black-holes.png`, `Dig Dig.webp` or `weekly-race.jpg` are all fine. Each folder
has a README with sizes. Banners and tiles keep their text on top of your image;
the sportsbook promos hide their text instead, since that artwork usually carries
its own wording.

The little square in the Live Wins strip and the bet feeds shows **what was bet
on**, not who bet: the picture from `wins/` if there is one, then the game's tile
art from `games/`, then its built-in badge, and a gold sports mark for sportsbook
bets. That means the strip can carry different artwork from the lobby without
touching the tiles.

### Live Wins strip

Two tabs sit above the lobby. **Live Wins** invents one win every ten seconds
inside a range you set in the admin dashboard (*Live Wins strip* panel, for
example $0 to $1,000), and **Biggest Wins** lists the largest real payouts the
server has seen, falling back to invented ones while the log is empty. No player
is ever named: every card reads **Hidden**.

### Footer

The footer carries Support, Platform, Legal and Community, and every link opens
its own page. All of that copy — eight documents, from the Help Center to Cookie
Preferences — lives in one place, **`assets/js/docs.js`**: edit the strings in
`DOCS` and nothing else needs to change. Each page is reachable at `#doc=<key>`,
so a link can be shared or bookmarked.

### Navigation

Casino and Sports sit in one block at the top of a narrow rail. A click tints the
selected one green; the picture from `assets/img/nav` is a hover reveal, so the
rail stays quiet until you point at it. Below them, the Originals / Slots / Live shortcuts follow the lobby
category and only one is ever lit. Expand the rail — or open the drawer on a
phone — and every entry spells out its name. Signed out, the balance and the
cashier are hidden and the topbar shows only **Log in** and **Register**.

## Games

Clicking a lobby tile opens the game in a popup with its own bet panel.

| Game | How it plays | Edge |
| --- | --- | --- |
| Dice | Roll over/under a target from 2–98 | 1% |
| Limbo | Set a target multiplier, the round has to reach it | 1% |
| Coinflip | Heads or tails at 1.98×, ride the streak or collect | 1% |
| Mines | 5×5 field, pick your mine count, cash out any time | 1% |
| Blackjack | 6-deck shoe, dealer stands on 17, blackjack pays 3:2, split to four hands, insurance 2:1 | ~0.5% |
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
chain.js                   read-only deposit watching for Ethereum, Bitcoin, Solana and Tron
hd.js                      BIP39/BIP32 address derivation (keccak, bech32, base58)
sports.js                  bet365 prematch feed: fetch, cache and flatten markets
data/seed.txt              your mnemonic, git-ignored
data/b365-token.txt        your sportsbook token, git-ignored
data/db.json               created at runtime, git-ignored
assets/css/app.css         shell, auth, feed and admin styling
assets/css/games.css       game modal + per-game styling
assets/img/                swappable banner, tile, sports and promo artwork
assets/js/core.js          RNG, formatting, wallet store, toasts
assets/js/art.js           finds your artwork and falls back to the built-in art
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
assets/js/docs.js          the footer pages — all of that copy lives here
assets/js/account.js       register / log in / log out and session UI
assets/js/admin.js         admin dashboard
```

### Adding a game

```js
Virtusjack.registerGame({
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

Add matching metadata (name, badge, tile art) to `Virtusjack.games` in `assets/js/app.js`
so the game shows up in the lobby, then load the file from `index.html`. In server mode
`ctx.settle` also reports the round to the backend, so it shows up in the admin dashboard
with no extra work.
