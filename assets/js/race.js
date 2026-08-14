/* ============================================================
   Virtusjack — weekly wager race

   $15,000 split between the top ten. The board is live wagering
   from the backend; the server pays the prizes out by itself
   when the race closes on Sunday at 02:00.
   ============================================================ */

(function (D) {
  'use strict';

  const POOL = 15000;
  const PRIZES = [6000, 4500, 2500, 1000, 500, 100, 100, 100, 100, 100];

  const topEl = D.$('#raceTop');
  const boardEl = D.$('#raceBoard');
  const prizesEl = D.$('#racePrizes');
  const lastPanel = D.$('#raceLastPanel');
  const lastEl = D.$('#raceLast');

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const usd0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const money0 = (n) => '$' + usd0.format(n);

  let endsAt = 0;
  let timer = 0;

  function remaining() {
    const left = endsAt - Date.now();
    if (left <= 0) return 'paying out…';
    const days = Math.floor(left / 86400000);
    const hours = Math.floor((left % 86400000) / 3600000);
    const minutes = Math.floor((left % 3600000) / 60000);
    if (days) return days + 'd ' + hours + 'h';
    if (hours) return hours + 'h ' + minutes + 'm';
    return minutes + 'm ' + Math.floor((left % 60000) / 1000) + 's';
  }

  function card(value, label) {
    return '<div class="race-card"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>';
  }

  function renderPrizes() {
    prizesEl.innerHTML = PRIZES.map((prize, i) =>
      '<div class="row"><span>' + (i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : (i + 1) + 'th') +
      ' place</span><b class="green">' + money0(prize) + '</b></div>'
    ).join('');
  }

  function renderBoard(data) {
    const rows = data.board || [];
    if (!rows.length) {
      boardEl.innerHTML = '<div class="bets-empty">No wagers in this race yet — be the first.</div>';
      return;
    }
    const mine = data.me && data.me.rank;
    boardEl.innerHTML = rows.map((entry) =>
      '<div class="lb-row' + (entry.rank <= 3 ? ' top' + entry.rank : '') + (entry.rank === mine ? ' is-me' : '') + '">' +
        '<span class="lb-rank">#' + entry.rank + '</span>' +
        '<span class="lb-user">' + esc(entry.user) + (entry.rank === mine ? ' <em>you</em>' : '') + '</span>' +
        '<span class="lb-wager">' + D.fmt(entry.wagered) + ' wagered</span>' +
        '<span class="lb-prize">' + (entry.prize ? money0(entry.prize) : '—') + '</span>' +
      '</div>'
    ).join('');
  }

  function renderLast(last) {
    if (!last || !last.winners || !last.winners.length) { lastPanel.hidden = true; return; }
    lastPanel.hidden = false;
    lastEl.innerHTML = last.winners.map((w) =>
      '<div class="lb-row' + (w.rank <= 3 ? ' top' + w.rank : '') + '">' +
        '<span class="lb-rank">#' + w.rank + '</span>' +
        '<span class="lb-user">' + esc(w.user) + '</span>' +
        '<span class="lb-wager">' + D.fmt(w.wagered) + ' wagered</span>' +
        '<span class="lb-prize">' + money0(w.prize) + ' paid</span>' +
      '</div>'
    ).join('');
  }

  function renderTop(data) {
    const me = data.me;
    topEl.innerHTML =
      card(money0(data.pool || POOL), 'Prize pool') +
      card(remaining(), 'Race ends in') +
      card(data.players || 0, 'Players') +
      card(me && me.rank ? '#' + me.rank : '—', 'Your position') +
      card(me ? D.fmt(me.wagered) : '$0.00', 'You wagered') +
      card(me && me.prize ? money0(me.prize) : '$0', 'On track to win');
  }

  /** Demo mode has no shared leaderboard, so show invented rivals. */
  function demoData() {
    const names = ['Hidden', 'Crypto_King', 'DiamondHands', 'Shadowplay', 'MoonUp', 'LuckyJoe', 'GoldRush', 'FastBet', 'NightOwl99', 'Zeljko94'];
    const board = names.map((user, i) => ({
      rank: i + 1,
      user: user,
      wagered: D.round2(180000 / (i + 1) + 500),
      prize: PRIZES[i] || 0,
    }));
    return { pool: POOL, players: board.length, board: board, me: null, endsAt: Date.now() + 3 * 86400000 };
  }

  function load() {
    if (!D.Wallet.isServer()) {
      const data = demoData();
      endsAt = data.endsAt;
      renderTop(data);
      renderBoard(data);
      renderLast(null);
      return Promise.resolve();
    }
    return D.Api.request('GET', '/api/race')
      .then((data) => {
        endsAt = data.endsAt;
        renderTop(data);
        renderBoard(data);
        renderLast(data.last);
        const copy = D.$('#bannerRaceCopy');
        if (copy) copy.textContent = 'Top 10 share the pool. Ends in ' + remaining() + '.';
      })
      .catch(() => {
        boardEl.innerHTML = '<div class="bets-empty">Could not load the race.</div>';
      });
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-nav="races"]')) load();
  });

  // keep the countdown ticking while the page is open
  timer = setInterval(() => {
    if (document.hidden) return;
    if (!D.$('#page-races').classList.contains('active')) return;
    const cards = topEl.querySelectorAll('.race-card b');
    if (cards[1]) cards[1].textContent = remaining();
    if (Date.now() > endsAt) load();
  }, 1000);

  setInterval(() => {
    if (document.hidden || !D.$('#page-races').classList.contains('active')) return;
    load();
  }, 15000);

  renderPrizes();
  load();

  D.Race = { load: load };
})(window.Virtusjack);
