/* ============================================================
   Dicey — sportsbook page and bet slip

   Fixtures and odds come from the backend (bet365 prematch feed).
   The slip keeps picks locally, but the price a bet is accepted at
   is always the one the server reads back from the feed.
   ============================================================ */

(function (D) {
  'use strict';

  const sportsEl = D.$('#sbSports');
  const eventsEl = D.$('#sbEvents');
  const bodyEl = D.$('#slipBody');
  const titleEl = D.$('#sbTitle');
  const subEl = D.$('#sbSub');
  const moreBtn = D.$('#sbMore');

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const state = {
    catalog: [],
    sportId: 1,
    sportName: 'Soccer',
    page: 1,
    events: [],
    expanded: null,
    detail: {},
    tab: 'slip',
    mode: 'single',
    picks: [],
    stakes: {},
    comboStake: 10,
    placed: null,
    bets: [],
    betFilter: 'pending',
    loading: false,
  };

  const money = (n) => D.fmt(n);
  const price = (n) => Number(n).toFixed(2);

  function kickoff(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    const tomorrow = new Date(today.getTime() + 864e5).toDateString() === date.toDateString();
    if (sameDay) return 'Today ' + time;
    if (tomorrow) return 'Tomorrow ' + time;
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + time;
  }

  const badge = (text) => '<span class="sb-badge">' + esc(String(text || '?').slice(0, 1).toUpperCase()) + '</span>';

  /* ---------------- sports rail ---------------- */

  function renderSports() {
    sportsEl.innerHTML = state.catalog.map((sport) =>
      '<button class="sb-sport' + (sport.id === state.sportId ? ' active' : '') + '" data-sport="' + sport.id + '">' +
        esc(sport.name) + '</button>'
    ).join('');
  }

  sportsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sport]');
    if (!btn) return;
    state.sportId = parseInt(btn.dataset.sport, 10);
    const sport = state.catalog.filter((s) => s.id === state.sportId)[0];
    state.sportName = sport ? sport.name : 'Sport';
    state.page = 1;
    state.events = [];
    state.expanded = null;
    renderSports();
    loadEvents();
  });

  /* ---------------- events ---------------- */

  function loadEvents(append) {
    state.loading = true;
    if (!append) {
      titleEl.textContent = state.sportName;
      subEl.textContent = 'Loading matches…';
      eventsEl.innerHTML = '<div class="sb-empty">Loading odds…</div>';
    }
    return D.Api.request('GET', '/api/sports/events?sport_id=' + state.sportId + '&page=' + state.page)
      .then((data) => {
        state.events = append ? state.events.concat(data.events) : data.events;
        subEl.textContent = data.total + ' upcoming ' + state.sportName.toLowerCase() + ' matches';
        moreBtn.hidden = state.events.length >= data.total || state.page >= 20;
        renderEvents();
      })
      .catch((err) => {
        eventsEl.innerHTML = '<div class="sb-empty">' + esc(err.message || 'Could not load the feed') + '</div>';
        subEl.textContent = 'Feed unavailable';
      })
      .then(() => { state.loading = false; });
  }

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
    '</button>';
  }

  function renderEvents() {
    if (!state.events.length) {
      eventsEl.innerHTML = '<div class="sb-empty">No upcoming matches for this sport right now.</div>';
      return;
    }

    let lastLeague = null;
    eventsEl.innerHTML = state.events.map((event) => {
      const header = event.league !== lastLeague
        ? '<div class="sb-league">' + esc(event.league) + '</div>' : '';
      lastLeague = event.league;

      const main = event.main;
      const odds = main
        ? main.selections.map((s) => oddsButton(event, main.name, s)).join('')
        : '<span class="sb-noodds">No prices yet</span>';

      const open = state.expanded === event.id;
      const detail = open ? renderDetail(event) : '';

      return header +
        '<div class="sb-event' + (open ? ' open' : '') + '" data-event="' + esc(event.id) + '">' +
          '<div class="sb-event-row">' +
            '<div class="sb-teams">' +
              '<div class="sb-team">' + badge(event.home) + '<span>' + esc(event.home) + '</span></div>' +
              '<div class="sb-team">' + badge(event.away) + '<span>' + esc(event.away) + '</span></div>' +
            '</div>' +
            '<div class="sb-when">' + esc(kickoff(event.time)) + '</div>' +
            '<div class="sb-odds">' + odds + '</div>' +
            '<button class="sb-expand" data-expand="' + esc(event.id) + '" title="All markets">' +
              (event.marketCount ? '+' + event.marketCount : 'More') +
            '</button>' +
          '</div>' +
          detail +
        '</div>';
    }).join('');
  }

  function renderDetail(event) {
    const detail = state.detail[event.id];
    if (!detail) return '<div class="sb-markets"><div class="sb-empty">Loading markets…</div></div>';
    if (detail.error) return '<div class="sb-markets"><div class="sb-empty">' + esc(detail.error) + '</div></div>';
    if (!detail.markets.length) return '<div class="sb-markets"><div class="sb-empty">No markets published for this match.</div></div>';

    return '<div class="sb-markets">' + detail.markets.map((market) =>
      '<div class="sb-market">' +
        '<div class="sb-market-name">' + esc(market.name) + '</div>' +
        '<div class="sb-market-odds">' +
          market.selections.map((s) => oddsButton(event, market.name, s)).join('') +
        '</div>' +
      '</div>'
    ).join('') + '</div>';
  }

  eventsEl.addEventListener('click', (e) => {
    const expand = e.target.closest('[data-expand]');
    if (expand) {
      const fi = expand.dataset.expand;
      state.expanded = state.expanded === fi ? null : fi;
      renderEvents();
      if (state.expanded && !state.detail[fi]) loadDetail(fi);
      return;
    }

    const odd = e.target.closest('[data-pick]');
    if (odd) togglePick(odd.dataset);
  });

  function loadDetail(fi) {
    const event = state.events.filter((e) => e.id === fi)[0];
    if (!event) return;
    const query = '?FI=' + fi +
      '&home=' + encodeURIComponent(event.home) +
      '&away=' + encodeURIComponent(event.away) +
      '&league=' + encodeURIComponent(event.league) +
      '&time=' + event.time;

    D.Api.request('GET', '/api/sports/event' + query)
      .then((data) => { state.detail[fi] = data; })
      .catch((err) => { state.detail[fi] = { error: err.message || 'Odds unavailable', markets: [] }; })
      .then(() => { if (state.expanded === fi) renderEvents(); });
  }

  /* ---------------- slip ---------------- */

  function togglePick(data) {
    const existing = state.picks.filter((p) => p.selectionId === data.pick)[0];
    if (existing) {
      state.picks = state.picks.filter((p) => p.selectionId !== data.pick);
    } else {
      const event = state.events.filter((e) => e.id === data.fi)[0] || {};
      state.picks.push({
        selectionId: data.pick,
        fi: data.fi,
        odds: parseFloat(data.odds),
        market: data.market,
        label: data.label,
        home: event.home || '',
        away: event.away || '',
        league: event.league || '',
        sportId: event.sportId || state.sportId,
        sport: event.sport || state.sportName,
        time: event.time || 0,
      });
      if (!state.stakes[data.pick]) state.stakes[data.pick] = 10;
      state.placed = null;
      state.tab = 'slip';
    }
    if (state.picks.length < 2 && state.mode === 'combo') state.mode = 'single';
    renderEvents();
    renderSlip();
  }

  const comboOdds = () => state.picks.reduce((total, p) => total * p.odds, 1);
  const sameEventClash = () => {
    const seen = {};
    return state.picks.some((p) => (seen[p.fi] ? true : (seen[p.fi] = true) && false));
  };

  function singleTotals() {
    let bet = 0, win = 0;
    state.picks.forEach((p) => {
      const stake = Number(state.stakes[p.selectionId]) || 0;
      bet += stake;
      win += stake * p.odds;
    });
    return { bet: D.round2(bet), win: D.round2(win) };
  }

  function totals() {
    if (state.mode === 'combo') {
      const stake = Number(state.comboStake) || 0;
      return { bet: D.round2(stake), win: D.round2(stake * comboOdds()) };
    }
    return singleTotals();
  }

  const freeBet = () => {
    const fb = D.Api.user && D.Api.user.freeBet;
    return fb && !fb.used ? fb : null;
  };

  function pickCard(pick, index) {
    const stake = state.stakes[pick.selectionId] == null ? 10 : state.stakes[pick.selectionId];
    const stakeBox = state.mode === 'single'
      ? '<div class="slip-stake">' +
          '<span class="slip-stake-sign">$</span>' +
          '<input class="slip-stake-input" type="number" min="0" step="0.01" value="' + stake + '" data-stake="' + esc(pick.selectionId) + '">' +
          '<div class="slip-chips">' +
            [10, 20, 100].map((v) => '<button class="slip-chip" data-chip="' + v + '" data-for="' + esc(pick.selectionId) + '">$' + v + '</button>').join('') +
          '</div>' +
        '</div>' +
        '<div class="slip-towin">To win: <b>' + money(D.round2((Number(stake) || 0) * pick.odds)) + '</b></div>'
      : '';

    return '<div class="slip-pick">' +
      '<button class="slip-remove" data-remove="' + esc(pick.selectionId) + '" title="Remove">' +
        '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="slip-pick-top">' +
        badge(pick.label) +
        '<div class="slip-pick-id">' +
          '<b>' + esc(pick.label) + '</b>' +
          '<span>' + esc(pick.market) + '</span>' +
          '<span class="muted">' + esc(pick.sport) + ' · ' + esc(pick.home) + ' v ' + esc(pick.away) + '</span>' +
          '<span class="muted">' + esc(kickoff(pick.time)) + '</span>' +
        '</div>' +
        '<span class="slip-price">' + price(pick.odds) + '</span>' +
      '</div>' +
      stakeBox +
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
          '<b>Your slip is empty</b>' +
          '<span>Tap any price to add a pick.</span>' +
        '</div>';
      return;
    }

    const sums = totals();
    const fb = freeBet();
    const clash = state.mode === 'combo' && sameEventClash();
    const canFreeBet = fb && state.picks.length === 1 && state.picks[0].odds >= fb.minOdds && state.picks[0].odds <= fb.maxOdds;

    bodyEl.innerHTML =
      '<div class="slip-mode">' +
        '<button class="slip-mode-btn' + (state.mode === 'single' ? ' active' : '') + '" data-mode="single">Single</button>' +
        '<button class="slip-mode-btn' + (state.mode === 'combo' ? ' active' : '') + '" data-mode="combo"' +
          (state.picks.length < 2 ? ' disabled' : '') + '>Combo</button>' +
        '<button class="slip-gear" title="Slip settings"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/>' +
          '<path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/></svg></button>' +
      '</div>' +

      '<div class="slip-picks">' + state.picks.map(pickCard).join('') + '</div>' +

      (state.mode === 'combo'
        ? '<div class="slip-combo">' +
            '<div class="slip-combo-head"><span>' + state.picks.length + '-pick combo</span><b>' + price(comboOdds()) + '</b></div>' +
            '<div class="slip-stake">' +
              '<span class="slip-stake-sign">$</span>' +
              '<input class="slip-stake-input" type="number" min="0" step="0.01" value="' + state.comboStake + '" data-stake="__combo">' +
              '<div class="slip-chips">' +
                [10, 20, 100].map((v) => '<button class="slip-chip" data-chip="' + v + '" data-for="__combo">$' + v + '</button>').join('') +
              '</div>' +
            '</div>' +
          '</div>'
        : '') +

      (clash ? '<div class="slip-warn">Two picks from the same match cannot be combined.</div>' : '') +

      (canFreeBet
        ? '<label class="slip-freebet"><input type="checkbox" id="slipFreeBet">' +
            '<span>Use free bet <b>' + money(fb.amount) + '</b></span></label>'
        : (fb ? '<div class="slip-note">Free bet ' + money(fb.amount) + ' needs a single at odds ' +
            price(fb.minOdds) + '–' + price(fb.maxOdds) + '.</div>' : '')) +

      '<div class="slip-summary">' +
        '<div class="slip-row"><span>Bet</span><b>' + money(sums.bet) + '</b></div>' +
        '<div class="slip-row"><span>Potential Win</span><b>' + money(sums.win) + '</b></div>' +
      '</div>' +

      '<button class="btn btn-primary btn-block btn-lg slip-submit" id="slipSubmit"' + (clash ? ' disabled' : '') + '>' +
        'Submit | To Win: ' + money(sums.win) +
      '</button>' +
      '<button class="btn btn-ghost btn-block" id="slipClear">Clear Slip</button>';

    const check = D.$('#slipFreeBet');
    if (check) check.addEventListener('change', () => {
      const on = check.checked;
      D.$$('.slip-stake-input').forEach((i) => { i.disabled = on; });
      if (on) {
        state.stakes[state.picks[0].selectionId] = fb.amount;
        renderSlipKeepFree(true);
      } else renderSlip();
    });
  }

  function renderSlipKeepFree(checked) {
    renderSlip();
    const check = D.$('#slipFreeBet');
    if (check) {
      check.checked = checked;
      D.$$('.slip-stake-input').forEach((i) => { i.disabled = checked; });
    }
  }

  function renderPlaced() {
    const bet = state.placed;
    bodyEl.innerHTML =
      '<div class="slip-done">' +
        '<h3>You are all set!</h3>' +
        '<p>You can view your bets on the bets tab</p>' +
      '</div>' +
      betCard(bet, true) +
      '<button class="btn btn-primary btn-block btn-lg" id="slipContinue">Continue</button>';
  }

  function betCard(bet, placed) {
    const statusClass = bet.status === 'pending' ? 'pending' : bet.status === 'won' ? 'won' : bet.status === 'void' ? 'void' : 'lost';
    const stamp = new Date(bet.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return '<div class="bet-card">' +
      '<div class="bet-card-head">' +
        '<span class="bet-brand">' +
          '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#00e676"/>' +
          '<circle cx="11" cy="11" r="2.6" fill="#04150c"/><circle cx="21" cy="11" r="2.6" fill="#04150c"/>' +
          '<circle cx="11" cy="21" r="2.6" fill="#04150c"/><circle cx="21" cy="21" r="2.6" fill="#04150c"/></svg>' +
          'dicey</span>' +
        (placed
          ? '<span class="bet-status placed"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Placed</span>'
          : '<span class="bet-status ' + statusClass + '">' + esc(bet.status.charAt(0).toUpperCase() + bet.status.slice(1)) + '</span>') +
      '</div>' +

      '<div class="bet-card-type"><b>' + (bet.type === 'combo' ? bet.picks.length + '-pick Combo' : 'Single') + '</b>' +
        '<span>' + price(bet.odds) + '</span></div>' +

      '<div class="bet-card-money">' +
        '<div><span>Bet</span><b>' + money(bet.stake) + (bet.freeBet ? ' <em>free</em>' : '') + '</b></div>' +
        '<div><span>' + (bet.status === 'won' ? 'Won' : 'To Win') + '</span><b class="green">' + money(bet.status === 'won' ? bet.paid : bet.potential) + '</b></div>' +
      '</div>' +

      bet.picks.map((pick) =>
        '<div class="bet-pick">' +
          badge(pick.label) +
          '<div class="bet-pick-id">' +
            '<b>' + esc(pick.label) + '</b>' +
            '<span>' + esc(pick.market) + '</span>' +
            '<span class="muted">' + esc(pick.sport) + ' · ' + esc(pick.home) + ' v ' + esc(pick.away) + '</span>' +
            '<span class="muted">' + esc(kickoff(pick.time)) + '</span>' +
          '</div>' +
          '<span class="slip-price">' + price(pick.odds) + '</span>' +
        '</div>'
      ).join('') +

      '<div class="bet-card-meta"><span>ID: ' + esc(bet.id.slice(0, 6) + '…' + bet.id.slice(-4)) + '</span><span>' + esc(stamp) + '</span></div>' +

      '<div class="bet-card-actions">' +
        (placed
          ? '<button class="btn btn-ghost bet-reuse" data-reuse="' + esc(bet.id) + '">Reuse Pick</button>'
          : '<button class="btn btn-ghost bet-cashout" disabled>Cashout - unavailable</button>') +
        '<button class="btn btn-ghost bet-share" data-share="' + esc(bet.id) + '" title="Share">' +
          '<svg viewBox="0 0 24 24"><path d="M12 16V4M8 8l4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/></svg></button>' +
      '</div>' +
    '</div>';
  }

  function renderBets() {
    const filtered = state.bets.filter((b) => state.betFilter === 'all' || b.status === state.betFilter);
    bodyEl.innerHTML =
      '<select class="slip-filter" id="betFilter">' +
        ['pending', 'won', 'lost', 'void', 'all'].map((s) =>
          '<option value="' + s + '"' + (state.betFilter === s ? ' selected' : '') + '>' +
          s.charAt(0).toUpperCase() + s.slice(1) + '</option>').join('') +
      '</select>' +
      (filtered.length
        ? filtered.map((b) => betCard(b, false)).join('')
        : '<div class="slip-empty"><b>Nothing here</b><span>No ' + state.betFilter + ' bets yet.</span></div>');
  }

  /* ---------------- slip events ---------------- */

  D.$$('.slip-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.tab = tab.dataset.slip;
      if (state.tab === 'bets') loadBets();
      renderSlip();
    });
  });

  D.$('#slipCollapse').addEventListener('click', () => {
    D.$('#slip').classList.toggle('collapsed');
  });

  bodyEl.addEventListener('click', (e) => {
    const mode = e.target.closest('[data-mode]');
    if (mode && !mode.disabled) { state.mode = mode.dataset.mode; renderSlip(); return; }

    const remove = e.target.closest('[data-remove]');
    if (remove) {
      state.picks = state.picks.filter((p) => p.selectionId !== remove.dataset.remove);
      if (state.picks.length < 2) state.mode = 'single';
      renderEvents();
      renderSlip();
      return;
    }

    const chip = e.target.closest('[data-chip]');
    if (chip) {
      const value = parseFloat(chip.dataset.chip);
      if (chip.dataset.for === '__combo') state.comboStake = value;
      else state.stakes[chip.dataset.for] = value;
      renderSlip();
      return;
    }

    if (e.target.closest('#slipClear')) {
      state.picks = [];
      state.mode = 'single';
      renderEvents();
      renderSlip();
      return;
    }

    if (e.target.closest('#slipSubmit')) { submit(); return; }

    if (e.target.closest('#slipContinue')) {
      state.placed = null;
      state.tab = 'slip';
      renderSlip();
      return;
    }

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
      const link = location.origin + '/#bet=' + share.dataset.share;
      if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {});
      D.toast('Bet link copied', 'info');
    }
  });

  bodyEl.addEventListener('input', (e) => {
    const input = e.target.closest('[data-stake]');
    if (!input) return;
    const value = parseFloat(input.value);
    if (input.dataset.stake === '__combo') state.comboStake = isFinite(value) ? value : 0;
    else state.stakes[input.dataset.stake] = isFinite(value) ? value : 0;

    // update the totals without redrawing the inputs the player is typing in
    const sums = totals();
    const submit = D.$('#slipSubmit');
    if (submit) submit.textContent = 'Submit | To Win: ' + money(sums.win);
    const rows = D.$$('.slip-summary b');
    if (rows[0]) rows[0].textContent = money(sums.bet);
    if (rows[1]) rows[1].textContent = money(sums.win);
  });

  bodyEl.addEventListener('change', (e) => {
    if (e.target.id === 'betFilter') {
      state.betFilter = e.target.value;
      renderBets();
    }
  });

  /* ---------------- placing ---------------- */

  function loadBets() {
    if (!D.Api.user) { state.bets = []; return Promise.resolve(); }
    return D.Api.request('GET', '/api/sports/bets')
      .then((data) => { state.bets = data.bets || []; if (state.tab === 'bets') renderBets(); renderSlip(); })
      .catch(() => {});
  }

  async function submit() {
    if (D.Wallet.isServer() && !D.Api.user) {
      if (D.openAuth) D.openAuth('register');
      return;
    }

    const useFree = !!(D.$('#slipFreeBet') && D.$('#slipFreeBet').checked);
    const button = D.$('#slipSubmit');
    if (button) { button.disabled = true; button.textContent = 'Placing…'; }

    const groups = state.mode === 'combo'
      ? [{ picks: state.picks, stake: Number(state.comboStake) || 0 }]
      : state.picks.map((p) => ({ picks: [p], stake: Number(state.stakes[p.selectionId]) || 0 }));

    try {
      let last = null;
      for (const group of groups) {
        if (!useFree && !(group.stake > 0)) throw new Error('Enter a stake for every pick');
        const data = await D.Api.request('POST', '/api/sports/bet', {
          stake: group.stake,
          freeBet: useFree,
          picks: group.picks.map((p) => ({
            fi: p.fi, selectionId: p.selectionId, odds: p.odds, market: p.market, label: p.label,
            home: p.home, away: p.away, league: p.league, sportId: p.sportId, sport: p.sport, time: p.time,
          })),
        });
        last = data.bet;
        D.Store.hydrate({ balance: data.balance });
        if (D.Api.user) D.Api.user.freeBet = data.freeBet;
      }

      state.placed = last;
      state.picks = [];
      state.mode = 'single';
      D.toast('Bet placed · to win ' + money(last.potential), 'win');
      renderEvents();
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
      .catch(() => {
        eventsEl.innerHTML = '<div class="sb-empty">The sportsbook needs the server running.</div>';
      });
    renderSlip();
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-nav="sports"]')) start();
  });

  moreBtn.addEventListener('click', () => { state.page += 1; loadEvents(true); });
  D.$('#sbRefresh').addEventListener('click', () => { state.detail = {}; loadEvents(); });

  if ((location.hash || '').indexOf('sports') > -1) start();

  D.Sportsbook = { start: start, state: state, reloadBets: loadBets };
})(window.Dicey);
