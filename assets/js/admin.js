/* ============================================================
   Dicey — admin dashboard

   Players, their rounds, deposits and withdrawals. Pending
   requests wait here until they are confirmed or rejected.
   ============================================================ */

(function (D) {
  'use strict';

  const Api = D.Api;
  const totalsEl = D.$('#adminTotals');
  const pendingEl = D.$('#adminPending');
  const usersEl = D.$('#adminUsers');
  const userModal = D.$('#adminUserModal');
  const userBody = D.$('#adminUserBody');
  const userTitle = D.$('#adminUserTitle');

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const when = (ts) => (ts ? new Date(ts).toLocaleString() : '—');
  const short = (text, n) => (text && text.length > n ? text.slice(0, n) + '…' : text || '—');

  const STATUS_CLASS = { pending: 'gold', unclaimed: 'gold', confirmed: 'green', rejected: 'red' };
  const vipName = (wagered) => (D.Vip ? D.Vip.progress(wagered).rank.name : '—');

  /* ---------------- overview ---------------- */

  function load() {
    loadSportsBets();
    loadTrending();
    return Api.adminOverview()
      .then((data) => {
        renderTotals(data.totals);
        renderPending(data.pending);
        renderUsers(data.users);
      })
      .catch((err) => {
        totalsEl.innerHTML = '';
        pendingEl.innerHTML = '<div class="bets-empty">' + esc(err.message || 'Could not load') + '</div>';
        usersEl.innerHTML = '';
      });
  }

  function renderTotals(t) {
    const cards = [
      { label: 'Players', value: t.users, plain: true },
      { label: 'Deposited', value: D.fmt(t.deposited), color: 'var(--green)' },
      { label: 'Withdrawn', value: D.fmt(t.withdrawn), color: 'var(--red)' },
      { label: 'Player balances', value: D.fmt(t.balances), color: 'var(--gold)' },
      { label: 'Total wagered', value: D.fmt(t.wagered) },
      { label: 'House profit', value: D.fmt(t.houseProfit), color: t.houseProfit >= 0 ? 'var(--green)' : 'var(--red)' },
    ];
    totalsEl.innerHTML = cards.map((c) =>
      '<div class="stat"><b' + (c.color ? ' style="color:' + c.color + '"' : '') + '>' + esc(c.value) + '</b>' +
      '<span>' + esc(c.label) + '</span></div>'
    ).join('');
  }

  function renderPending(rows) {
    if (!rows.length) {
      pendingEl.innerHTML = '<div class="bets-empty">Nothing waiting for review</div>';
      return;
    }
    pendingEl.innerHTML = rows.map((tx) => {
      const unclaimed = tx.status === 'unclaimed';
      const detail = [
        tx.coin + (tx.crypto ? ' ' + tx.crypto : ''),
        tx.network || '',
        tx.address ? (tx.type === 'withdraw' ? '→ ' : 'from ') + short(tx.address, 24) : '',
        tx.txHash ? 'tx ' + short(tx.txHash, 14) : '',
        when(tx.ts),
        tx.note,
      ].filter(Boolean).join(' · ');

      return '<div class="admin-row">' +
        '<span class="tag-' + (tx.type === 'withdraw' ? 'out' : 'in') + '">' + esc(tx.type) + '</span>' +
        '<div class="admin-row-main">' +
          '<b>' + esc(tx.email || (unclaimed ? 'Unidentified sender' : 'unknown')) + '</b>' +
          (tx.bonus ? '<span class="pill-bonus">' + esc(tx.bonus) + '</span>' : '') +
          '<span class="muted">' + esc(detail) + '</span>' +
        '</div>' +
        '<b class="admin-amount">' + esc(tx.amount ? D.fmt(tx.amount) : 'set value') + '</b>' +
        (unclaimed
          ? '<div class="admin-row-actions">' +
              '<input class="field-inline slim" data-assign-email="' + esc(tx.id) + '" placeholder="player email">' +
              '<input class="field-inline slim" data-assign-amount="' + esc(tx.id) + '" type="number" step="0.01" placeholder="USD" value="' + (tx.amount || '') + '">' +
              '<button class="btn btn-primary" data-assign="' + esc(tx.id) + '">Credit</button>' +
            '</div>'
          : '<div class="admin-row-actions">' +
              '<button class="btn btn-primary" data-resolve="confirmed" data-tx="' + esc(tx.id) + '">Confirm</button>' +
              '<button class="btn btn-danger" data-resolve="rejected" data-tx="' + esc(tx.id) + '">Reject</button>' +
            '</div>') +
      '</div>';
    }).join('');
  }

  function renderUsers(users) {
    if (!users.length) {
      usersEl.innerHTML = '<tbody><tr><td class="bets-empty">No players yet</td></tr></tbody>';
      return;
    }
    const rows = users.map((u) =>
      '<tr data-user="' + esc(u.id) + '">' +
        '<td><b>' + esc(u.email) + '</b>' + (u.isAdmin ? '<span class="pill-admin">admin</span>' : '') +
          (u.blocked ? '<span class="pill-blocked">blocked</span>' : '') + '</td>' +
        '<td class="num gold">' + esc(D.fmt(u.balance)) + '</td>' +
        '<td class="num green">' + esc(D.fmt(u.totals.deposited)) + '</td>' +
        '<td class="num">' + esc(D.fmt(u.totals.withdrawn)) + '</td>' +
        '<td class="num">' + esc(D.fmt(u.totals.wagered)) + '</td>' +
        '<td>' + esc(vipName(u.totals.wagered)) + '</td>' +
        '<td class="num">' + esc(u.totals.bets) + '</td>' +
        '<td><code>' + esc(u.referralCode) + '</code></td>' +
        '<td>' + esc(u.referredBy || '—') + '</td>' +
        '<td>' + (u.promoCode
          ? '<code>' + esc(u.promoCode) + '</code>' + (u.bonus && !u.bonus.used ? '<span class="pill-bonus">bonus</span>' : '')
          : '—') + '</td>' +
        '<td class="mono">' + esc(u.lastIp || u.signupIp) + '</td>' +
        '<td class="muted">' + esc(when(u.lastSeenAt)) + '</td>' +
        '<td><button class="btn btn-ghost" data-open-user="' + esc(u.id) + '">Open</button></td>' +
      '</tr>'
    ).join('');

    usersEl.innerHTML =
      '<thead><tr>' +
        '<th>Email</th><th class="num">Balance</th><th class="num">Deposited</th><th class="num">Withdrawn</th>' +
        '<th class="num">Wagered</th><th>VIP</th><th class="num">Bets</th><th>Code</th><th>Referred by</th>' +
        '<th>Promo</th><th>IP</th><th>Last seen</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody>';
  }

  /* ---------------- sports bets ---------------- */

  const sportsBetsEl = D.$('#adminSportsBets');
  const sportsFilterEl = D.$('#adminSportsFilter');

  /** One sports bet with the buttons that settle it. */
  function sportsBetRow(bet, compact) {
    const picks = bet.picks.map((pick) =>
      '<span class="admin-pick">' + esc(pick.label) + ' <em>' + esc(pick.market) + '</em> ' +
      '<span class="muted">' + esc(pick.home) + ' v ' + esc(pick.away) + '</span> @' + Number(pick.odds).toFixed(2) +
      '</span>').join('');

    return '<div class="admin-row">' +
      '<span class="tag-' + (bet.status === 'won' ? 'in' : bet.status === 'lost' ? 'out' : 'neutral') + '">' +
        esc(bet.type === 'combo' ? bet.picks.length + '-pick' : 'single') + '</span>' +
      '<div class="admin-row-main">' +
        '<b>' + esc(bet.email || 'player') + (bet.freeBet ? '<span class="pill-bonus">free bet</span>' : '') + '</b>' +
        '<span class="muted">' + D.fmt(bet.stake) + ' @ ' + Number(bet.odds).toFixed(2) +
          ' → ' + D.fmt(bet.potential) + ' · ' + esc(when(bet.ts)) + '</span>' +
        '<span class="admin-picks">' + picks + '</span>' +
      '</div>' +
      '<span class="' + (STATUS_CLASS[bet.status] || '') + '"><b>' + esc(bet.status) + '</b></span>' +
      (bet.status === 'pending'
        ? '<div class="admin-row-actions">' +
            '<button class="btn btn-primary" data-settle="won" data-bet="' + esc(bet.id) + '">Win</button>' +
            '<button class="btn btn-danger" data-settle="lost" data-bet="' + esc(bet.id) + '">Loss</button>' +
            '<button class="btn btn-ghost" data-settle="void" data-bet="' + esc(bet.id) + '">Void</button>' +
          '</div>'
        : '<span class="muted">' + (bet.paid ? 'paid ' + D.fmt(bet.paid) : 'nothing paid') + '</span>') +
    '</div>';
  }

  function loadSportsBets() {
    if (!sportsBetsEl) return Promise.resolve();
    const status = sportsFilterEl ? sportsFilterEl.value : 'pending';
    return Api.request('GET', '/api/admin/sports/bets?status=' + status)
      .then((data) => {
        const bets = data.bets || [];
        sportsBetsEl.innerHTML = bets.length
          ? bets.map((bet) => sportsBetRow(bet)).join('')
          : '<div class="bets-empty">No ' + esc(status === 'all' ? '' : status) + ' sports bets.</div>';
      })
      .catch((err) => { sportsBetsEl.innerHTML = '<div class="bets-empty">' + esc(err.message || 'Could not load') + '</div>'; });
  }

  if (sportsFilterEl) sportsFilterEl.addEventListener('change', loadSportsBets);

  /** Win pays the potential, Void returns the stake, Loss pays nothing. */
  function settleBet(id, result) {
    return Api.request('POST', '/api/admin/sports/settle', { id: id, result: result })
      .then((data) => {
        const paid = data.bet.paid;
        D.toast('Marked ' + result + (paid ? ' · paid ' + D.fmt(paid) : ' · nothing paid'), result === 'lost' ? 'info' : 'win');
        loadSportsBets();
        const open = userBody.dataset.userId;
        if (!userModal.hidden && open) openUser(open);
        return load();
      })
      .catch((err) => D.toast(err.message || 'Could not settle', 'lose'));
  }

  /* ---------------- trending now ---------------- */

  const tnListEl = D.$('#tnList');
  const tnResultsEl = D.$('#tnResults');
  const tnSportEl = D.$('#tnSport');
  const tnQueryEl = D.$('#tnQuery');

  // what the strip is showing right now; saving pins exactly this
  let trending = [];

  const matchLabel = (event) => event.home + ' vs ' + event.away;

  function trendingRow(event) {
    return '<div class="admin-row">' +
      '<span class="tag-in">' + esc(event.league || event.sport || 'Match') + '</span>' +
      '<div class="admin-row-main"><b>' + esc(matchLabel(event)) + '</b>' +
        '<span class="muted">' + esc(when(event.time)) + '</span></div>' +
      '<div class="admin-row-actions">' +
        '<input class="field-inline slim" type="number" min="0" step="1" title="People watching"' +
          ' data-tn-watch="' + esc(event.id) + '" value="' + (event.watchers || 0) + '">' +
        '<button class="btn btn-danger" data-tn-remove="' + esc(event.id) + '">Remove</button>' +
      '</div></div>';
  }

  function renderTrending() {
    if (!tnListEl) return;
    tnListEl.innerHTML = trending.length
      ? trending.map(trendingRow).join('')
      : '<div class="bets-empty">Nothing pinned — the strip fills itself with the next MLB games.</div>';
  }

  function loadTrending() {
    if (!tnListEl) return Promise.resolve();
    return Api.request('GET', '/api/admin/sports/trending')
      .then((data) => { trending = data.events || []; renderTrending(); })
      .catch(() => { tnListEl.innerHTML = '<div class="bets-empty">Could not load the strip</div>'; });
  }

  /** Saving pins whatever is on the list, so an edit makes the strip explicit. */
  function saveTrending(list) {
    return Api.request('POST', '/api/admin/sports/trending', { events: list })
      .then((data) => {
        trending = data.events || [];
        renderTrending();
        D.toast('Trending strip updated', 'win');
      })
      .catch((err) => D.toast(err.message || 'Could not update the strip', 'lose'));
  }

  function fillSports() {
    if (!tnSportEl) return;
    Api.request('GET', '/api/sports/catalog')
      .then((data) => {
        tnSportEl.innerHTML = (data.sports || [])
          .map((s) => '<option value="' + s.id + '"' + (s.id === 16 ? ' selected' : '') + '>' + esc(s.name) + '</option>')
          .join('');
      })
      .catch(() => {});
  }

  function searchMatches() {
    const query = (tnQueryEl.value || '').trim();
    if (query.length < 2) { D.toast('Type at least two letters', 'info'); return; }
    tnResultsEl.innerHTML = '<div class="bets-empty">Searching…</div>';
    Api.request('GET', '/api/sports/search?sport_id=' + (tnSportEl.value || 1) + '&q=' + encodeURIComponent(query))
      .then((data) => {
        const events = data.events || [];
        tnResultsEl.innerHTML = events.length
          ? events.slice(0, 12).map((event) =>
              '<div class="admin-row">' +
                '<span class="tag-in">' + esc(event.league) + '</span>' +
                '<div class="admin-row-main"><b>' + esc(matchLabel(event)) + '</b>' +
                  '<span class="muted">' + esc(when(event.time)) + '</span></div>' +
                '<button class="btn btn-primary" data-tn-pin=\'' + esc(JSON.stringify({
                  id: event.id, sportId: event.sportId, sport: event.sport,
                  league: event.league, home: event.home, away: event.away, time: event.time,
                })) + '\'>Pin</button>' +
              '</div>').join('')
          : '<div class="bets-empty">No match found for "' + esc(query) + '"</div>';
      })
      .catch((err) => { tnResultsEl.innerHTML = '<div class="bets-empty">' + esc(err.message || 'Search failed') + '</div>'; });
  }

  if (tnListEl) {
    fillSports();
    D.$('#tnSearch').addEventListener('click', searchMatches);
    tnQueryEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchMatches(); });
    D.$('#tnAuto').addEventListener('click', () => saveTrending([]));

    tnListEl.addEventListener('click', (e) => {
      const remove = e.target.closest('[data-tn-remove]');
      if (remove) saveTrending(trending.filter((event) => event.id !== remove.dataset.tnRemove));
    });

    tnListEl.addEventListener('change', (e) => {
      const input = e.target.closest('[data-tn-watch]');
      if (!input) return;
      const id = input.dataset.tnWatch;
      saveTrending(trending.map((event) =>
        (event.id === id ? Object.assign({}, event, { watchers: parseInt(input.value, 10) || 0 }) : event)));
    });

    tnResultsEl.addEventListener('click', (e) => {
      const pin = e.target.closest('[data-tn-pin]');
      if (!pin) return;
      const event = JSON.parse(pin.dataset.tnPin);
      if (trending.some((item) => item.id === event.id)) { D.toast('Already on the strip', 'info'); return; }
      // three fit, so pinning a fourth pushes the oldest one off
      saveTrending(trending.slice(Math.max(0, trending.length - 2)).concat([event]));
      tnResultsEl.innerHTML = '';
      tnQueryEl.value = '';
    });
  }

  /* ---------------- player detail ---------------- */

  function openUser(userId) {
    Api.adminUser(userId).then((data) => {
      const u = data.user;
      userTitle.textContent = u.email;
      userBody.innerHTML =
        '<div class="admin-grid">' +
          card('Balance', D.fmt(u.balance), 'var(--gold)') +
          card('Deposited', D.fmt(u.totals.deposited), 'var(--green)') +
          card('Withdrawn', D.fmt(u.totals.withdrawn)) +
          card('Wagered', D.fmt(u.totals.wagered)) +
          card('Won', D.fmt(u.totals.won)) +
          card('House profit', D.fmt(-u.totals.profit), -u.totals.profit >= 0 ? 'var(--green)' : 'var(--red)') +
        '</div>' +

        '<div class="rows admin-facts">' +
          fact('Referral code', u.referralCode) +
          fact('Referred by', u.referredBy || '—') +
          fact('Invited players', data.referrals.length ? data.referrals.join(', ') : '—') +
          fact('Signup IP', u.signupIp) +
          fact('Last IP', u.lastIp) +
          fact('Joined', when(u.createdAt)) +
          fact('Last seen', when(u.lastSeenAt)) +
        '</div>' +

        '<div class="admin-actions">' +
          '<input class="field-inline" id="adjAmount" type="number" step="0.01" placeholder="Amount, e.g. 250 or -50">' +
          '<input class="field-inline" id="adjNote" type="text" placeholder="Note (optional)">' +
          '<button class="btn btn-primary" id="adjApply">Apply to balance</button>' +
          '<button class="btn ' + (u.blocked ? 'btn-ghost' : 'btn-danger') + '" id="blockToggle" data-blocked="' + u.blocked + '">' +
            (u.blocked ? 'Unblock' : 'Block') + '</button>' +
        '</div>' +

        '<h3 class="admin-sub">Deposit addresses</h3>' +
        ((data.addresses || []).length
          ? '<div class="addr-list">' + data.addresses.map(addressRow).join('') + '</div>'
          : '<div class="bets-empty">No wallet seed configured</div>') +

        '<h3 class="admin-sub">Sports bets</h3>' +
        ((data.sportsBets || []).length
          ? '<div class="admin-list">' + data.sportsBets.map((bet) => sportsBetRow(bet)).join('') + '</div>'
          : '<div class="bets-empty">No sports bets</div>') +

        '<h3 class="admin-sub">Transactions</h3>' +
        (data.transactions.length
          ? '<div class="admin-list">' + data.transactions.map((tx) =>
              '<div class="admin-row">' +
                '<span class="tag-' + (tx.type === 'withdraw' ? 'out' : 'in') + '">' + esc(tx.type) + '</span>' +
                '<div class="admin-row-main"><b>' + esc(D.fmt(tx.amount)) + ' ' + esc(tx.coin) + '</b>' +
                  '<span class="muted">' + esc(tx.network ? tx.network + ' · ' : '') +
                  esc(tx.address ? short(tx.address, 34) + ' · ' : '') + esc(when(tx.ts)) +
                  (tx.note ? ' · ' + esc(tx.note) : '') + '</span></div>' +
                '<span class="' + (STATUS_CLASS[tx.status] || '') + '"><b>' + esc(tx.status) + '</b></span>' +
                (tx.status === 'pending'
                  ? '<div class="admin-row-actions">' +
                      '<button class="btn btn-primary" data-resolve="confirmed" data-tx="' + esc(tx.id) + '">Confirm</button>' +
                      '<button class="btn btn-danger" data-resolve="rejected" data-tx="' + esc(tx.id) + '">Reject</button>' +
                    '</div>'
                  : '') +
              '</div>').join('') + '</div>'
          : '<div class="bets-empty">No transactions</div>') +

        '<h3 class="admin-sub">Last rounds</h3>' +
        (data.bets.length
          ? '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
              '<th>Game</th><th class="num">Bet</th><th class="num">Multiplier</th><th class="num">Payout</th><th class="num">Profit</th><th>When</th>' +
            '</tr></thead><tbody>' +
            data.bets.map((b) =>
              '<tr><td>' + esc(b.game) + '</td>' +
              '<td class="num">' + esc(D.fmt(b.bet)) + '</td>' +
              '<td class="num">' + esc(D.fmtMult(b.multiplier || 0)) + '</td>' +
              '<td class="num">' + esc(D.fmt(b.payout)) + '</td>' +
              '<td class="num ' + (b.payout - b.bet >= 0 ? 'green' : 'red') + '">' + esc(D.fmt(b.payout - b.bet)) + '</td>' +
              '<td class="muted">' + esc(when(b.ts)) + '</td></tr>').join('') +
            '</tbody></table></div>'
          : '<div class="bets-empty">No rounds played yet</div>');

      userBody.dataset.userId = u.id;
      userModal.hidden = false;
      document.body.classList.add('modal-open');
    }).catch((err) => D.toast(err.message || 'Could not load player', 'lose'));
  }

  /** One chain the player can be paid on; clicking the address copies it. */
  const addressRow = (entry) =>
    '<div class="addr-line">' +
      '<div class="addr-line-head"><b>' + esc(entry.network) + '</b>' +
        '<span class="muted">' + esc(entry.coins.join(' · ')) + '</span></div>' +
      '<code class="addr-copy" data-copy="' + esc(entry.address) + '" title="Click to copy">' +
        esc(entry.address) + '</code>' +
    '</div>';

  const card = (label, value, color) =>
    '<div class="stat"><b' + (color ? ' style="color:' + color + '"' : '') + '>' + esc(value) + '</b><span>' + esc(label) + '</span></div>';
  const fact = (label, value) => '<div class="row"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';

  function closeUser() {
    userModal.hidden = true;
    if (D.$('#gameModal').hidden && D.$('#cashierModal').hidden) document.body.classList.remove('modal-open');
  }

  /* ---------------- events ---------------- */

  function resolveTx(txId, status) {
    return Api.adminResolve(txId, status)
      .then(() => {
        D.toast('Marked as ' + status, status === 'confirmed' ? 'win' : 'info');
        const openId = userBody.dataset.userId;
        if (!userModal.hidden && openId) openUser(openId);
        return load();
      })
      .catch((err) => D.toast(err.message || 'Could not update', 'lose'));
  }

  document.addEventListener('click', (e) => {
    const resolve = e.target.closest('[data-resolve]');
    if (resolve) { resolveTx(resolve.dataset.tx, resolve.dataset.resolve); return; }

    const settle = e.target.closest('[data-settle]');
    if (settle) { settleBet(settle.dataset.bet, settle.dataset.settle); return; }

    const assign = e.target.closest('[data-assign]');
    if (assign) {
      const txId = assign.dataset.assign;
      const email = (D.$('[data-assign-email="' + txId + '"]') || {}).value;
      const amount = parseFloat((D.$('[data-assign-amount="' + txId + '"]') || {}).value);
      if (!email) { D.toast('Enter the player email', 'info'); return; }
      Api.request('POST', '/api/admin/assign', { id: txId, email: email.trim(), amount: amount })
        .then(() => { D.toast('Deposit credited to ' + email, 'win'); return load(); })
        .catch((err) => D.toast(err.message || 'Could not credit', 'lose'));
      return;
    }

    const open = e.target.closest('[data-open-user]');
    if (open) { openUser(open.dataset.openUser); return; }

    if (e.target.closest('#adminRefresh')) load();
  });

  userModal.addEventListener('click', (e) => {
    if (e.target === userModal || e.target.closest('[data-close]')) { closeUser(); return; }

    const copy = e.target.closest('[data-copy]');
    if (copy) {
      if (navigator.clipboard) navigator.clipboard.writeText(copy.dataset.copy).catch(() => {});
      D.toast('Address copied', 'info');
      return;
    }

    if (e.target.closest('#adjApply')) {
      const amount = parseFloat(D.$('#adjAmount').value);
      if (!amount) { D.toast('Enter an amount', 'info'); return; }
      Api.adminBalance(userBody.dataset.userId, amount, D.$('#adjNote').value)
        .then(() => {
          D.toast('Balance updated', 'win');
          openUser(userBody.dataset.userId);
          load();
        })
        .catch((err) => D.toast(err.message || 'Could not update balance', 'lose'));
    }

    const block = e.target.closest('#blockToggle');
    if (block) {
      Api.adminBlock(userBody.dataset.userId, block.dataset.blocked !== 'true')
        .then(() => { openUser(userBody.dataset.userId); load(); })
        .catch((err) => D.toast(err.message || 'Could not update', 'lose'));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !userModal.hidden) closeUser();
  });

  // the rail button navigates first, this just fills the page behind it
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-nav="admin"]')) load();
  });

  D.Admin = { load: load, openUser: openUser };
})(window.Dicey);
