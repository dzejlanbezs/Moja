/* ============================================================
   Virtusjack — VIP ranks

   One source of truth for the ladder. Rank follows total amount
   wagered, so it moves on its own as the player bets.
   ============================================================ */

(function (D) {
  'use strict';

  // `from`/`to` are the advertised dollar ranges; a player moves up as soon
  // as their total wagered passes the `to` of their current rank.
  const RANKS = [
    { name: 'Bronze', from: 0, to: 10000, color: '#cd7f32', cashback: '5%', perks: ['5% weekly cashback', 'Daily bonus', 'Priority chat'] },
    { name: 'Silver', from: 10001, to: 50000, color: '#c0c0c0', cashback: '10%', perks: ['10% weekly cashback', 'Weekly reload', 'Silver badge'] },
    { name: 'Gold', from: 50001, to: 200000, color: '#ffcc33', cashback: '15%', perks: ['15% weekly cashback', 'Birthday bonus', 'VIP manager'] },
    { name: 'Platinum', from: 200001, to: 1000000, color: '#7eb8ff', cashback: '20%', perks: ['20% weekly cashback', 'Monthly bonus', 'Faster withdrawals'] },
    { name: 'Diamond', from: 1000001, to: 10000000, color: '#b388ff', cashback: '25%', perks: ['25% weekly cashback', 'Personal host', 'No withdrawal limits'] },
    { name: 'Legend', from: 10000001, to: Infinity, color: '#ff8a3d', cashback: '30%', perks: ['30% weekly cashback', 'Custom packages', 'Private events'] },
  ];

  const usd0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const money0 = (n) => '$' + usd0.format(Math.round(n));
  const range = (rank) => (rank.to === Infinity ? money0(rank.from) + '+' : money0(rank.from) + ' – ' + money0(rank.to));

  function rankFor(wagered) {
    for (let i = 0; i < RANKS.length; i++) if (wagered <= RANKS[i].to) return i;
    return RANKS.length - 1;
  }

  /** Current rank, the next one, and how far along the player is. */
  function progress(wagered) {
    const index = rankFor(wagered);
    const rank = RANKS[index];
    const next = RANKS[index + 1] || null;
    const base = index === 0 ? 0 : RANKS[index - 1].to;
    const pct = next ? D.clamp(((wagered - base) / (rank.to - base)) * 100, 0, 100) : 100;
    return {
      index: index,
      rank: rank,
      next: next,
      pct: pct,
      remaining: next ? Math.max(0, rank.to - wagered) : 0,
      threshold: next ? rank.to : null,
      wagered: wagered,
    };
  }

  function renderLadder(current) {
    const grid = D.$('#ranks');
    if (!grid) return;
    grid.innerHTML = RANKS.map((r, i) =>
      '<div class="rank" style="border-color:' + r.color + '33">' +
        (i === current ? '<span class="rank-badge-now">Your rank</span>' : '') +
        '<div class="rank-icon" style="background:' + r.color + '1f;color:' + r.color + '">\u2605</div>' +
        '<h3 style="color:' + r.color + '">' + r.name + '</h3>' +
        '<div class="wager">Wagered ' + range(r) + '</div>' +
        '<ul>' + r.perks.map((p) => '<li>' + p + '</li>').join('') + '</ul>' +
      '</div>'
    ).join('');
  }

  function paint(state) {
    const info = progress(state.wagered || 0);
    const rank = info.rank;

    renderLadder(info.index);

    const copy = D.$('#vipCopy');
    if (copy) {
      copy.innerHTML = info.next
        ? 'You\'re <b>' + rank.name + '</b>. Wager <b>' + D.fmt(info.remaining) + '</b> more to unlock ' + info.next.name + '.'
        : 'You\'re <b>Legend</b> — the top of the ladder. Nothing left to climb.';
    }
    const bar = D.$('#vipBar');
    if (bar) bar.style.width = info.pct.toFixed(1) + '%';
    const from = D.$('#vipFrom');
    if (from) from.textContent = rank.name + ' — ' + D.fmt(state.wagered || 0) + ' wagered';
    const to = D.$('#vipTo');
    if (to) to.textContent = info.next ? info.next.name + ' at ' + money0(info.threshold) : 'Maximum rank reached';

    const chipName = D.$('#levelChip .level-name');
    if (chipName) { chipName.textContent = rank.name; chipName.style.color = rank.color; }
    const chipPct = D.$('#levelPct');
    if (chipPct) chipPct.textContent = Math.round(info.pct) + '%';
    const chipFill = D.$('#levelFill');
    if (chipFill) {
      chipFill.style.width = info.pct.toFixed(1) + '%';
      chipFill.style.background = 'linear-gradient(90deg,' + rank.color + ',' + rank.color + '99)';
    }

    const pillName = D.$('#profileRankName');
    if (pillName) pillName.textContent = rank.name;
    const pill = D.$('#profileRankPill');
    if (pill) {
      pill.style.color = rank.color;
      pill.style.background = rank.color + '1a';
      pill.style.borderColor = rank.color + '40';
    }
    const profileVip = D.$('#profileVip');
    if (profileVip) { profileVip.textContent = rank.name; profileVip.style.color = rank.color; }
  }

  D.Vip = { ranks: RANKS, progress: progress, rankFor: rankFor, range: range };
  D.Store.onChange(paint);
})(window.Virtusjack);
