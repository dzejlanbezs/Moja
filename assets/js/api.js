/* ============================================================
   Dicey — backend client

   The site runs in two modes:
     server  — server.js is reachable, so accounts, balances and
               transactions are real and shared across devices
     demo    — opened without the server (e.g. straight from disk),
               so the wallet stays local play money in localStorage
   ============================================================ */

(function (D) {
  'use strict';

  const Api = {
    mode: 'demo',
    user: null,

    async request(method, path, body) {
      const options = {
        method: method,
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' },
      };
      if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
      const res = await fetch(path, options);
      let data = {};
      try { data = await res.json(); } catch (e) { /* empty or non-JSON body */ }
      if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data: data });
      return data;
    },

    /** Probes the backend once at boot; failure just means demo mode. */
    async detect() {
      if (location.protocol === 'file:') { Api.mode = 'demo'; return Api.mode; }
      try {
        const data = await Api.request('GET', '/api/session');
        Api.mode = 'server';
        Api.user = data.user;
      } catch (err) {
        Api.mode = 'demo';
        Api.user = null;
      }
      return Api.mode;
    },

    register(email, password, referral) {
      return Api.request('POST', '/api/auth/register', { email: email, password: password, referral: referral })
        .then((data) => { Api.user = data.user; return data.user; });
    },

    login(email, password) {
      return Api.request('POST', '/api/auth/login', { email: email, password: password })
        .then((data) => { Api.user = data.user; return data.user; });
    },

    logout() {
      return Api.request('POST', '/api/auth/logout').then(() => { Api.user = null; });
    },

    refreshSession() {
      return Api.request('GET', '/api/session').then((data) => { Api.user = data.user; return data.user; });
    },

    postRound(entry) {
      return Api.request('POST', '/api/play/round', {
        gameId: entry.gameId, game: entry.game,
        bet: entry.bet, payout: entry.payout, multiplier: entry.multiplier,
      });
    },

    myBets() { return Api.request('GET', '/api/me/bets'); },
    myTransactions() { return Api.request('GET', '/api/wallet/transactions'); },
    requestDeposit(coin, amount, address) { return Api.request('POST', '/api/wallet/deposit', { coin: coin, amount: amount, address: address }); },
    requestWithdraw(coin, address, amount) { return Api.request('POST', '/api/wallet/withdraw', { coin: coin, address: address, amount: amount }); },

    adminOverview() { return Api.request('GET', '/api/admin/overview'); },
    adminUser(userId) { return Api.request('GET', '/api/admin/user?id=' + encodeURIComponent(userId)); },
    adminResolve(txId, status, note) { return Api.request('POST', '/api/admin/transaction', { id: txId, status: status, note: note }); },
    adminBalance(userId, amount, note) { return Api.request('POST', '/api/admin/balance', { id: userId, amount: amount, note: note }); },
    adminBlock(userId, blocked) { return Api.request('POST', '/api/admin/block', { id: userId, blocked: blocked }); },
  };

  /* ---------------- wallet: same calls, different backend ---------------- */

  const Wallet = {
    isServer() { return Api.mode === 'server'; },
    isSignedIn() { return Api.mode !== 'server' || !!Api.user; },

    deposit(coin, amount, address) {
      if (!Wallet.isServer()) {
        D.Store.deposit(amount || 500);
        return Promise.resolve({ local: true });
      }
      return Api.requestDeposit(coin, amount, address);
    },

    withdraw(coin, address, amount) {
      if (!Wallet.isServer()) {
        if (!D.Store.withdraw(amount)) return Promise.reject(new Error('Not enough balance'));
        return Promise.resolve({ local: true });
      }
      return Api.requestWithdraw(coin, address, amount).then((data) => {
        D.Store.hydrate({ balance: data.balance });
        return data;
      });
    },

    /** Normalised rows for the cashier history tab. */
    transactions() {
      if (Wallet.isServer() && !Api.user) return Promise.resolve([]);
      if (!Wallet.isServer()) {
        return Promise.resolve(D.Store.state.tx.map((tx) => ({
          type: tx.type, amount: tx.amount, asset: tx.asset, status: tx.status, ts: tx.ts,
        })));
      }
      return Api.myTransactions().then((data) => (data.transactions || []).map((tx) => ({
        type: tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        amount: tx.type === 'withdraw' ? -tx.amount : tx.amount,
        asset: tx.coin,
        status: tx.status.charAt(0).toUpperCase() + tx.status.slice(1),
        address: tx.address,
        note: tx.note,
        ts: tx.ts,
      })));
    },
  };

  /* ---------------- keep the server balance authoritative ---------------- */

  // Stakes already taken locally but not yet reported to the server. The
  // server balance minus this is what the player can actually still bet.
  let openStake = 0;
  let queue = Promise.resolve();

  D.Store.hooks.wager = (amount) => {
    if (Api.mode !== 'server') return;
    openStake = D.round2(openStake + amount);
  };

  D.Store.hooks.record = (entry) => {
    if (Api.mode !== 'server' || !Api.user) return;
    openStake = D.round2(Math.max(0, openStake - entry.bet));
    queue = queue
      .then(() => Api.postRound(entry))
      .then((data) => {
        Api.user.balance = data.balance;
        D.Store.hydrate({
          balance: D.round2(data.balance - openStake),
          wagered: data.stats.wagered,
          won: data.stats.won,
          bets: data.stats.bets,
          wins: data.stats.wins,
        });
        if (data.rewards && D.Rewards) D.Rewards.apply(data.rewards);
      })
      .catch((err) => {
        D.toast(err.message || 'Could not sync that round', 'lose');
        return Api.refreshSession().then((user) => {
          if (user) D.Store.hydrate({ balance: D.round2(user.balance - openStake) });
        }).catch(() => {});
      });
  };

  D.Api = Api;
  D.Wallet = Wallet;
})(window.Dicey);
