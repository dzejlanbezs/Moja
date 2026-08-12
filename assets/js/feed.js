/* ============================================================
   Dicey — bet feed at the bottom of the lobby

   Live Wins / My Bets / High Rollers / Lucky Wins / Wager Race.
   Real rounds from the backend in server mode, simulated traffic
   when the site runs standalone.
   ============================================================ */

(function (D) {
  'use strict';

  const table = D.$('#feedTable');
  const rowsSelect = D.$('#feedRows');
  let tab = 'live';
  let limit = 10;
  let timer = 0;

  const NAMES = ['Hidden', 'Hidden', 'SharpieGoldChips358', 'Crypto_King', 'NightOwl99', 'LuckyJoe',
    'Shadowplay', 'GoldRush', 'FastBet', 'DiamondHands', 'MoonUp', 'Zeljko94', 'Hidden'];

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const gameIds = () => Object.keys(D.games);

  function ago(ts) {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  const coin = () => '<span class="feed-coin">$</span>';

  // the thumbnail shows the game that was played, or the gold sports mark
  const thumb = (gameId, gameName) => D.thumbHtml(gameId, gameName).replace('win-thumb', 'win-thumb feed-thumb');

  function avatar(user) {
    const hidden = user === 'Hidden';
    return '<span class="feed-avatar' + (hidden ? ' anon' : '') + '">' + esc(hidden ? '?' : user.slice(0, 1)) + '</span>';
  }

  /* ---------------- demo traffic ---------------- */

  function simulate(kind, count) {
    const ids = gameIds();
    const rows = [];
    const SPORTS = ['Soccer', 'Tennis', 'Basketball', 'Ice Hockey'];
    for (let i = 0; i < count; i++) {
      const sports = D.rand() < 0.15;
      const gameId = sports ? 'sports' : ids[D.randInt(ids.length)];
      const big = kind === 'high';
      const bet = D.round2(big ? 50 + D.rand() * 950 : 0.5 + D.rand() * 40);
      const mult = kind === 'lucky' ? D.round2(8 + D.rand() * 400) : D.round2(1.2 + D.rand() * 4);
      rows.push({
        user: NAMES[D.randInt(NAMES.length)],
        game: sports ? SPORTS[D.randInt(SPORTS.length)] : D.games[gameId].name,
        gameId: gameId,
        bet: bet,
        multiplier: mult,
        payout: D.round2(bet * mult),
        ts: Date.now() - i * (4000 + D.randInt(9000)),
      });
    }
    if (kind === 'high') rows.sort((a, b) => b.bet - a.bet);
    if (kind === 'lucky') rows.sort((a, b) => b.multiplier - a.multiplier);
    return rows;
  }

  const RACE_PRIZES = [6000, 4500, 2500, 1000, 500, 100, 100, 100, 100, 100];

  function simulateRace(count) {
    const rows = [];
    for (let i = 0; i < count; i++) {
      rows.push({
        rank: i + 1,
        user: NAMES[D.randInt(NAMES.length)],
        wagered: D.round2(200000 / (i + 1) + D.rand() * 5000),
        prize: RACE_PRIZES[i] || 0,
      });
    }
    return rows;
  }

  const myRows = (count) => D.Store.state.history.slice(0, count).map((b) => ({
    user: 'You', game: b.game, gameId: b.gameId, bet: b.bet,
    multiplier: b.multiplier, payout: b.payout, ts: b.ts,
  }));

  /* ---------------- rendering ---------------- */

  function renderRounds(rows) {
    if (!rows.length) {
      table.innerHTML = '<tbody><tr><td class="feed-empty">' +
        (tab === 'mine' ? 'You have not placed a bet yet.' : 'No rounds yet.') + '</td></tr></tbody>';
      return;
    }
    table.innerHTML =
      '<thead><tr><th>User</th><th>Game</th><th>Time</th>' +
      '<th class="num">Amount</th><th class="num">Multiplier</th><th class="num">Payout</th></tr></thead><tbody>' +
      rows.map((r) =>
        '<tr>' +
          '<td><span class="cell-flex">' + avatar(r.user) + '<span>' + esc(r.user) + '</span></span></td>' +
          '<td><span class="cell-flex">' + thumb(r.gameId, r.game) + '<span class="feed-game">' + esc(r.game) + '</span></span></td>' +
          '<td class="muted">' + esc(ago(r.ts)) + '</td>' +
          '<td class="num">' + coin() + esc(D.fmt(r.bet)) + '</td>' +
          '<td class="num">' + esc((r.multiplier || 0).toFixed(2)) + '\u00d7</td>' +
          '<td class="num ' + (r.payout > r.bet ? 'green' : 'muted') + '">' + coin() + esc(D.fmt(r.payout)) + '</td>' +
        '</tr>'
      ).join('') + '</tbody>';
    D.applyThumbArt(table);
  }

  function renderRace(rows) {
    if (!rows.length) {
      table.innerHTML = '<tbody><tr><td class="feed-empty">Nobody has wagered yet.</td></tr></tbody>';
      return;
    }
    table.innerHTML =
      '<thead><tr><th>Rank</th><th>User</th><th class="num">Wagered</th><th class="num">Prize</th></tr></thead><tbody>' +
      rows.map((r) =>
        '<tr>' +
          '<td class="feed-rank">#' + r.rank + '</td>' +
          '<td><span class="cell-flex">' + avatar(r.user) + '<span>' + esc(r.user) + '</span></span></td>' +
          '<td class="num">' + coin() + esc(D.fmt(r.wagered)) + '</td>' +
          '<td class="num green">' + (r.prize ? esc(D.fmt(r.prize)) : '—') + '</td>' +
        '</tr>'
      ).join('') + '</tbody>';
  }

  function load() {
    if (tab === 'mine') {
      // own history already lives in the wallet store in both modes
      renderRounds(D.Wallet.isServer() && !D.Api.user ? [] : myRows(limit));
      return;
    }

    if (!D.Wallet.isServer()) {
      if (tab === 'race') renderRace(simulateRace(limit));
      else renderRounds(simulate(tab, limit));
      return;
    }

    D.Api.request('GET', '/api/feed?tab=' + tab + '&limit=' + limit)
      .then((data) => { if (data.tab === 'race') renderRace(data.race || []); else renderRounds(data.rows || []); })
      .catch(() => { table.innerHTML = '<tbody><tr><td class="feed-empty">Could not load the feed.</td></tr></tbody>'; });
  }

  D.$$('.feed-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      D.$$('.feed-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      tab = btn.dataset.feed;
      load();
    });
  });

  rowsSelect.addEventListener('change', () => {
    limit = parseInt(rowsSelect.value, 10) || 10;
    load();
  });

  function schedule() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (document.hidden) return;
      if (!D.$('#page-casino').classList.contains('active')) return;
      if (tab === 'live' || tab === 'mine') load();
    }, 6000);
  }

  D.Feed = { load: load };
  load();
  schedule();
})(window.Dicey);
