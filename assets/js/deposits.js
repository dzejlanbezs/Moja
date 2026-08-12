/* ============================================================
   Dicey — deposit alerts and the sports free bet

   Watches for credited deposits so the player sees the money
   arrive, and lights up the Sports rail once the promo free bet
   has been earned.
   ============================================================ */

(function (D) {
  'use strict';

  const alertBtn = D.$('#depositAlert');
  const alertCoin = D.$('#depositAlertCoin');
  const alertAmount = D.$('#depositAlertAmount');
  const modal = D.$('#freeBetModal');
  const sportsBtn = D.$('.rail-btn[data-nav="sports"]');

  const COIN_COLORS = {
    USDT: '#26a17b', USDC: '#2775ca', ETH: '#627eea',
    BTC: '#f7931a', SOL: '#9945ff', TRX: '#ff060a', USD: '#ffcc33',
  };

  let since = 0;
  let timer = 0;
  let freeBet = null;

  /* ---------------- deposit alert ---------------- */

  function showAlert(deposit) {
    alertCoin.textContent = deposit.coin.slice(0, 1);
    alertCoin.style.background = COIN_COLORS[deposit.coin] || 'var(--green)';
    alertAmount.textContent = D.fmt(deposit.amount);
    alertBtn.hidden = false;
    alertBtn.classList.remove('pop');
    void alertBtn.offsetWidth;          // restart the entry animation
    alertBtn.classList.add('pop');
    D.toast('Deposit credited · ' + D.fmt(deposit.amount) + ' ' + deposit.coin, 'win');
  }

  alertBtn.addEventListener('click', () => {
    alertBtn.hidden = true;
    if (D.openCashier) D.openCashier('history');
  });

  /* ---------------- free bet ---------------- */

  function applyFreeBet(next) {
    freeBet = next && !next.used ? next : null;
    if (sportsBtn) sportsBtn.classList.toggle('glow-gold', !!freeBet);

    if (!freeBet) return;
    D.$('#freeBetAmount').textContent = D.fmt(freeBet.amount);
    D.$('#freeBetAmount2').textContent = D.fmt(freeBet.amount);
    D.$('#freeBetStatus').textContent = freeBet.used ? 'Used' : 'Ready to use';
  }

  function openFreeBet() {
    if (!freeBet) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    if (!freeBet.seen) {
      freeBet.seen = true;
      D.Api.request('POST', '/api/wallet/freebet-seen').catch(() => {});
    }
  }

  function closeFreeBet() {
    modal.hidden = true;
    if (D.$('#gameModal').hidden && D.$('#cashierModal').hidden) document.body.classList.remove('modal-open');
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) closeFreeBet();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeFreeBet();
  });

  // the rail button navigates as usual; the free bet rides along with it
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-nav="sports"]') && freeBet) setTimeout(openFreeBet, 120);
  });

  /* ---------------- polling ---------------- */

  function poll(quiet) {
    if (!D.Wallet.isServer() || !D.Api.user) return Promise.resolve();
    return D.Api.request('GET', '/api/wallet/news?since=' + since)
      .then((data) => {
        applyFreeBet(data.freeBet);
        const deposits = data.deposits || [];
        if (deposits.length) {
          since = Math.max(since, ...deposits.map((d) => d.ts));
          if (!quiet) {
            showAlert(deposits[0]);
            D.Store.hydrate({ balance: data.balance });
            if (D.paintCashier && !D.$('#cashierModal').hidden) D.paintCashier();
          }
        }
        if (!since) since = data.now;
      })
      .catch(() => {});
  }

  /** Called after sign-in: learn the current state without shouting about old deposits. */
  function start() {
    since = 0;
    alertBtn.hidden = true;
    applyFreeBet(D.Api.user ? D.Api.user.freeBet : null);
    poll(true);
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) poll(false); }, 15000);
  }

  function stop() {
    clearInterval(timer);
    alertBtn.hidden = true;
    applyFreeBet(null);
  }

  D.Deposits = { start: start, stop: stop, poll: poll, openFreeBet: openFreeBet, applyFreeBet: applyFreeBet };
})(window.Dicey);
