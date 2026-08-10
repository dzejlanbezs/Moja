# Dicey — casino front-end + accounts backend

A dependency-free casino site: lobby, VIP club, races, promotions, sportsbook preview,
cashier, ten playable in-browser originals, real player accounts and an admin dashboard.

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

Register asks for an email, a password (8+ characters) and an optional referral code.
New accounts start at **$0.00** — money only arrives when an admin confirms a deposit or
adjusts the balance by hand. Sessions are HttpOnly cookies that last 30 days.

## Cashier flow

* **Deposit** — the player sends coin to the shown address, then reports the amount. The
  request sits as `Pending` until an admin confirms it, and only then is the balance credited.
* **Withdraw** — the amount is deducted straight away and the request sits as `Pending`.
  Confirming keeps the money out; rejecting refunds it automatically.

## Admin dashboard

Visible in the left rail only for admin accounts. It shows:

* totals — players, deposits, withdrawals, outstanding balances, wagered, house profit
* every pending deposit and withdrawal with the player, coin, address and amount, plus
  Confirm / Reject buttons
* a player table with balance, deposits, withdrawals, wagered, bets, their referral code,
  who referred them, last IP and last seen
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
server.js                  accounts, wallet, admin API + static file server
data/db.json               created at runtime, git-ignored
assets/css/app.css         shell, auth and admin styling
assets/css/games.css       game modal + per-game styling
assets/js/core.js          RNG, formatting, wallet store, toasts
assets/js/api.js           backend client, mode detection, balance sync
assets/js/game-modal.js    game registry, modal, shared bet-panel widgets
assets/js/games/*.js       one file per game
assets/js/app.js           lobby, navigation, cashier, page data
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
