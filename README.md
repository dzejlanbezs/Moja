# Dicey — casino front-end demo

A single-page, dependency-free casino front-end: lobby, VIP club, races, promotions,
sportsbook preview, cashier, and ten playable in-browser originals.

Everything runs on **play money** stored in `localStorage`. There is no backend, no real
deposits and no real payouts.

## Run it

Any static file server works:

```bash
python3 -m http.server 4173
# then open http://localhost:4173
```

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

## Layout

```
index.html                 page shell (sidebar, topbar, pages, modals)
assets/css/app.css         shell styling
assets/css/games.css       game modal + per-game styling
assets/js/core.js          RNG, formatting, wallet store, toasts
assets/js/game-modal.js    game registry, modal, shared bet-panel widgets
assets/js/games/*.js       one file per game
assets/js/app.js           lobby, navigation, cashier, page data
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
so the game shows up in the lobby, then load the file from `index.html`.
