/* ============================================================
   Dicey — rewards popup

   Rakeback, daily, weekly and monthly bonuses. Amounts and the
   claim rules come from the server; this only displays them.
   ============================================================ */

(function (D) {
  'use strict';

  const modal = D.$('#rewardsModal');
  const list = D.$('#rewardList');
  const button = D.$('#rewardsBtn');
  const dot = D.$('#rewardsDot');

  const ORDER = ['rakeback', 'daily', 'weekly', 'monthly'];

  const ICONS = {
    rakeback: '<path d="M12 3v18M8 7h6a3 3 0 0 1 0 6H8h7a3 3 0 0 1 0 6"/>',
    daily: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    weekly: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
    monthly: '<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8L12 3Z"/>',
  };

  const LOCK = '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/>' +
    '<path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/><circle cx="12" cy="15.2" r="1.2"/></svg>';

  const TITLES = {
    rakeback: 'Rakeback',
    daily: 'Daily Bonus',
    weekly: 'Weekly Bonus',
    monthly: 'Monthly Bonus',
  };

  let state = null;

  function countdown(ts) {
    if (!ts) return '';
    const left = ts - Date.now();
    if (left <= 0) return 'available now';
    const hours = Math.floor(left / 3600000);
    const minutes = Math.floor((left % 3600000) / 60000);
    if (hours >= 24) return 'in ' + Math.floor(hours / 24) + 'd ' + (hours % 24) + 'h';
    return 'in ' + hours + 'h ' + minutes + 'm';
  }

  function render() {
    if (!state) {
      list.innerHTML = '<div class="bets-empty">Sign in to collect bonuses.</div>';
      return;
    }

    list.innerHTML = ORDER.map((key) => {
      const reward = state[key];
      const detail = reward.wagered != null ? D.fmt(reward.wagered) + ' wagered — ' : '';

      // timed bonuses stay sealed: the player sees a lock, never the figure
      const side = reward.hidden
        ? (reward.claimable
            ? '<button class="btn btn-primary" data-claim="' + key + '">Open</button>'
            : '<span class="reward-lock" title="Locked">' + LOCK + '</span>' +
              '<span class="reward-locked">' + (reward.availableAt ? countdown(reward.availableAt) : 'locked') + '</span>')
        : '<b class="reward-amount">' + D.fmt(reward.amount) + '</b>' +
          (reward.claimable
            ? '<button class="btn btn-primary" data-claim="' + key + '">Claim</button>'
            : '<span class="reward-locked">keep playing</span>');

      return '<div class="reward-card' + (reward.claimable ? ' ready' : '') + '">' +
        '<span class="reward-icon"><svg viewBox="0 0 24 24">' + ICONS[key] + '</svg></span>' +
        '<div class="reward-main">' +
          '<b>' + TITLES[key] + '</b>' +
          '<span class="reward-rate">' + reward.blurb + '</span>' +
          '<span class="reward-note">' + detail + reward.note + '</span>' +
        '</div>' +
        '<div class="reward-side">' + side + '</div>' +
      '</div>';
    }).join('');
  }

  /** Keeps the topbar dot lit while something is collectable. */
  function markReady() {
    const ready = state && ORDER.some((key) => state[key].claimable);
    dot.hidden = !ready;
    button.classList.toggle('ready', !!ready);
  }

  function apply(rewards) {
    state = rewards || null;
    markReady();
    if (!modal.hidden) render();
  }

  function refresh() {
    if (!D.Wallet.isServer() || !D.Api.user) { apply(null); return Promise.resolve(); }
    return D.Api.request('GET', '/api/rewards')
      .then((data) => apply(data.rewards))
      .catch(() => {});
  }

  function open() {
    if (!D.Wallet.isServer()) {
      D.toast('Bonuses need an account — run: node server.js', 'info');
      return;
    }
    if (!D.Api.user) {
      if (D.openAuth) D.openAuth('login');
      return;
    }
    modal.hidden = false;
    document.body.classList.add('modal-open');
    render();
    refresh();
  }

  function close() {
    modal.hidden = true;
    if (D.$('#gameModal').hidden && D.$('#cashierModal').hidden && D.$('#authModal').hidden) {
      document.body.classList.remove('modal-open');
    }
  }

  button.addEventListener('click', open);

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) { close(); return; }

    const claim = e.target.closest('[data-claim]');
    if (!claim) return;
    claim.disabled = true;
    D.Api.request('POST', '/api/rewards/claim', { type: claim.dataset.claim })
      .then((data) => {
        D.Store.hydrate({ balance: data.balance });
        D.toast('Collected ' + D.fmt(data.claimed), 'win');
        apply(data.rewards);
        render();
      })
      .catch((err) => { D.toast(err.message || 'Could not claim', 'lose'); claim.disabled = false; });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });

  D.Rewards = { refresh: refresh, apply: apply, open: open };
})(window.Dicey);
