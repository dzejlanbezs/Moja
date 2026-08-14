/* ============================================================
   Virtusjack — sign up, sign in, and switching the UI between the
   local demo wallet and a real server account
   ============================================================ */

(function (D) {
  'use strict';

  const Api = D.Api;
  const authModal = D.$('#authModal');
  const authForm = D.$('#authForm');
  const authError = D.$('#authError');
  const authSubmit = D.$('#authSubmit');
  const authTitle = D.$('#authTitle');
  const authHint = D.$('#authHint');
  const referralField = D.$('#referralField');
  const emailInput = D.$('#authEmail');
  const passwordInput = D.$('#authPassword');
  const referralInput = D.$('#authReferral');

  let tab = 'register';

  /* ---------------- auth modal ---------------- */

  function setTab(next) {
    tab = next;
    D.$$('#authSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.auth === next));
    const registering = next === 'register';
    authTitle.textContent = registering ? 'Create your account' : 'Welcome back';
    authSubmit.textContent = registering ? 'Create account' : 'Log in';
    referralField.hidden = !registering;
    passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
    authHint.textContent = registering
      ? 'New accounts start at $0.00 — request a deposit from the Cashier and it lands once an admin confirms it.'
      : 'Use the email and password you registered with.';
    showError('');
  }

  function showError(message) {
    authError.textContent = message || '';
    authError.hidden = !message;
  }

  function openAuth(which) {
    if (!Api || Api.mode !== 'server') {
      D.toast('Accounts need the server running: node server.js', 'info');
      return;
    }
    setTab(which || 'register');
    authModal.hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(() => emailInput.focus(), 40);
  }

  function closeAuth() {
    authModal.hidden = true;
    if (D.$('#gameModal').hidden && D.$('#cashierModal').hidden) document.body.classList.remove('modal-open');
  }

  authModal.addEventListener('click', (e) => {
    if (e.target === authModal || e.target.closest('[data-close]')) closeAuth();
    const seg = e.target.closest('#authSeg .seg-btn');
    if (seg) setTab(seg.dataset.auth);
  });

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const referral = referralInput.value.trim();

    if (!email || !password) { showError('Email and password are required'); return; }
    if (tab === 'register' && password.length < 8) { showError('Password must be at least 8 characters'); return; }

    authSubmit.disabled = true;
    showError('');
    const action = tab === 'register' ? Api.register(email, password, referral) : Api.login(email, password);

    action
      .then((user) => {
        closeAuth();
        authForm.reset();
        D.toast(tab === 'register' ? 'Account created — welcome!' : 'Signed in as ' + user.email, 'win');
        return applySession(user).then(() => { if (D.Feed) D.Feed.load(); });
      })
      .catch((err) => showError(err.message || 'Something went wrong'))
      .then(() => { authSubmit.disabled = false; });
  });

  D.$('#registerBtn').addEventListener('click', () => openAuth('register'));
  D.$('#loginBtn').addEventListener('click', () => openAuth('login'));
  D.$('#logoutBtn').addEventListener('click', () => {
    Api.logout()
      .then(() => { D.toast('Signed out', 'info'); return applySession(null); })
      .then(() => { if (D.Feed) D.Feed.load(); })
      .catch(() => D.toast('Could not sign out', 'lose'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !authModal.hidden) closeAuth();
  });

  /* ---------------- session -> UI ---------------- */

  function applySession(user) {
    Api.user = user;
    const signedIn = !!user;

    D.$('#authActions').hidden = signedIn;
    // no account, no money: the balance and the cashier only mean something signed in
    D.$('#topbarCenter').hidden = !signedIn;
    D.$('#rewardsBtn').hidden = !signedIn;
    D.$('#logoutBtn').hidden = !signedIn;
    D.$('#topAvatar').hidden = !signedIn;
    D.$('#levelChip').hidden = !signedIn;
    D.$('#railAdmin').hidden = !(signedIn && user.isAdmin);
    D.$('#resetBalance').hidden = true;
    D.$('#fakeDeposit').textContent = 'I have sent the deposit';
    D.$('#depHint').textContent = 'Send the coin to the address above, then tell us the amount. It is credited once an admin confirms it.';
    loadConfig(user);

    if (!signedIn) {
      if (D.Rewards) D.Rewards.apply(null);
      D.Store.hydrate({ balance: 0, wagered: 0, won: 0, bets: 0, wins: 0, history: [], tx: [] });
      D.$('#profileName').textContent = 'Guest';
      D.$('#profileMeta').textContent = 'Not signed in';
      D.$('#profileAvatar').textContent = '?';
      D.$('#profileUsername').textContent = '—';
      D.$('#profileEmail').textContent = '—';
      D.$('#profileReferral').textContent = '—';
      D.$('#profileReferredBy').textContent = '—';
      if (D.Deposits) D.Deposits.stop();
      if (D.$('#page-admin').classList.contains('active')) D.navigate('casino');
      return Promise.resolve();
    }

    const handle = user.email.split('@')[0];
    const initials = handle.slice(0, 2).toUpperCase();
    D.$('#topAvatar').textContent = initials;
    D.$('#profileAvatar').textContent = initials;
    D.$('#profileName').textContent = handle;
    D.$('#profileMeta').textContent = 'Member since ' + new Date(user.createdAt).toLocaleDateString();
    D.$('#profileUsername').textContent = handle;
    D.$('#profileEmail').textContent = user.email;
    D.$('#profileReferral').textContent = user.referralCode;
    D.$('#profileReferredBy').textContent = user.referredBy || '—';
    D.$('#profileCurrency').textContent = 'USD';

    D.Store.hydrate({
      balance: user.balance,
      wagered: user.stats.wagered,
      won: user.stats.won,
      bets: user.stats.bets,
      wins: user.stats.wins,
    });

    if (D.Rewards) D.Rewards.refresh();
    if (D.Deposits) D.Deposits.start();

    return Api.myBets()
      .then((data) => {
        D.Store.hydrate({
          history: (data.bets || []).map((b) => ({
            game: b.game, gameId: b.gameId, bet: b.bet, payout: b.payout, multiplier: b.multiplier, ts: b.ts,
          })),
        });
      })
      .catch(() => {});
  }

  /* ---------------- cashier config ---------------- */

  /**
   * Pulls the live deposit wallets, the promo bonus and the chain status,
   * then puts the deposit tab into the right shape for this account.
   */
  function loadConfig(user) {
    return Api.request('GET', '/api/config').then((cfg) => {
      D.setCoins(cfg.coins);
      if (D.setWinRange) D.setWinRange(cfg.wins);
      if (D.setPlaying) D.setPlaying(cfg.playing);

      // without a seed there are no real addresses, so say so instead of showing filler
      const missingSeed = user && !cfg.hdEnabled;
      D.$('#depNoSeed').hidden = !missingSeed;
      D.$('#depAddrCard').hidden = !!missingSeed;
      D.$('#depositCoins').hidden = !!missingSeed;

      const banner = D.$('#bonusBanner');
      banner.hidden = !cfg.bonus;
      if (cfg.bonus) D.$('#bonusTitle').textContent = cfg.bonus.label;

      const refRow = D.$('#depRefRow');
      refRow.hidden = !cfg.depositRef;
      if (cfg.depositRef) D.$('#depRef').textContent = cfg.depositRef;

      const onChain = !!(cfg.hdEnabled && user);
      D.$('#depServer').hidden = !onChain;
      D.$('#depAmountField').hidden = onChain;
      D.$('#fakeDeposit').hidden = onChain;
      D.$('#depHint').hidden = onChain;

      if (onChain) {
        D.$('#depChainHint').textContent =
          'This address is yours alone. Send any amount over $' + (cfg.minDeposit || 10) +
          ' and it is credited automatically after ' + cfg.confirmations +
          ' confirmations — USDT and USDC count 1:1 on Ethereum, Solana or Tron, while ETH, BTC, SOL' +
          ' and TRX convert at the live rate. Nothing else to do.';
      }
    }).catch(() => {});
  }

  /* ---------------- boot ---------------- */

  // Games are free play until a backend is there to own the money.
  D.guardPlay = () => {
    if (Api.mode !== 'server') return true;
    if (Api.user) return true;
    openAuth('register');
    D.toast('Create an account to play', 'info');
    return false;
  };

  Api.detect().then((mode) => {
    if (mode !== 'server') {
      // the buttons stay visible so it is obvious accounts exist; they explain themselves on click
      document.body.classList.add('demo-mode');
      D.$('#authActions').hidden = false;
      return;
    }
    document.body.classList.add('server-mode');
    D.Store.setPersistence(false);
    return applySession(Api.user).then(() => { if (D.Feed) D.Feed.load(); });
  });

  D.openAuth = openAuth;
  D.applySession = applySession;
})(window.Virtusjack);
