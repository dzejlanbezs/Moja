/* ============================================================
   Dicey — lobby, navigation, cashier and page data
   ============================================================ */

(function (D) {
  'use strict';

  /* ---------------- game catalogue ---------------- */
  D.games = {
    blackholes: {
      name: 'Black Holes', kicker: 'The Drawing Game', badge: 'original', players: 2341, rtp: '98%',
      accent: 'linear-gradient(140deg,#8b5cff,#3d1a8a)',
      art: '<div class="tile-art" style="background:radial-gradient(120% 90% at 30% 20%,#3a1d7a,#0b0518 70%)">' +
        '<svg viewBox="0 0 160 200" style="position:absolute;inset:0;width:100%;height:100%">' +
        '<circle cx="80" cy="78" r="46" fill="none" stroke="#8b5cff" stroke-width="2" opacity=".6"/>' +
        '<circle cx="80" cy="78" r="32" fill="none" stroke="#b79bff" stroke-width="2" opacity=".7"/>' +
        '<circle cx="80" cy="78" r="18" fill="#0b0518" stroke="#d9c9ff" stroke-width="2"/>' +
        '<ellipse cx="80" cy="78" rx="62" ry="16" fill="none" stroke="#8b5cff" stroke-width="2" opacity=".45"/>' +
        '</svg></div>',
    },
    blackjack: {
      name: 'Blackjack', kicker: 'Table Classic', badge: 'hot', players: 1820, rtp: '99.5%',
      accent: 'linear-gradient(140deg,#00e676,#00794a)',
      art: '<div class="tile-art" style="background:radial-gradient(120% 90% at 70% 15%,#0d5cc0,#061024 72%)">' +
        '<svg viewBox="0 0 160 200" style="position:absolute;inset:0;width:100%;height:100%">' +
        '<g transform="rotate(-14 60 90)"><rect x="34" y="48" width="52" height="72" rx="7" fill="#f4f7ff"/>' +
        '<text x="42" y="70" font-family="Inter,sans-serif" font-size="20" font-weight="800" fill="#12151d">A</text>' +
        '<text x="60" y="112" font-family="Inter,sans-serif" font-size="22" fill="#12151d">\u2660</text></g>' +
        '<g transform="rotate(12 100 92)"><rect x="72" y="52" width="52" height="72" rx="7" fill="#e8eefc"/>' +
        '<text x="80" y="74" font-family="Inter,sans-serif" font-size="20" font-weight="800" fill="#e0243a">J</text>' +
        '<text x="98" y="116" font-family="Inter,sans-serif" font-size="22" fill="#e0243a">\u2665</text></g>' +
        '</svg></div>',
    },
    coinflip: {
      name: 'Coinflip', kicker: 'Double or nothing', badge: 'original', players: 980, rtp: '99%',
      accent: 'linear-gradient(140deg,#ffd95e,#c98d00)',
      art: '<div class="tile-art" style="background:radial-gradient(120% 90% at 40% 18%,#1d3f2c,#07130d 72%)">' +
        '<svg viewBox="0 0 160 200" style="position:absolute;inset:0;width:100%;height:100%">' +
        '<circle cx="66" cy="86" r="34" fill="#c9d6e8"/><circle cx="66" cy="86" r="26" fill="#8d9db6"/>' +
        '<circle cx="98" cy="70" r="38" fill="#ffd95e"/><circle cx="98" cy="70" r="29" fill="#d99b00"/>' +
        '<text x="98" y="80" text-anchor="middle" font-family="Rajdhani,sans-serif" font-size="30" font-weight="700" fill="#2a1c00">$</text>' +
        '</svg></div>',
    },
    dice: {
      name: 'Dice', kicker: 'Roll over / under', badge: 'hot', players: 3100, rtp: '99%',
      accent: 'linear-gradient(140deg,#4d8dff,#12408f)',
      art: '<div class="tile-art" style="background:radial-gradient(120% 90% at 65% 18%,#123a7a,#050a17 72%)">' +
        '<svg viewBox="0 0 160 200" style="position:absolute;inset:0;width:100%;height:100%">' +
        '<g transform="rotate(-12 58 92)"><rect x="26" y="60" width="58" height="58" rx="12" fill="#f2f6ff"/>' +
        '<circle cx="44" cy="78" r="5.5" fill="#101828"/><circle cx="66" cy="100" r="5.5" fill="#101828"/></g>' +
        '<g transform="rotate(14 106 96)"><rect x="78" y="66" width="58" height="58" rx="12" fill="#cfe0ff"/>' +
        '<circle cx="94" cy="82" r="5.5" fill="#101828"/><circle cx="120" cy="82" r="5.5" fill="#101828"/>' +
        '<circle cx="94" cy="108" r="5.5" fill="#101828"/><circle cx="120" cy="108" r="5.5" fill="#101828"/></g>' +
        '</svg></div>',
    },
    digdig: {
      name: 'Dig Dig', kicker: 'Climb the tower', badge: 'new', players: 540, rtp: '99%',
      accent: 'linear-gradient(140deg,#ff8a3d,#a13c00)',
      art: '<div class="tile-art" style="background:radial-gradient(120% 90% at 35% 18%,#4a2408,#100704 72%)">' +
        '<svg viewBox="0 0 160 200" style="position:absolute;inset:0;width:100%;height:100%">' +
        '<path d="M40 118l52-52" stroke="#c8b39a" stroke-width="9" stroke-linecap="round"/>' +
        '<path d="M74 40c18 2 34 14 40 32-16-2-30 2-42 12-6-16-4-32 2-44Z" fill="#d7dde8"/>' +
        '<ellipse cx="70" cy="146" rx="46" ry="14" fill="#ff8a3d" opacity=".35"/>' +
        '<circle cx="52" cy="140" r="11" fill="#ffcc33"/><circle cx="82" cy="146" r="8" fill="#ffcc33" opacity=".8"/>' +
        '</svg></div>',
    },
    keno: {
      name: 'Keno', kicker: 'Pick 10 of 40', badge: 'original', players: 1230, rtp: '97%',
      accent: 'linear-gradient(140deg,#9ede4d,#3c7a00)',
      art: '<div class="tile-art" style="background:radial-gradient(120% 90% at 60% 18%,#2c4a10,#080f04 72%)">' +
        '<svg viewBox="0 0 160 200" style="position:absolute;inset:0;width:100%;height:100%">' +
        '<circle cx="56" cy="66" r="22" fill="#f4ffe8"/><text x="56" y="74" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="800" fill="#1a2a08">5</text>' +
        '<circle cx="104" cy="92" r="26" fill="#9ede4d"/><text x="104" y="101" text-anchor="middle" font-family="Inter,sans-serif" font-size="22" font-weight="800" fill="#10200a">21</text>' +
        '<circle cx="58" cy="118" r="18" fill="#cdeaa0"/><text x="58" y="125" text-anchor="middle" font-family="Inter,sans-serif" font-size="16" font-weight="800" fill="#10200a">2</text>' +
        '</svg></div>',
    },
    limbo: {
      name: 'Limbo', kicker: 'How high?', badge: 'hot', players: 4560, rtp: '99%',
      accent: 'linear-gradient(140deg,#00e676,#00695c)',
      art: '<div class="tile-art" style="background:radial-gradient(120% 90% at 50% 15%,#04613c,#03130d 72%)">' +
        '<svg viewBox="0 0 160 200" style="position:absolute;inset:0;width:100%;height:100%">' +
        '<path d="M96 30l-44 70h32l-13 48 46-74H88l8-44Z" fill="#00e676"/>' +
        '<path d="M30 128h30M100 138h30" stroke="#00e676" stroke-width="4" stroke-linecap="round" opacity=".35"/>' +
        '</svg></div>',
    },
    mines: {
      name: 'Mines', kicker: 'Gems &amp; bombs', badge: 'hot', players: 2890, rtp: '99%',
      accent: 'linear-gradient(140deg,#ff4757,#8e0f1c)',
      art: '<div class="tile-art" style="background:radial-gradient(120% 90% at 40% 18%,#4b0d16,#120409 72%)">' +
        '<svg viewBox="0 0 160 200" style="position:absolute;inset:0;width:100%;height:100%">' +
        '<circle cx="62" cy="104" r="30" fill="#20262f"/><path d="M80 82l14-14M92 66h12v12" stroke="#ff8a3d" stroke-width="6" stroke-linecap="round" fill="none"/>' +
        '<path d="M100 54h34l10 14-27 30-27-30 10-14Z" fill="#00e676" opacity=".95"/>' +
        '</svg></div>',
    },
    plinko: {
      name: 'Plinko', kicker: 'Drop the ball', badge: 'new', players: 1975, rtp: '99%',
      accent: 'linear-gradient(140deg,#ff4d94,#7a0f45)',
      art: '<div class="tile-art" style="background:radial-gradient(120% 90% at 50% 15%,#5a0f39,#12030b 72%)">' +
        '<svg viewBox="0 0 160 200" style="position:absolute;inset:0;width:100%;height:100%">' +
        '<g fill="#ffd0e4">' +
        '<circle cx="80" cy="46" r="4"/><circle cx="66" cy="66" r="4"/><circle cx="94" cy="66" r="4"/>' +
        '<circle cx="52" cy="86" r="4"/><circle cx="80" cy="86" r="4"/><circle cx="108" cy="86" r="4"/>' +
        '<circle cx="38" cy="106" r="4"/><circle cx="66" cy="106" r="4"/><circle cx="94" cy="106" r="4"/><circle cx="122" cy="106" r="4"/>' +
        '</g><circle cx="80" cy="30" r="9" fill="#00e676"/>' +
        '<rect x="30" y="124" width="100" height="12" rx="6" fill="#ff4d94" opacity=".6"/>' +
        '</svg></div>',
    },
    wheel: {
      name: 'Wheel', kicker: 'Spin the multiplier', badge: 'new', players: 860, rtp: '97%',
      accent: 'linear-gradient(140deg,#ffcc33,#b26a00)',
      art: '<div class="tile-art" style="background:radial-gradient(120% 90% at 50% 18%,#4a3a05,#120d02 72%)">' +
        '<div style="position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);width:62%;aspect-ratio:1;border-radius:50%;' +
        'background:conic-gradient(#ffcc33 0 45deg,#2b3348 45deg 90deg,#4fd6a0 90deg 135deg,#2b3348 135deg 180deg,' +
        '#ff8a3d 180deg 225deg,#2b3348 225deg 270deg,#ff4757 270deg 315deg,#2b3348 315deg 360deg);' +
        'box-shadow:0 8px 24px rgba(0,0,0,.5)"></div>' +
        '<div style="position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);width:22%;aspect-ratio:1;border-radius:50%;background:#0b0f17"></div>' +
        '</div>',
    },
  };

  const GAME_IDS = Object.keys(D.games);

  /* ---------------- lobby grid ---------------- */
  const grid = D.$('#gameGrid');
  const emptyState = D.$('#gridEmpty');
  const emptyCopy = D.$('#emptyCopy');
  let filter = 'lobby';

  const EMPTY_MESSAGES = {
    slots: 'Slot providers are not wired up in this demo. Every Dicey Original is playable right now.',
    live: 'Live dealer tables need a video feed. Try our table game Blackjack instead.',
    shows: 'Game shows are on the roadmap. Meanwhile, spin the Wheel.',
  };

  function tileHtml(id) {
    const g = D.games[id];
    return (
      '<div class="tile" data-game="' + id + '" tabindex="0" role="button" ' +
        'aria-label="Play ' + g.name + '" title="' + g.name + ' · RTP ' + g.rtp + '">' +
        g.art +
        '<span class="tile-badge badge-' + g.badge + '">' + g.badge + '</span>' +
        '<div class="tile-name">' + g.name + '<small>' + g.kicker + '</small></div>' +
        '<div class="tile-foot"><i class="live-dot"></i>' + g.players.toLocaleString() + ' playing</div>' +
        '<div class="tile-hover"><button class="btn btn-primary">Play now</button></div>' +
      '</div>'
    );
  }

  /** Swaps in operator artwork for the lobby tiles that have a file. */
  function applyTileArt() {
    D.$$('.tile', grid).forEach((tile) => D.Art.apply(tile, 'games', tile.dataset.game));
  }

  function renderGrid() {
    const query = (D.$('#searchInput').value || '').trim().toLowerCase();
    let ids = GAME_IDS;

    if (query) ids = ids.filter((id) => D.games[id].name.toLowerCase().indexOf(query) > -1);
    else if (filter === 'new') ids = ids.filter((id) => D.games[id].badge === 'new');
    else if (EMPTY_MESSAGES[filter]) ids = [];

    grid.innerHTML = ids.map(tileHtml).join('');
    applyTileArt();
    const isEmpty = ids.length === 0;
    emptyState.hidden = !isEmpty;
    grid.hidden = isEmpty;
    if (isEmpty) {
      emptyCopy.textContent = query
        ? 'No game matches "' + query + '". Try Dice, Mines or Plinko.'
        : EMPTY_MESSAGES[filter] || 'Try another category.';
    }
  }

  grid.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (tile) D.openGame(tile.dataset.game);
  });
  grid.addEventListener('keydown', (e) => {
    const tile = e.target.closest('.tile');
    if (tile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); D.openGame(tile.dataset.game); }
  });

  D.$$('.cat-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      D.$$('.cat-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      filter = tab.dataset.filter;
      D.$('#searchInput').value = '';
      renderGrid();
    });
  });

  D.$('#searchInput').addEventListener('input', renderGrid);

  /* ---------------- live wins ---------------- */
  const USERS = ['Hidden', 'Hidden', 'Crypto_King', 'NightOwl99', 'LuckyJoe', 'Shadowplay', 'GoldRush', 'FastBet', 'DiamondHands', 'Hidden', 'MoonUp', 'Zeljko94'];
  const winsTrack = D.$('#winsTrack');
  let winsMode = 'live';

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const SPORTS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.7"/>' +
    '<path d="M12 7.4l3.3 2.4-1.3 3.9h-4L8.7 9.8 12 7.4Z" fill="currentColor"/>' +
    '<path d="M12 2.9v4.5M4.3 10.1l4.4-.3M19.7 10.1l-4.4-.3M7.6 20.1l2.4-6.4M16.4 20.1L14 13.7" ' +
    'fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

  /**
   * The thumbnail shows what was bet on, not who bet: the game's own artwork
   * when the operator supplied one, its built-in badge otherwise, and the gold
   * sports mark for a sportsbook bet.
   */
  D.thumbHtml = (gameId, gameName) => {
    if (gameId === 'sports') {
      return '<span class="win-thumb sports" data-thumb="sports">' + SPORTS_ICON + '</span>';
    }
    const game = D.games[gameId] || { accent: 'var(--surface-3)', name: gameName || '?' };
    return '<span class="win-thumb" data-thumb="' + esc(gameId) + '" style="background:' + game.accent + '">' +
      '<b>' + esc(game.name.slice(0, 1)) + '</b></span>';
  };

  D.applyThumbArt = (root) => {
    D.$$('[data-thumb]', root || document).forEach((el) => {
      const id = el.dataset.thumb;
      if (id === 'sports') D.Art.apply(el, 'sports', 'logo');
      else D.Art.apply(el, 'games', id);
    });
  };

  function winCard(id, amount, user) {
    const game = D.games[id] || { name: id === 'sports' ? 'Sports' : '?' };
    return (
      '<div class="win-card">' +
        D.thumbHtml(id, game.name) +
        '<div class="win-meta">' +
          '<span class="win-amount">' + D.fmt(amount) + '</span>' +
          '<span class="win-game">' + esc(game.name) + '</span>' +
          '<span class="win-user">' + esc(user) + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function randomWin() {
    // sports bets show up in the feed too, with the gold sports mark
    const id = D.rand() < 0.15 ? 'sports' : GAME_IDS[D.randInt(GAME_IDS.length)];
    const amount = D.round2(1 + D.rand() * (winsMode === 'lucky' ? 9000 : 400));
    return winCard(id, amount, USERS[D.randInt(USERS.length)]);
  }

  function seedWins() {
    winsTrack.innerHTML = '';
    for (let i = 0; i < 14; i++) winsTrack.insertAdjacentHTML('beforeend', randomWin());
    D.applyThumbArt(winsTrack);
  }

  D.$$('.wins-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      D.$$('.wins-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      winsMode = tab.dataset.wins;
      seedWins();
    });
  });

  /** Real wins once the backend has some; the simulated strip stays as a fallback. */
  function realWins() {
    return D.Api.request('GET', '/api/feed?tab=' + (winsMode === 'lucky' ? 'lucky' : 'live') + '&limit=14')
      .then((data) => {
        const wins = (data.rows || []).filter((r) => r.payout > r.bet);
        if (!wins.length) return;
        winsTrack.innerHTML = wins.map((r) => winCard(r.gameId, r.payout, r.user)).join('');
        D.applyThumbArt(winsTrack);
      })
      .catch(() => {});
  }

  setInterval(() => {
    if (document.hidden || !D.$('#page-casino').classList.contains('active')) return;
    if (D.Wallet.isServer()) { realWins(); return; }
    winsTrack.insertAdjacentHTML('afterbegin', randomWin());
    D.applyThumbArt(winsTrack.firstElementChild);
    while (winsTrack.children.length > 16) winsTrack.lastElementChild.remove();
  }, 3200);

  /* ---------------- navigation ---------------- */
  function navigate(page) {
    const target = D.$('#page-' + page);
    if (!target) return;
    D.$$('.page').forEach((p) => p.classList.remove('active'));
    target.classList.add('active');
    D.$$('.rail-btn[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === page));
    D.$('#sidebar').classList.remove('open');
    window.scrollTo(0, 0);
    if (history.replaceState) history.replaceState(null, '', '#' + page);
  }

  D.navigate = navigate;

  document.addEventListener('click', (e) => {
    const navEl = e.target.closest('[data-nav]');
    if (!navEl) return;
    e.preventDefault();
    const page = navEl.dataset.nav;
    navigate(page);
    if (navEl.dataset.filter) {
      const tab = D.$('.cat-tab[data-filter="' + navEl.dataset.filter + '"]');
      if (tab) tab.click();
    }
  });

  /* ---------------- sidebar ---------------- */
  D.$('#sidebarToggle').addEventListener('click', () => D.$('#sidebar').classList.toggle('expanded'));
  D.$('#mobileMenu').addEventListener('click', () => D.$('#sidebar').classList.toggle('open'));
  D.$('#railSupport').addEventListener('click', () => D.toast('Support chat is not part of this demo', 'info'));
  D.$('#chatBtn').addEventListener('click', () => D.toast('Community chat coming soon', 'info'));
  D.$('#notifBtn').addEventListener('click', () => D.toast('No new notifications', 'info'));

  /* ---------------- cashier ---------------- */
  // Demo defaults; server mode replaces these with the real deposit wallets.
  const COINS = [
    { id: 'btc', name: 'Bitcoin', sym: 'BTC', color: '#f7931a', addr: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
    { id: 'eth', name: 'Ethereum', sym: 'ETH', color: '#627eea', addr: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' },
    { id: 'usdt', name: 'Tether', sym: 'USDT', color: '#26a17b', addr: 'TRX9NMDJKQb8bLFQe9oiGmBrGEtHHwHCCz' },
    { id: 'ltc', name: 'Litecoin', sym: 'LTC', color: '#a6a9aa', addr: 'ltc1q0wz5a5dp4w8vvhkxf75k6c7wkfqd0yfwkcxtmx' },
    { id: 'sol', name: 'Solana', sym: 'SOL', color: '#9945ff', addr: '7KYq3U8DsK82FmxZaBQ1uJUGKMrHFYhz6D3V2vqtApWQ' },
  ];

  D.setCoins = (list) => {
    if (!list || !list.length) return;
    COINS.length = 0;
    list.forEach((c) => COINS.push({
      id: c.sym.toLowerCase(), name: c.name, sym: c.sym,
      color: c.color, addr: c.address, network: c.network,
    }));
    coinId = COINS[0].id;
    paintCashier();
  };

  function coinHtml(coin, active) {
    return (
      '<button class="coin' + (active ? ' active' : '') + '" data-coin="' + coin.id + '">' +
        '<span class="coin-ico" style="background:' + coin.color + '">' + coin.sym.slice(0, 1) + '</span>' +
        '<span><span class="coin-name">' + coin.name + '</span><br><span class="coin-sym">' + coin.sym + '</span></span>' +
      '</button>'
    );
  }

  /** A genuine scannable QR of the address, or a placeholder if encoding fails. */
  function addressQr(address) {
    try {
      return D.QR.svg(address, { quiet: 2 });
    } catch (err) {
      return '<svg viewBox="0 0 24 24"><rect width="24" height="24" fill="#fff"/></svg>';
    }
  }

  const TX_COLOR = { Confirmed: 'var(--green)', Completed: 'var(--green)', Pending: 'var(--gold)', Rejected: 'var(--red)' };

  let coinId = 'btc';
  const currentCoin = () => COINS.filter((c) => c.id === coinId)[0] || COINS[0];

  function paintCashier() {
    const coin = currentCoin();
    D.$('#depositCoins').innerHTML = COINS.map((c) => coinHtml(c, c.id === coinId)).join('');
    D.$('#withdrawCoins').innerHTML = COINS.map((c) => coinHtml(c, c.id === coinId)).join('');
    D.$('#depositAddress').textContent = coin.addr;
    D.$('#depositQr').innerHTML = addressQr(coin.addr);
    const net = D.$('#depNetwork');
    net.textContent = coin.network || '';
    net.hidden = !coin.network;
    D.$('#wdAddress').placeholder = coin.addr.slice(0, 6) + '…';
    D.$('#wdAvailable').textContent = D.fmt(D.Store.balance);
    paintTransactions();
  }

  /** Small "your deposits so far" list under the address, so arrivals are visible. */
  function paintRecentDeposits(rows) {
    const box = D.$('#depRecent');
    if (!box || D.$('#depServer').hidden) return;
    const deposits = rows.filter((tx) => tx.type === 'Deposit').slice(0, 4);
    if (!deposits.length) {
      box.innerHTML = '<div class="dep-recent-empty">No deposits yet. Send to the address above and it lands by itself.</div>';
      return;
    }
    box.innerHTML = '<div class="dep-recent-head">Recent deposits</div>' + deposits.map((tx) =>
      '<div class="dep-recent-row">' +
        '<span>' + D.fmt(tx.amount) + '</span>' +
        '<span class="muted">' + tx.asset + ' · ' + D.timeAgo(tx.ts) + '</span>' +
        '<span style="color:' + (TX_COLOR[tx.status] || 'var(--text-2)') + ';font-weight:700">' + tx.status + '</span>' +
      '</div>'
    ).join('');
  }

  function paintTransactions() {
    const list = D.$('#txList');
    D.Wallet.transactions().then((rows) => {
      paintRecentDeposits(rows);
      list.innerHTML = rows.length
        ? rows.map((tx) =>
            '<div class="tx-row" title="' + (tx.address ? 'To ' + tx.address : '') + '">' +
            '<span class="muted">' + tx.type + '</span>' +
            '<span class="amt ' + (tx.amount >= 0 ? 'green' : 'red') + '">' + (tx.amount > 0 ? '+' : '') + D.fmt(tx.amount) + '</span>' +
            '<span>' + tx.asset + '</span>' +
            '<span style="color:' + (TX_COLOR[tx.status] || 'var(--text-2)') + ';font-weight:700">' + tx.status + '</span></div>'
          ).join('')
        : '<div class="bets-empty">No transactions yet</div>';
    }).catch(() => { list.innerHTML = '<div class="bets-empty">Could not load transactions</div>'; });
  }

  D.paintCashier = paintCashier;

  D.$('#cashierModal').addEventListener('click', (e) => {
    const coin = e.target.closest('[data-coin]');
    if (coin) { coinId = coin.dataset.coin; paintCashier(); }
    const seg = e.target.closest('.seg-btn');
    if (seg) {
      D.$$('.seg-btn').forEach((b) => b.classList.remove('active'));
      seg.classList.add('active');
      D.$$('#cashierModal .tab').forEach((t) => t.classList.remove('active'));
      D.$('#tab-' + seg.dataset.tab).classList.add('active');
    }
    if (e.target === e.currentTarget || e.target.closest('[data-close]')) closeCashier();
  });

  function openCashier(tab) {
    paintCashier();
    if (typeof tab === 'string') {
      const seg = D.$('.seg-btn[data-tab="' + tab + '"]');
      if (seg) seg.click();
    }
    D.$('#cashierModal').hidden = false;
    document.body.classList.add('modal-open');
  }
  D.openCashier = openCashier;
  function closeCashier() {
    D.$('#cashierModal').hidden = true;
    if (D.$('#gameModal').hidden) document.body.classList.remove('modal-open');
  }

  D.$('#cashierBtn').addEventListener('click', openCashier);
  D.$('#walletBtn').addEventListener('click', openCashier);
  D.$('#profileCashier').addEventListener('click', openCashier);

  D.$('#copyAddress').addEventListener('click', () => {
    const text = D.$('#depositAddress').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    D.toast('Address copied', 'info');
  });

  D.$('#fakeDeposit').addEventListener('click', () => {
    const coin = currentCoin();
    if (!D.Wallet.isServer()) {
      D.Wallet.deposit(coin.sym, 500);
      paintCashier();
      D.toast('Added $500 play money', 'win');
      return;
    }
    const amount = D.round2(parseFloat(D.$('#depAmount').value));
    if (!(amount > 0)) { D.toast('Enter the amount you sent', 'info'); return; }
    D.Wallet.deposit(coin.sym, amount, coin.addr).then(() => {
      D.$('#depAmount').value = '';
      paintTransactions();
      D.toast('Deposit submitted — waiting for confirmation', 'info');
    }).catch((err) => D.toast(err.message, 'lose'));
  });

  D.$('#wdSubmit').addEventListener('click', () => {
    const amount = D.round2(parseFloat(D.$('#wdAmount').value));
    const address = D.$('#wdAddress').value.trim();
    if (!address) { D.toast('Enter a wallet address', 'info'); return; }
    if (!(amount >= 20)) { D.toast('Minimum withdrawal is $20', 'info'); return; }
    D.Wallet.withdraw(currentCoin().sym, address, amount).then(() => {
      D.$('#wdAmount').value = '';
      paintCashier();
      D.toast('Withdrawal requested — pending review', 'win');
    }).catch((err) => D.toast(err.message || 'Not enough balance', 'lose'));
  });

  D.$('#gameModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget || e.target.closest('[data-close]')) D.closeGame();
  });

  /* ---------------- keyboard ---------------- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!D.$('#cashierModal').hidden) closeCashier();
      else D.closeGame();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      navigate('casino');
      D.$('#searchInput').focus();
    }
  });

  /* ---------------- static page data ---------------- */
  D.$('#promoGrid').innerHTML = [
    { tag: 'Daily', title: '10% Rakeback', copy: 'Collect a slice of every wager back, every single day.', color: '#00e676' },
    { tag: 'Weekly', title: '$15,000 Race', copy: 'The ten biggest wagerers split the pool every Sunday.', color: '#4d8dff' },
    { tag: 'VIP', title: 'Status Match', copy: 'Bring your rank from another site and we match it.', color: '#ffcc33' },
    { tag: 'Originals', title: 'Multiplier Drops', copy: 'Hit 100× on any original and grab a bonus drop.', color: '#8b5cff' },
  ].map((p) =>
    '<div class="promo">' +
      '<div class="promo-icon" style="background:' + p.color + '1f;color:' + p.color + '">' +
        '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8L12 3Z"/></svg></div>' +
      '<span class="tag">' + p.tag + '</span>' +
      '<h3>' + p.title + '</h3>' +
      '<p>' + p.copy + '</p>' +
      '<button class="btn btn-ghost" data-nav="casino">Play now</button>' +
    '</div>'
  ).join('');

  /* ---------------- wallet bindings ---------------- */
  D.$('#resetBalance').addEventListener('click', () => {
    D.Store.reset();
    D.toast('Demo balance reset to $1,000', 'info');
  });

  function paintBets(state) {
    const list = D.$('#myBets');
    if (!state.history.length) {
      list.innerHTML = '<div class="bets-empty">No bets yet — open a game from the lobby.</div>';
      return;
    }
    list.innerHTML = state.history.map((b) => {
      const profit = D.round2(b.payout - b.bet);
      return (
        '<div class="bet-row">' +
          D.thumbHtml(b.gameId, b.game).replace('win-thumb', 'win-thumb bet-icon') +
          '<span><span class="bet-name">' + b.game + '</span><br><span class="bet-time">' + D.timeAgo(b.ts) + ' · ' + D.fmt(b.bet) + '</span></span>' +
          '<span class="bet-mult">' + (b.multiplier ? D.fmtMult(b.multiplier) : '0\u00d7') + '</span>' +
          '<span class="bet-amount ' + (profit >= 0 ? 'win' : 'loss') + '">' + (profit >= 0 ? '+' : '') + D.fmt(profit) + '</span>' +
        '</div>'
      );
    }).join('');
    D.applyThumbArt(list);
  }

  D.Store.onChange((state) => {
    D.$('#walletAmount').textContent = D.fmt(state.balance);
    D.$('#profileBalance').textContent = D.fmt(state.balance);
    D.$('#statWagered').textContent = D.fmt(state.wagered);
    D.$('#statBets').textContent = state.bets.toLocaleString();
    D.$('#statWon').textContent = D.fmt(state.won);
    D.$('#statWinRate').textContent = state.bets ? Math.round((state.wins / state.bets) * 100) + '%' : '0%';
    const gameBalance = D.$('#gameBalance');
    if (gameBalance) gameBalance.textContent = D.fmt(state.balance);
    if (!D.$('#cashierModal').hidden) D.$('#wdAvailable').textContent = D.fmt(state.balance);
    paintBets(state);
  });

  /* ---------------- boot ---------------- */
  D.Art.apply(D.$('#bannerRace'), 'banners', 'race');
  D.Art.apply(D.$('#bannerVip'), 'banners', 'vip');
  seedWins();
  renderGrid();

  const hash = (location.hash || '').replace('#', '');
  if (hash.indexOf('game=') === 0) {
    navigate('casino');
    const id = hash.split('=')[1];
    if (D.hasGame(id)) D.openGame(id);
  } else if (hash && D.$('#page-' + hash)) {
    navigate(hash);
  }
})(window.Dicey);
