/* ============================================================
   Virtusjack — core helpers, wallet store, toasts
   ============================================================ */

window.Virtusjack = (function () {
  'use strict';

  /* ---------- random ---------- */
  const buf = new Uint32Array(1);
  function rand() {
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(buf);
      return buf[0] / 4294967296;
    }
    return Math.random();
  }
  const randInt = (n) => Math.floor(rand() * n);
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function pickWeighted(entries) {
    const total = entries.reduce((s, e) => s + e.w, 0);
    let r = rand() * total;
    for (const e of entries) {
      r -= e.w;
      if (r <= 0) return e;
    }
    return entries[entries.length - 1];
  }

  /* ---------- format ---------- */
  const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (n) => '$' + money.format(Math.max(-1e12, Math.min(1e12, n || 0)));
  const fmtMult = (m) => (m >= 100 ? m.toFixed(0) : m.toFixed(2)) + '\u00d7';
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const round2 = (n) => Math.round(n * 100) / 100;

  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  /* ---------- dom ---------- */
  function h(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- wallet store ---------- */
  const KEY = 'virtusjack.wallet.v1';
  const DEFAULTS = { balance: 1000, wagered: 0, won: 0, bets: 0, wins: 0, history: [], tx: [] };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && typeof raw.balance === 'number') return Object.assign({}, DEFAULTS, raw);
    } catch (e) { /* corrupted or unavailable storage — fall back to defaults */ }
    return Object.assign({}, DEFAULTS);
  }

  const state = load();
  const listeners = [];
  const hooks = {};
  let persist = true;

  function save() {
    if (!persist) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
  }
  function emit() {
    save();
    listeners.forEach((fn) => fn(state));
  }

  const Store = {
    get state() { return state; },
    get balance() { return state.balance; },
    hooks: hooks,

    /** Server mode owns the wallet, so stop mirroring it into localStorage. */
    setPersistence(on) {
      persist = !!on;
      if (!persist) { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
    },

    /** Replaces wallet fields with authoritative values (server or reset). */
    hydrate(data) {
      Object.assign(state, data);
      emit();
    },
    onChange(fn) {
      listeners.push(fn);
      fn(state);
      return () => {
        const i = listeners.indexOf(fn);
        if (i > -1) listeners.splice(i, 1);
      };
    },

    canBet(amount) { return amount > 0 && amount <= state.balance + 1e-9; },

    /** Takes the stake out of the balance and counts it as wagered. */
    wager(amount) {
      if (!Store.canBet(amount)) return false;
      state.balance = round2(state.balance - amount);
      state.wagered = round2(state.wagered + amount);
      state.bets += 1;
      emit();
      if (hooks.wager) hooks.wager(amount);
      return true;
    },

    credit(amount) {
      if (!amount) { emit(); return; }
      state.balance = round2(state.balance + amount);
      state.won = round2(state.won + amount);
      emit();
    },

    deposit(amount) {
      state.balance = round2(state.balance + amount);
      state.tx.unshift({ type: 'Deposit', amount: amount, asset: 'USD', status: 'Completed', ts: Date.now() });
      state.tx = state.tx.slice(0, 20);
      emit();
    },

    withdraw(amount) {
      if (!Store.canBet(amount)) return false;
      state.balance = round2(state.balance - amount);
      state.tx.unshift({ type: 'Withdraw', amount: -amount, asset: 'USD', status: 'Pending', ts: Date.now() });
      state.tx = state.tx.slice(0, 20);
      emit();
      return true;
    },

    /** Records a finished round for the bet list and win-rate stats. */
    record(entry) {
      if (entry.payout > entry.bet) state.wins += 1;
      state.history.unshift(Object.assign({ ts: Date.now() }, entry));
      state.history = state.history.slice(0, 40);
      emit();
      if (hooks.record) hooks.record(entry);
    },

    reset() {
      Object.assign(state, DEFAULTS, { history: [], tx: [] });
      emit();
    },
  };

  /* ---------- toasts ---------- */
  function toast(message, kind) {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return;
    const node = h('<div class="toast ' + (kind || 'info') + '"><i></i><span></span></div>');
    node.querySelector('span').textContent = message;
    wrap.appendChild(node);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 260);
    }, 2600);
  }

  return {
    rand, randInt, shuffle, pickWeighted,
    fmt, fmtMult, clamp, round2, timeAgo,
    h, $, $$,
    Store, toast,
    games: {},
  };
})();
