/* ============================================================
   Dicey — sportsbook: fixtures, single-match view and bet slip

   Fixtures paint immediately, prices arrive in batches and then
   refresh every 30 seconds, flashing green or red as they move.
   The price a bet is accepted at is always the one the server
   reads back from the feed.
   ============================================================ */

(function (D) {
  'use strict';

  const REFRESH_MS = 30000;
  const ODDS_CHUNK = 10;

  const sportsEl = D.$('#sbSports');
  const eventsEl = D.$('#sbEvents');
  const bodyEl = D.$('#slipBody');
  const titleEl = D.$('#sbTitle');
  const subEl = D.$('#sbSub');
  const moreBtn = D.$('#sbMore');
  const slipEl = D.$('#slip');
  const searchEl = D.$('#sbSearch');

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------------- sport icons ---------------- */

  const BALL = '<circle cx="12" cy="12" r="8.5"/>';
  const OVAL = '<ellipse cx="12" cy="12" rx="9" ry="6" transform="rotate(-25 12 12)"/>';
  const ICONS = {
    1: BALL + '<path d="M12 7.5l3.2 2.3-1.2 3.7h-4l-1.2-3.7L12 7.5ZM12 3.5v4M4 10.2l4.3-.4M20 10.2l-4.3-.4M7.6 19.8l2.4-6.3M16.4 19.8L14 13.5"/>',
    13: BALL + '<path d="M6.2 6.2c3.6 1 6.4 3.8 7.4 7.4M17.8 6.2c-3.6 1-6.4 3.8-7.4 7.4"/>',
    18: BALL + '<path d="M12 3.5v17M3.5 12h17M6 5.5c2 2.2 3 4 3 6.5s-1 4.3-3 6.5M18 5.5c-2 2.2-3 4-3 6.5s1 4.3 3 6.5"/>',
    16: BALL + '<path d="M7.4 5.4c1.6 1.8 2.4 4 2.4 6.6s-.8 4.8-2.4 6.6M16.6 5.4c-1.6 1.8-2.4 4-2.4 6.6s.8 4.8 2.4 6.6"/>',
    91: BALL + '<path d="M12 3.5c-2 4-2 10 4.5 15M12 3.5c3 3 8 6 8.4 8M3.6 13c4-1.5 9 .5 12 7.2"/>',
    78: BALL + '<path d="M9 4.5l1.6 4M15 4.5l-1.6 4M4.6 9.4l3.6 2.2M19.4 9.4l-3.6 2.2M12 20v-4.4"/>',
    17: '<path d="M4 5.5l6.5 10.5c1 1.6 2.6 2.5 4.5 2.5H20"/><path d="M4 5.5h3"/><circle cx="7.5" cy="18.5" r="2.2"/>',
    12: OVAL + '<path d="M9 15l6-6M10.5 11l1.5 1.5M12.5 9l1.5 1.5"/>',
    151: '<path d="M7.5 8.5h9a4.5 4.5 0 0 1 4.3 5.8l-.6 2a2.4 2.4 0 0 1-4.4.4L14.4 15H9.6l-1.4 1.7a2.4 2.4 0 0 1-4.4-.4l-.6-2A4.5 4.5 0 0 1 7.5 8.5Z"/><path d="M7 11.8h2M8 10.8v2M15.5 11.3h.01M17.3 12.8h.01"/>',
    162: '<path d="M8 6h5.5A4.5 4.5 0 0 1 18 10.5v3A4.5 4.5 0 0 1 13.5 18H9a3 3 0 0 1-3-3V9a3 3 0 0 1 2-2.8Z"/><path d="M6 11.5h3.5M13 6V4.6"/>',
    9: '<path d="M8.5 5h5A4.5 4.5 0 0 1 18 9.5v2A4.5 4.5 0 0 1 13.5 16H10a3.5 3.5 0 0 1-3.5-3.5v-4A3.5 3.5 0 0 1 8.5 5Z"/><path d="M10 16v2.5h6V14M6.5 10h4"/>',
    14: BALL + '<path d="M17 7L21 3"/>',
    3: '<path d="M6 18l8-8M4.6 16.6l2.8 2.8"/><path d="M12.5 8.5l3-3a2 2 0 0 1 2.8 2.8l-3 3Z"/><circle cx="18.5" cy="16.5" r="2.2"/>',
    15: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/><path d="M15.5 8.5L21 3M18 3h3v3"/>',
    92: '<path d="M13.6 4.2a5.5 5.5 0 0 1 3 9.2l-6.6 6.6-3.4-3.4 6.6-6.6a5.5 5.5 0 0 1 .4-5.8Z"/><circle cx="7" cy="7" r="2"/>',
    94: '<path d="M12 3.5l3.5 6.5-3.5 2-3.5-2L12 3.5Z"/><path d="M12 12l4 8.5M12 12l-4 8.5"/>',
    8: OVAL + '<path d="M9 15l6-6"/>',
    19: OVAL + '<path d="M9 15l6-6"/>',
    36: OVAL,
    83: BALL + '<path d="M12 7.5l3.2 2.3-1.2 3.7h-4l-1.2-3.7L12 7.5Z"/>',
    2: '<path d="M7 20V13a5 5 0 0 1 10 0v7M9.5 20v-4.5M14.5 20v-4.5M7 13c-1.5-1-2-2.6-2-4.5C5 5.5 8 3.5 12 3.5s7 2 7 5c0 1.9-.5 3.5-2 4.5"/>',
    4: '<path d="M4 15c2-1 3-3 4-5s2.5-3 4.5-3 3.5 1.5 4 3 1.5 3 3.5 4M6 15l1.5 4.5M18 14l-1.5 5.5M10 17.5h4"/>',
    66: BALL + '<circle cx="16.5" cy="7.5" r="1.6"/>',
    75: '<path d="M6 4v16M18 4v16M6 9h12"/><circle cx="12" cy="14.5" r="3"/>',
    90: '<path d="M5 4.5l5.5 12c.8 1.7 2.4 2.7 4.3 2.7H20"/><circle cx="7.5" cy="19" r="2"/>',
    95: BALL + '<path d="M12 3.5c-2 4-2 10 4.5 15M3.6 13c4-1.5 9 .5 12 7.2"/>',
    110: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 15.5c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0M2.5 19.5c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0"/>',
    107: '<path d="M12.5 3.6a6 6 0 0 1 3.4 10.3L9.4 20.4 6 17l6.5-6.5a6 6 0 0 1 0-6.9Z"/><path d="M9 6.5l4.5 4.5"/>',
  };
  const sportIcon = (id) => '<svg class="sb-ico" viewBox="0 0 24 24">' + (ICONS[id] || BALL) + '</svg>';

  /* ---------------- promo banners ---------------- */

  // Artwork dropped into assets/img/promo/ takes over automatically (see the
  // README there for names); until then each banner draws itself.
  const PROMOS = [
    {
      id: 'sports-bonus', theme: 'gold',
      badge: 'Brand New!', title: '100% Sports Bonus',
      sub: 'Get 100% Sports Bonus on First Deposit!', action: 'deposit',
    },
    {
      id: 'sportsbook-live', theme: 'purple',
      badge: 'Sportbook!', title: 'Sportsbook is Live Now!',
      sub: '28 sports, thousands of matches, prices that move live.', action: 'browse',
    },
    {
      id: 'level-up', theme: 'sunset',
      badge: 'Refreshed!', title: 'Boost Your Level Up!',
      sub: 'Earn 3x more XP while playing sports!', action: 'vip',
    },
  ];

  const promosEl = D.$('#sbPromos');

  function renderPromos() {
    promosEl.innerHTML = PROMOS.map((promo) =>
      '<button class="sb-promo ' + promo.theme + '" data-promo="' + promo.id + '">' +
        '<span class="sb-promo-art" aria-hidden="true">' + promoArt(promo.theme) + '</span>' +
        '<span class="sb-promo-copy">' +
          '<span class="sb-promo-badge">' +
            '<svg viewBox="0 0 24 24"><path d="M12 3l1.9 4.6L18.5 9l-3.4 3.2.8 4.8L12 14.8 8.1 17l.8-4.8L5.5 9l4.6-1.4L12 3Z"/></svg>' +
            esc(promo.badge) +
          '</span>' +
          '<b class="sb-promo-title">' + esc(promo.title) + '</b>' +
          '<span class="sb-promo-sub">' + esc(promo.sub) + '</span>' +
        '</span>' +
      '</button>'
    ).join('');

    // swap in the operator's artwork when a file for it exists
    PROMOS.forEach((promo) => {
      D.Art.apply(promosEl.querySelector('[data-promo="' + promo.id + '"]'), 'promo', promo.id);
    });
  }

  /**
   * Stand-in artwork so the strip looks finished before the real files land.
   * The pa- prefix keeps these clear of class names the games already use.
   */
  function promoArt(theme) {
    if (theme === 'gold') {
      return '<i class="pa-blob pa-b1"></i><i class="pa-blob pa-b2"></i>' +
        '<i class="pa-wheel"></i><i class="pa-chip pa-c1"></i><i class="pa-chip pa-c2"></i>';
    }
    if (theme === 'purple') {
      return '<i class="pa-blob pa-b1"></i><i class="pa-cup"></i>' +
        '<i class="pa-ball pa-s1"></i><i class="pa-ball pa-s2"></i><i class="pa-ball pa-s3"></i>';
    }
    return '<i class="pa-blob pa-b1"></i><i class="pa-blob pa-b2"></i>' +
      '<i class="pa-gem pa-g1"></i><i class="pa-gem pa-g2"></i><i class="pa-gem pa-g3"></i>';
  }

  promosEl.addEventListener('click', (e) => {
    const card = e.target.closest('[data-promo]');
    if (!card) return;
    const promo = PROMOS.filter((p) => p.id === card.dataset.promo)[0];
    if (!promo) return;

    if (promo.action === 'deposit') {
      if (D.openCashier) D.openCashier('deposit');
    } else if (promo.action === 'vip') {
      D.navigate('vip');
    } else if (searchEl) {
      sportsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      searchEl.focus();
    }
  });

  /* ---------------- state ---------------- */

  const state = {
    catalog: [],
    sportId: 1,
    sportName: 'Soccer',
    page: 1,
    events: [],
    query: '',
    view: 'list',
    event: null,
    marketFilter: 'main',
    tab: 'slip',
    mode: 'single',
    picks: [],
    stakes: {},
    comboStake: 10,
    placed: null,
    bets: [],
    betFilter: 'pending',
    useFreeBet: false,
    acceptChanges: true,
    prices: {},
  };

  const money = (n) => D.fmt(n);
  const price = (n) => Number(n).toFixed(2);

  function kickoff(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today ' + time;
    if (new Date(today.getTime() + 864e5).toDateString() === date.toDateString()) return 'Tomorrow ' + time;
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + time;
  }

  /** A crest when the feed has one, otherwise the initial. */
  function crest(name, logo, extra) {
    const cls = 'sb-badge' + (extra ? ' ' + extra : '');
    if (logo) {
      return '<span class="' + cls + ' has-logo"><img src="' + esc(logo) + '" alt="" loading="lazy"' +
        ' onerror="this.parentNode.classList.remove(\'has-logo\');this.parentNode.textContent=\'' +
        esc(String(name || '?').slice(0, 1).toUpperCase()) + '\'"></span>';
    }
    return '<span class="' + cls + '">' + esc(String(name || '?').slice(0, 1).toUpperCase()) + '</span>';
  }

  /* ---------------- sports rail ---------------- */

  function renderSports() {
    sportsEl.innerHTML = state.catalog.map((sport) =>
      '<button class="sb-sport' + (sport.id === state.sportId ? ' active' : '') + '" data-sport="' + sport.id + '">' +
        sportIcon(sport.id) + '<span>' + esc(sport.name) + '</span></button>'
    ).join('');
    const active = sportsEl.querySelector('.sb-sport.active');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  sportsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sport]');
    if (!btn) return;
    state.sportId = parseInt(btn.dataset.sport, 10);
    const sport = state.catalog.filter((s) => s.id === state.sportId)[0];
    state.sportName = sport ? sport.name : 'Sport';
    state.page = 1;
    state.events = [];
    state.query = '';
    if (searchEl) searchEl.value = '';
    showList();
    renderSports();
    loadEvents();
  });

  /* ---------------- fixtures ---------------- */

  function loadEvents(append) {
    if (!append) {
      titleEl.textContent = state.sportName;
      subEl.textContent = 'Loading matches…';
      eventsEl.innerHTML = skeletonRows(6);
    }
    return D.Api.request('GET', '/api/sports/events?sport_id=' + state.sportId + '&page=' + state.page)
      .then((data) => {
        state.events = append ? state.events.concat(data.events) : data.events;
        subEl.textContent = data.total + ' upcoming ' + state.sportName.toLowerCase() + ' matches';
        moreBtn.hidden = state.events.length >= data.total || state.page >= 20;
        renderEvents();
        loadOdds(state.events.slice(0, 20).map((e) => e.id));
      })
      .catch((err) => {
        eventsEl.innerHTML = '<div class="sb-empty">' + esc(err.message || 'Could not load the feed') + '</div>';
        subEl.textContent = 'Feed unavailable';
      });
  }

  function runSearch(query) {
    state.query = query;
    titleEl.textContent = 'Search';
    subEl.textContent = 'Looking for "' + query + '"…';
    eventsEl.innerHTML = skeletonRows(4);
    moreBtn.hidden = true;
    return D.Api.request('GET', '/api/sports/search?sport_id=' + state.sportId + '&q=' + encodeURIComponent(query))
      .then((data) => {
        state.events = data.events || [];
        subEl.textContent = state.events.length + ' match' + (state.events.length === 1 ? '' : 'es') +
          ' matching "' + query + '" in ' + state.sportName.toLowerCase();
        renderEvents();
        loadOdds(state.events.slice(0, 20).map((e) => e.id));
      })
      .catch(() => { eventsEl.innerHTML = '<div class="sb-empty">Search failed, try again.</div>'; });
  }

  if (searchEl) {
    let timer = 0;
    searchEl.addEventListener('input', () => {
      clearTimeout(timer);
      const query = searchEl.value.trim();
      timer = setTimeout(() => {
        if (query.length >= 2) runSearch(query);
        else if (state.query) { state.query = ''; state.page = 1; loadEvents(); }
      }, 350);
    });
  }

  const skeletonRows = (n) => new Array(n).fill(
    '<div class="sb-event skeleton"><div class="sb-event-row">' +
      '<div class="sb-teams"><div class="sb-team"><span class="sk sk-badge"></span><span class="sk sk-line"></span></div>' +
      '<div class="sb-team"><span class="sk sk-badge"></span><span class="sk sk-line"></span></div></div>' +
      '<div class="sb-when"><span class="sk sk-small"></span></div>' +
      '<div class="sb-odds"><span class="sk sk-odd"></span><span class="sk sk-odd"></span><span class="sk sk-odd"></span></div>' +
      '<span class="sk sk-more"></span></div></div>').join('');

  function oddsButton(event, market, selection) {
    const active = state.picks.some((p) => p.selectionId === selection.id);
    return '<button class="sb-odd' + (active ? ' active' : '') + '"' +
      ' data-pick="' + esc(selection.id) + '"' +
      ' data-fi="' + esc(event.id) + '"' +
      ' data-market="' + esc(market) + '"' +
      ' data-label="' + esc(selection.label) + '"' +
      ' data-odds="' + selection.odds + '">' +
      '<span class="sb-odd-label">' + esc(selection.label) + '</span>' +
      '<span class="sb-odd-price">' + price(selection.odds) + '</span>' +
      '<span class="sb-arrow"></span>' +
    '</button>';
  }

  function renderEvents() {
    if (!state.events.length) {
      eventsEl.innerHTML = '<div class="sb-empty">' +
        (state.query ? 'Nothing matched "' + esc(state.query) + '".' : 'No upcoming matches for this sport right now.') +
        '</div>';
      return;
    }

    let lastLeague = null;
    eventsEl.innerHTML = state.events.map((event) => {
      const header = event.league !== lastLeague ? '<div class="sb-league">' + esc(event.league) + '</div>' : '';
      lastLeague = event.league;

      const odds = event.main
        ? event.main.selections.map((s) => oddsButton(event, event.main.name, s)).join('')
        : (event.main === null && event.oddsLoaded ? '<span class="sb-noodds">No prices yet</span>'
          : '<span class="sk sk-odd"></span><span class="sk sk-odd"></span><span class="sk sk-odd"></span>');

      return header +
        '<div class="sb-event" data-event="' + esc(event.id) + '">' +
          '<div class="sb-event-row">' +
            '<div class="sb-teams">' +
              '<div class="sb-team">' + crest(event.home, event.homeLogo) + '<span>' + esc(event.home) + '</span></div>' +
              '<div class="sb-team">' + crest(event.away, event.awayLogo) + '<span>' + esc(event.away) + '</span></div>' +
            '</div>' +
            '<div class="sb-when">' + esc(kickoff(event.time)) + '</div>' +
            '<div class="sb-odds">' + odds + '</div>' +
            '<button class="sb-expand" data-open="' + esc(event.id) + '" title="All markets">' +
              (event.marketCount ? '+' + event.marketCount : 'More') +
            '</button>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  /* ---------------- odds loading and movement ---------------- */

  function loadOdds(ids, animate) {
    const chunks = [];
    for (let i = 0; i < ids.length; i += ODDS_CHUNK) chunks.push(ids.slice(i, i + ODDS_CHUNK));
    chunks.forEach((group) => {
      D.Api.request('GET', '/api/sports/odds?ids=' + group.join(','))
        .then((data) => applyOdds(data.odds || {}, animate))
        .catch(() => {});
    });
  }

  function applyOdds(map, animate) {
    let structural = false;

    Object.keys(map).forEach((id) => {
      const event = state.events.filter((e) => e.id === id)[0];
      if (!event) return;
      const incoming = map[id];
      const had = event.main;

      event.oddsLoaded = true;
      event.marketCount = incoming.marketCount || event.marketCount;
      if (incoming.homeLogo) event.homeLogo = incoming.homeLogo;
      if (incoming.awayLogo) event.awayLogo = incoming.awayLogo;
      event.main = incoming.main;

      const sameShape = had && incoming.main &&
        had.selections.length === incoming.main.selections.length &&
        had.selections.every((s, i) => s.id === incoming.main.selections[i].id);

      if (!sameShape) { structural = true; return; }

      // same selections: nudge the numbers in place so the flash is visible
      incoming.main.selections.forEach((selection) => {
        const before = state.prices[selection.id];
        state.prices[selection.id] = selection.odds;
        if (!animate || before == null || before === selection.odds) return;
        flash(selection.id, selection.odds, selection.odds > before);
      });
    });

    if (structural) renderEvents();
    else patchRows();
  }

  /** Fills in prices and crests that arrived after the row was drawn. */
  function patchRows() {
    let needsRedraw = false;

    state.events.forEach((event) => {
      const row = eventsEl.querySelector('.sb-event[data-event="' + event.id + '"]');
      if (!row) return;

      const button = row.querySelector('[data-open]');
      if (button && event.marketCount) button.textContent = '+' + event.marketCount;

      const odds = row.querySelector('.sb-odds');
      if (odds && odds.querySelector('.sk')) {
        if (event.main) odds.innerHTML = event.main.selections.map((s) => oddsButton(event, event.main.name, s)).join('');
        else if (event.oddsLoaded) odds.innerHTML = '<span class="sb-noodds">No prices yet</span>';
      }

      const missingCrest = row.querySelector('.sb-badge:not(.has-logo)');
      if (missingCrest && (event.homeLogo || event.awayLogo)) needsRedraw = true;
    });

    if (needsRedraw) renderEvents();
  }

  /** Green with an up arrow when a price rises, red with a down arrow when it drops. */
  function flash(selectionId, odds, up) {
    D.$$('[data-pick="' + selectionId + '"]').forEach((button) => {
      const priceEl = button.querySelector('.sb-odd-price');
      if (priceEl) priceEl.textContent = price(odds);
      button.dataset.odds = odds;
      button.classList.remove('moved-up', 'moved-down');
      void button.offsetWidth;
      button.classList.add(up ? 'moved-up' : 'moved-down');
      setTimeout(() => button.classList.remove('moved-up', 'moved-down'), 2600);
    });

    // keep any slip pick in step with the live price
    state.picks.forEach((pick) => { if (pick.selectionId === selectionId) pick.odds = odds; });
    if (state.picks.some((p) => p.selectionId === selectionId)) renderSlip();
  }

  /* ---------------- single match view ---------------- */

  function openEvent(fi) {
    const known = state.events.filter((e) => e.id === fi)[0];
    state.view = 'event';
    state.event = null;
    state.marketFilter = 'main';
    D.navigate('event');
    if (history.replaceState) history.replaceState(null, '', '#event=' + fi);

    D.$('#evCrumbs').innerHTML = '<a data-back="1">All Sports</a><span>/</span>' +
      '<a data-back="1">' + esc(known ? known.sport : state.sportName) + '</a>' +
      (known ? '<span>/</span><b>' + esc(known.league) + '</b>' : '');
    D.$('#evHero').innerHTML = '<div class="ev-hero-card loading">Loading match…</div>';
    D.$('#evFilters').innerHTML = '';
    D.$('#evMarkets').innerHTML = skeletonRows(3);

    const query = '?FI=' + fi + (known
      ? '&home=' + encodeURIComponent(known.home) + '&away=' + encodeURIComponent(known.away) +
        '&league=' + encodeURIComponent(known.league) + '&time=' + known.time
      : '');

    return D.Api.request('GET', '/api/sports/event' + query)
      .then((data) => {
        state.event = data;
        data.markets.forEach((m) => m.selections.forEach((s) => { state.prices[s.id] = s.odds; }));
        renderEvent();
      })
      .catch((err) => {
        D.$('#evHero').innerHTML = '';
        D.$('#evMarkets').innerHTML = '<div class="sb-empty">' + esc(err.message || 'Odds unavailable') + '</div>';
      });
  }

  const MAIN_MARKETS = 6;

  function renderEvent() {
    const event = state.event;
    if (!event) return;

    D.$('#evHero').innerHTML =
      '<div class="ev-hero-card">' +
        '<div class="ev-side">' + crest(event.home, event.homeLogoBig || event.homeLogo, 'big') + '<b>' + esc(event.home) + '</b></div>' +
        '<div class="ev-mid">' +
          '<span class="ev-kick">' + esc(kickoff(event.time)) + '</span>' +
          '<span class="ev-vs">vs</span>' +
          '<span class="ev-league">' + esc(event.league) + '</span>' +
        '</div>' +
        '<div class="ev-side">' + crest(event.away, event.awayLogoBig || event.awayLogo, 'big') + '<b>' + esc(event.away) + '</b></div>' +
      '</div>';

    const showAll = state.marketFilter === 'more';
    D.$('#evFilters').innerHTML =
      '<label class="ev-find"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
        '<input type="search" id="evFind" placeholder="Find a market" value="' + esc(state.marketQuery || '') + '"></label>' +
      '<button class="ev-chip' + (!showAll ? ' active' : '') + '" data-filter="main">Main</button>' +
      '<button class="ev-chip' + (showAll ? ' active' : '') + '" data-filter="more">All ' + event.markets.length + ' markets</button>';

    const needle = (state.marketQuery || '').trim().toLowerCase();
    let markets = event.markets;
    if (needle) markets = markets.filter((m) => m.name.toLowerCase().indexOf(needle) > -1);
    else if (!showAll) markets = markets.slice(0, MAIN_MARKETS);

    D.$('#evMarkets').innerHTML = markets.length
      ? markets.map((market) => marketCard(event, market)).join('')
      : '<div class="sb-empty">No market matches that.</div>';

    const find = D.$('#evFind');
    if (find) {
      find.addEventListener('input', () => {
        state.marketQuery = find.value;
        const at = find.selectionStart;
        renderEvent();
        const again = D.$('#evFind');
        if (again) { again.focus(); again.setSelectionRange(at, at); }
      });
    }
  }

  /** Over/Under style markets read better as two labelled rows. */
  function marketCard(event, market) {
    const overUnder = market.selections.every((s) => /^(Over|Under)\b/.test(s.label));
    let inner;

    if (overUnder && market.selections.length > 2) {
      const rows = [['Over', market.selections.filter((s) => /^Over/.test(s.label))],
        ['Under', market.selections.filter((s) => /^Under/.test(s.label))]];
      inner = '<div class="ev-lines">' + rows.map(([side, list]) =>
        '<div class="ev-line"><span class="ev-line-side">' + side + '</span>' +
          '<div class="ev-line-odds">' + list.map((s) =>
            '<button class="sb-odd line' + (state.picks.some((p) => p.selectionId === s.id) ? ' active' : '') + '"' +
            ' data-pick="' + esc(s.id) + '" data-fi="' + esc(event.id) + '" data-market="' + esc(market.name) + '"' +
            ' data-label="' + esc(s.label) + '" data-odds="' + s.odds + '">' +
            '<span class="sb-odd-label">' + esc(s.label.replace(/^(Over|Under)\s*/, '')) + '</span>' +
            '<span class="sb-odd-price">' + price(s.odds) + '</span><span class="sb-arrow"></span></button>').join('') +
          '</div></div>').join('') + '</div>';
    } else {
      inner = '<div class="ev-market-odds">' +
        market.selections.map((s) => oddsButton(event, market.name, s)).join('') + '</div>';
    }

    return '<div class="ev-market"><div class="ev-market-name">' + esc(market.name) + '</div>' + inner + '</div>';
  }

  D.$('#evMarkets').addEventListener('click', (e) => {
    const odd = e.target.closest('[data-pick]');
    if (odd) togglePick(odd.dataset);
  });

  D.$('#evFilters').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    state.marketFilter = chip.dataset.filter;
    renderEvent();
  });

  D.$('#evCrumbs').addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) showList();
  });

  function showList() {
    state.view = 'list';
    state.event = null;
    D.navigate('sports');
  }

  eventsEl.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) { openEvent(open.dataset.open); return; }
    const odd = e.target.closest('[data-pick]');
    if (odd) togglePick(odd.dataset);
  });

  /* ---------------- refresh loop ---------------- */

  setInterval(() => {
    if (document.hidden) return;
    if (state.view === 'event' && state.event) {
      D.Api.request('GET', '/api/sports/event?FI=' + state.event.id)
        .then((data) => {
          const fresh = {};
          data.markets.forEach((m) => m.selections.forEach((s) => { fresh[s.id] = s.odds; }));
          let changed = 0;
          Object.keys(fresh).forEach((id) => {
            const before = state.prices[id];
            state.prices[id] = fresh[id];
            if (before != null && before !== fresh[id]) { flash(id, fresh[id], fresh[id] > before); changed++; }
          });
          const sameShape = state.event.markets.length === data.markets.length;
          state.event = Object.assign(data, { });
          if (!sameShape) renderEvent();
        })
        .catch(() => {});
      return;
    }
    if (!D.$('#page-sports').classList.contains('active')) return;
    const ids = state.events.slice(0, 20).map((e) => e.id);
    if (ids.length) loadOdds(ids, true);
  }, REFRESH_MS);

  /* ---------------- slip ---------------- */

  /** The crest for a selection: the team it names, or the home side. */
  function pickLogo(event, label) {
    const text = String(label || '').toLowerCase();
    const starts = (name) => name && text.indexOf(String(name).toLowerCase()) === 0;
    if (starts(event.away)) return event.awayLogo || '';
    if (starts(event.home)) return event.homeLogo || '';
    return event.homeLogo || '';
  }

  function togglePick(data) {
    const existing = state.picks.filter((p) => p.selectionId === data.pick)[0];
    if (existing) {
      state.picks = state.picks.filter((p) => p.selectionId !== data.pick);
    } else {
      const source = state.view === 'event' && state.event ? state.event
        : (state.events.filter((e) => e.id === data.fi)[0] || {});
      state.picks.push({
        selectionId: data.pick,
        fi: data.fi,
        odds: parseFloat(data.odds),
        market: data.market,
        label: data.label,
        logo: pickLogo(source, data.label),
        homeLogo: source.homeLogo || '',
        awayLogo: source.awayLogo || '',
        home: source.home || '',
        away: source.away || '',
        league: source.league || '',
        sportId: source.sportId || state.sportId,
        sport: source.sport || state.sportName,
        time: source.time || 0,
      });
      if (!state.stakes[data.pick]) state.stakes[data.pick] = 10;
      state.placed = null;
      state.tab = 'slip';
      slipEl.classList.add('open');
    }
    if (state.picks.length < 2 && state.mode === 'combo') state.mode = 'single';
    markActive();
    renderSlip();
  }

  /** Toggle the highlight on every visible copy of a price without redrawing. */
  function markActive() {
    D.$$('[data-pick]').forEach((button) => {
      button.classList.toggle('active', state.picks.some((p) => p.selectionId === button.dataset.pick));
    });
  }

  const comboOdds = () => state.picks.reduce((total, p) => total * p.odds, 1);
  const sameEventClash = () => {
    const seen = {};
    return state.picks.some((p) => (seen[p.fi] ? true : ((seen[p.fi] = true) && false)));
  };

  const freeBet = () => {
    const fb = D.Api.user && D.Api.user.freeBet;
    return fb && !fb.used ? fb : null;
  };

  const freeBetUsable = () => {
    const fb = freeBet();
    return !!(fb && state.picks.length === 1 && state.mode === 'single' &&
      state.picks[0].odds >= fb.minOdds && state.picks[0].odds <= fb.maxOdds);
  };

  function stakeFor(pick) {
    const fb = freeBet();
    if (state.useFreeBet && fb && state.picks.length === 1) return fb.amount;
    const value = state.stakes[pick.selectionId];
    return Number(value == null ? 10 : value) || 0;
  }

  function totals() {
    if (state.mode === 'combo') {
      const stake = Number(state.comboStake) || 0;
      return { bet: D.round2(stake), win: D.round2(stake * comboOdds()) };
    }
    let bet = 0, win = 0;
    state.picks.forEach((p) => { const s = stakeFor(p); bet += s; win += s * p.odds; });
    return { bet: D.round2(bet), win: D.round2(win) };
  }

  function pickCard(pick) {
    const locked = state.useFreeBet && freeBetUsable();
    const stake = stakeFor(pick);
    const stakeBox = state.mode === 'single'
      ? '<div class="slip-stake">' +
          '<span class="slip-stake-sign">$</span>' +
          '<input class="slip-stake-input" type="number" min="0" step="0.01" value="' + stake + '"' +
            ' data-stake="' + esc(pick.selectionId) + '"' + (locked ? ' disabled' : '') + '>' +
          '<div class="slip-chips">' +
            [10, 20, 100].map((v) => '<button class="slip-chip" data-chip="' + v + '" data-for="' +
              esc(pick.selectionId) + '"' + (locked ? ' disabled' : '') + '>$' + v + '</button>').join('') +
          '</div>' +
        '</div>' +
        '<div class="slip-towin">To win: <b>' + money(D.round2(stake * pick.odds)) + '</b></div>'
      : '';

    return '<div class="slip-pick">' +
      '<button class="slip-remove" data-remove="' + esc(pick.selectionId) + '" title="Remove">' +
        '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="slip-pick-top">' +
        crest(pick.label, pick.logo || pick.homeLogo) +
        '<div class="slip-pick-id">' +
          '<b>' + esc(pick.label) + '</b>' +
          '<span>' + esc(pick.market) + '</span>' +
          '<span class="muted">' + esc(pick.sport) + ' · ' + esc(pick.home) + ' v ' + esc(pick.away) + '</span>' +
          '<span class="muted">' + esc(kickoff(pick.time)) + '</span>' +
        '</div>' +
        '<span class="slip-price">' + price(pick.odds) + '</span>' +
      '</div>' + stakeBox +
    '</div>';
  }

  function renderSlip() {
    D.$('#slipCount').textContent = '(' + state.picks.length + ')';
    const pending = state.bets.filter((b) => b.status === 'pending').length;
    D.$('#betsCount').textContent = pending ? '(' + pending + ')' : '';
    D.$$('.slip-tab').forEach((t) => t.classList.toggle('active', t.dataset.slip === state.tab));

    if (state.tab === 'bets') return renderBets();
    if (state.placed) return renderPlaced();

    if (!state.picks.length) {
      bodyEl.innerHTML =
        '<div class="slip-empty">' +
          '<div class="slip-empty-icon"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 9h16M8 5v14"/></svg></div>' +
          '<b>Your slip is empty</b><span>Tap any price to add a pick.</span>' +
        '</div>';
      return;
    }

    const fb = freeBet();
    const canFreeBet = freeBetUsable();
    if (!canFreeBet) state.useFreeBet = false;
    const sums = totals();
    const clash = state.mode === 'combo' && sameEventClash();

    bodyEl.innerHTML =
      '<div class="slip-mode">' +
        '<button class="slip-mode-btn' + (state.mode === 'single' ? ' active' : '') + '" data-mode="single">Single</button>' +
        '<button class="slip-mode-btn' + (state.mode === 'combo' ? ' active' : '') + '" data-mode="combo"' +
          (state.picks.length < 2 ? ' disabled' : '') + '>Combo</button>' +
        '<button class="slip-gear' + (state.acceptChanges ? ' on' : '') + '" data-gear="1"' +
          ' title="' + (state.acceptChanges ? 'Accepting odds changes' : 'Rejecting odds changes') + '">' +
          '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/>' +
          '<path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/></svg></button>' +
      '</div>' +
      '<div class="slip-picks">' + state.picks.map(pickCard).join('') + '</div>' +
      (state.mode === 'combo'
        ? '<div class="slip-combo">' +
            '<div class="slip-combo-head"><span>' + state.picks.length + '-pick combo</span><b>' + price(comboOdds()) + '</b></div>' +
            '<div class="slip-stake"><span class="slip-stake-sign">$</span>' +
              '<input class="slip-stake-input" type="number" min="0" step="0.01" value="' + state.comboStake + '" data-stake="__combo">' +
              '<div class="slip-chips">' + [10, 20, 100].map((v) =>
                '<button class="slip-chip" data-chip="' + v + '" data-for="__combo">$' + v + '</button>').join('') + '</div>' +
            '</div></div>'
        : '') +
      (clash ? '<div class="slip-warn">Two picks from the same match cannot be combined.</div>' : '') +
      (canFreeBet
        ? '<label class="slip-freebet"><input type="checkbox" id="slipFreeBet"' + (state.useFreeBet ? ' checked' : '') + '>' +
            '<span>Use free bet <b>' + money(fb.amount) + '</b></span></label>'
        : (fb ? '<div class="slip-note">Free bet ' + money(fb.amount) + ' needs a single at odds ' +
            price(fb.minOdds) + '–' + price(fb.maxOdds) + '.</div>' : '')) +
      '<div class="slip-summary">' +
        '<div class="slip-row"><span>Bet</span><b>' + money(sums.bet) + '</b></div>' +
        '<div class="slip-row"><span>Potential Win</span><b>' + money(sums.win) + '</b></div>' +
      '</div>' +
      '<button class="btn btn-primary btn-block btn-lg slip-submit" id="slipSubmit"' + (clash ? ' disabled' : '') + '>' +
        'Submit | To Win: ' + money(sums.win) + '</button>' +
      '<button class="btn btn-ghost btn-block" id="slipClear">Clear Slip</button>';

    const check = D.$('#slipFreeBet');
    if (check) check.addEventListener('change', () => { state.useFreeBet = check.checked; renderSlip(); });
  }

  function renderPlaced() {
    bodyEl.innerHTML =
      '<div class="slip-done"><h3>You are all set!</h3><p>You can view your bets on the bets tab</p></div>' +
      betCard(state.placed, true) +
      '<button class="btn btn-primary btn-block btn-lg" id="slipContinue">Continue</button>';
  }

  function betCard(bet, placed) {
    const statusClass = bet.status === 'pending' ? 'pending' : bet.status === 'won' ? 'won' : bet.status === 'void' ? 'void' : 'lost';
    const stamp = new Date(bet.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return '<div class="bet-card">' +
      '<div class="bet-card-head">' +
        '<span class="bet-brand"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#00e676"/>' +
          '<circle cx="11" cy="11" r="2.6" fill="#04150c"/><circle cx="21" cy="11" r="2.6" fill="#04150c"/>' +
          '<circle cx="11" cy="21" r="2.6" fill="#04150c"/><circle cx="21" cy="21" r="2.6" fill="#04150c"/></svg>dicey</span>' +
        '<span class="bet-card-tags">' +
          (bet.freeBet ? '<span class="bet-status freebet">Free bet</span>' : '') +
          (placed
            ? '<span class="bet-status placed"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Placed</span>'
            : '<span class="bet-status ' + statusClass + '">' + esc(bet.status.charAt(0).toUpperCase() + bet.status.slice(1)) + '</span>') +
        '</span>' +
      '</div>' +
      '<div class="bet-card-type"><b>' + (bet.type === 'combo' ? bet.picks.length + '-pick Combo' : 'Single') + '</b>' +
        '<span>' + price(bet.odds) + '</span></div>' +
      '<div class="bet-card-money">' +
        '<div><span>Bet</span><b>' + money(bet.stake) + '</b></div>' +
        '<div><span>' + (bet.status === 'won' ? 'Won' : 'To Win') + '</span><b class="green">' +
          money(bet.status === 'won' ? bet.paid : bet.potential) + '</b></div>' +
      '</div>' +
      bet.picks.map((pick) =>
        '<div class="bet-pick">' + crest(pick.label, pick.logo || pick.homeLogo) +
          '<div class="bet-pick-id"><b>' + esc(pick.label) + '</b>' +
            '<span>' + esc(pick.market) + '</span>' +
            '<span class="muted">' + esc(pick.sport) + ' · ' + esc(pick.home) + ' v ' + esc(pick.away) + '</span>' +
            '<span class="muted">' + esc(kickoff(pick.time)) + '</span></div>' +
          '<span class="slip-price">' + price(pick.odds) + '</span>' +
        '</div>').join('') +
      '<div class="bet-card-meta"><span>ID: ' + esc(bet.id.slice(0, 6) + '…' + bet.id.slice(-4)) + '</span><span>' + esc(stamp) + '</span></div>' +
      '<div class="bet-card-actions">' +
        (placed
          ? '<button class="btn btn-ghost bet-reuse" data-reuse="' + esc(bet.id) + '">Reuse Pick</button>'
          : '<button class="btn btn-ghost bet-cashout" disabled>Cashout - unavailable</button>') +
        '<button class="btn btn-ghost bet-share" data-share="' + esc(bet.id) + '" title="Share">' +
          '<svg viewBox="0 0 24 24"><path d="M12 16V4M8 8l4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/></svg></button>' +
      '</div></div>';
  }

  function renderBets() {
    const filtered = state.bets.filter((b) => state.betFilter === 'all' || b.status === state.betFilter);
    bodyEl.innerHTML =
      '<select class="slip-filter" id="betFilter">' +
        ['pending', 'won', 'lost', 'void', 'all'].map((s) =>
          '<option value="' + s + '"' + (state.betFilter === s ? ' selected' : '') + '>' +
          s.charAt(0).toUpperCase() + s.slice(1) + '</option>').join('') + '</select>' +
      (filtered.length ? filtered.map((b) => betCard(b, false)).join('')
        : '<div class="slip-empty"><b>Nothing here</b><span>No ' + state.betFilter + ' bets yet.</span></div>');
  }

  /* ---------------- slip events ---------------- */

  D.$$('.slip-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (!slipEl.classList.contains('open')) { slipEl.classList.add('open'); return; }
      state.tab = tab.dataset.slip;
      if (state.tab === 'bets') loadBets();
      renderSlip();
    });
  });

  D.$('#slipCollapse').addEventListener('click', () => slipEl.classList.toggle('open'));

  bodyEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-gear]')) {
      state.acceptChanges = !state.acceptChanges;
      D.toast(state.acceptChanges ? 'Odds changes will be accepted' : 'Bets will be rejected if odds move', 'info');
      renderSlip();
      return;
    }
    const mode = e.target.closest('[data-mode]');
    if (mode && !mode.disabled) { state.mode = mode.dataset.mode; renderSlip(); return; }

    const remove = e.target.closest('[data-remove]');
    if (remove) {
      state.picks = state.picks.filter((p) => p.selectionId !== remove.dataset.remove);
      if (state.picks.length < 2) state.mode = 'single';
      markActive();
      renderSlip();
      return;
    }

    const chip = e.target.closest('[data-chip]');
    if (chip && !chip.disabled) {
      const value = parseFloat(chip.dataset.chip);
      if (chip.dataset.for === '__combo') state.comboStake = value; else state.stakes[chip.dataset.for] = value;
      renderSlip();
      return;
    }

    if (e.target.closest('#slipClear')) {
      state.picks = [];
      state.mode = 'single';
      markActive();
      renderSlip();
      return;
    }
    if (e.target.closest('#slipSubmit')) { submit(); return; }
    if (e.target.closest('#slipContinue')) { state.placed = null; state.tab = 'slip'; renderSlip(); return; }

    const reuse = e.target.closest('[data-reuse]');
    if (reuse) {
      const bet = state.placed && state.placed.id === reuse.dataset.reuse ? state.placed
        : state.bets.filter((b) => b.id === reuse.dataset.reuse)[0];
      if (bet) {
        state.picks = bet.picks.map((p) => Object.assign({}, p));
        state.picks.forEach((p) => { state.stakes[p.selectionId] = bet.stake; });
        state.mode = bet.type === 'combo' ? 'combo' : 'single';
        state.placed = null;
        state.tab = 'slip';
        renderSlip();
      }
      return;
    }

    const share = e.target.closest('[data-share]');
    if (share) {
      if (navigator.clipboard) navigator.clipboard.writeText(location.origin + '/#bet=' + share.dataset.share).catch(() => {});
      D.toast('Bet link copied', 'info');
    }
  });

  bodyEl.addEventListener('input', (e) => {
    const input = e.target.closest('[data-stake]');
    if (!input) return;
    const value = parseFloat(input.value);
    if (input.dataset.stake === '__combo') state.comboStake = isFinite(value) ? value : 0;
    else state.stakes[input.dataset.stake] = isFinite(value) ? value : 0;

    const sums = totals();
    const button = D.$('#slipSubmit');
    if (button) button.textContent = 'Submit | To Win: ' + money(sums.win);
    const rows = D.$$('.slip-summary b');
    if (rows[0]) rows[0].textContent = money(sums.bet);
    if (rows[1]) rows[1].textContent = money(sums.win);
  });

  bodyEl.addEventListener('change', (e) => {
    if (e.target.id === 'betFilter') { state.betFilter = e.target.value; renderBets(); }
  });

  /* ---------------- placing ---------------- */

  function loadBets() {
    if (!D.Api.user) { state.bets = []; return Promise.resolve(); }
    return D.Api.request('GET', '/api/sports/bets')
      .then((data) => { state.bets = data.bets || []; if (state.tab === 'bets') renderBets(); renderSlip(); })
      .catch(() => {});
  }

  async function submit() {
    if (D.Wallet.isServer() && !D.Api.user) { if (D.openAuth) D.openAuth('register'); return; }

    const useFree = state.useFreeBet && freeBetUsable();
    const button = D.$('#slipSubmit');
    if (button) { button.disabled = true; button.textContent = 'Placing…'; }

    const groups = state.mode === 'combo'
      ? [{ picks: state.picks, stake: Number(state.comboStake) || 0 }]
      : state.picks.map((p) => ({ picks: [p], stake: stakeFor(p) }));

    const send = (group) => D.Api.request('POST', '/api/sports/bet', {
      stake: group.stake,
      freeBet: useFree,
      picks: group.picks.map((p) => ({
        fi: p.fi, selectionId: p.selectionId, odds: p.odds, market: p.market, label: p.label,
        home: p.home, away: p.away, league: p.league, sportId: p.sportId, sport: p.sport, time: p.time,
      })),
    });

    try {
      let last = null;
      for (const group of groups) {
        if (!useFree && !(group.stake > 0)) throw new Error('Enter a stake for every pick');
        let data;
        try {
          data = await send(group);
        } catch (err) {
          const moved = err.data && err.data.odds && err.status === 409;
          if (!moved || !state.acceptChanges) throw err;
          const pick = group.picks.filter((p) => p.selectionId === String(err.data.selectionId))[0];
          if (pick) pick.odds = err.data.odds;
          D.toast('Odds moved to ' + price(err.data.odds) + ', placing at the new price', 'info');
          data = await send(group);
        }
        last = data.bet;
        D.Store.hydrate({ balance: data.balance });
        if (D.Api.user) D.Api.user.freeBet = data.freeBet;
        if (D.Deposits) D.Deposits.applyFreeBet(data.freeBet);
      }

      state.placed = last;
      state.picks = [];
      state.mode = 'single';
      state.useFreeBet = false;
      D.toast('Bet placed · to win ' + money(last.potential), 'win');
      markActive();
      renderSlip();
      loadBets();
    } catch (err) {
      D.toast(err.message || 'Could not place the bet', 'lose');
      if (err.data && err.data.odds) {
        const pick = state.picks.filter((p) => p.selectionId === String(err.data.selectionId))[0];
        if (pick) pick.odds = err.data.odds;
      }
      renderSlip();
    }
  }

  /* ---------------- boot ---------------- */

  let started = false;
  function start() {
    if (started) return;
    started = true;
    renderPromos();
    D.Api.request('GET', '/api/sports/catalog')
      .then((data) => {
        if (!data.enabled) {
          eventsEl.innerHTML = '<div class="sb-empty">The sportsbook feed is not configured. ' +
            'Put your b365api token in <code>data/b365-token.txt</code> and restart the server.</div>';
          subEl.textContent = 'Feed not configured';
          return;
        }
        state.catalog = data.sports;
        renderSports();
        loadEvents();
        loadBets();
      })
      .catch(() => { eventsEl.innerHTML = '<div class="sb-empty">The sportsbook needs the server running.</div>'; });
    renderSlip();
  }

  // the slip lives outside the pages so it can follow both sportsbook views
  function syncSlip() {
    const onSports = D.$('#page-sports').classList.contains('active') || D.$('#page-event').classList.contains('active');
    slipEl.hidden = !onSports;
    document.body.classList.toggle('sports-mode', onSports);
    if (onSports) start();
  }

  document.addEventListener('click', () => setTimeout(syncSlip, 0));
  window.addEventListener('hashchange', syncSlip);

  moreBtn.addEventListener('click', () => { state.page += 1; loadEvents(true); });

  const hash = location.hash || '';
  if (hash.indexOf('#event=') === 0) {
    start();
    openEvent(hash.slice(7).replace(/[^0-9]/g, ''));
  }
  syncSlip();

  D.Sportsbook = { start: start, state: state, reloadBets: loadBets, openEvent: openEvent, flash: flash };
})(window.Dicey);
