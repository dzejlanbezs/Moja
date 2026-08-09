/* ============================================================
   Dicey — game modal framework
   Every game is a module registered here. A module gets a ctx with
   the bet panel, the stage and the wallet plumbing it needs.
   ============================================================ */

(function (D) {
  'use strict';

  const registry = {};
  let current = null;
  let lastBet = 1;

  /* ---------- reusable bet panel widgets ---------- */
  const ui = {
    block(labelHtml, ...children) {
      const node = D.h('<div class="bp-block"></div>');
      if (labelHtml) node.appendChild(D.h('<div class="bp-label">' + labelHtml + '</div>'));
      children.forEach((c) => c && node.appendChild(c));
      return node;
    },

    amount(opts) {
      opts = opts || {};
      const node = D.h(
        '<div class="bp-block">' +
          '<div class="bp-label"><span>' + (opts.label || 'Bet amount') + '</span><em class="bp-max"></em></div>' +
          '<div class="bp-input-row">' +
            '<input class="bp-input" type="number" min="0" step="0.01" inputmode="decimal">' +
            '<button class="bp-mini" data-op="half" title="Halve">&frac12;</button>' +
            '<button class="bp-mini" data-op="double" title="Double">2&times;</button>' +
            '<button class="bp-mini" data-op="max" title="Max">Max</button>' +
          '</div>' +
          '<div class="bp-chips">' +
            '<button class="bp-chip" data-set="1">$1</button>' +
            '<button class="bp-chip" data-set="5">$5</button>' +
            '<button class="bp-chip" data-set="25">$25</button>' +
            '<button class="bp-chip" data-set="100">$100</button>' +
          '</div>' +
        '</div>'
      );

      const input = node.querySelector('.bp-input');
      const maxLabel = node.querySelector('.bp-max');
      input.value = D.round2(Math.min(lastBet, Math.max(0.1, D.Store.balance))).toFixed(2);

      const api = {
        node,
        get() {
          const v = D.round2(parseFloat(input.value));
          return isFinite(v) && v > 0 ? v : 0;
        },
        set(v) {
          input.value = D.round2(Math.max(0, v)).toFixed(2);
          lastBet = api.get();
          if (opts.onChange) opts.onChange(api.get());
        },
        disable(state) {
          input.disabled = !!state;
          D.$$('.bp-mini, .bp-chip', node).forEach((b) => (b.disabled = !!state));
        },
      };

      node.addEventListener('click', (e) => {
        const op = e.target.closest('[data-op]');
        const set = e.target.closest('[data-set]');
        if (op) {
          const v = api.get();
          if (op.dataset.op === 'half') api.set(Math.max(0.1, v / 2));
          if (op.dataset.op === 'double') api.set(Math.min(D.Store.balance, v * 2));
          if (op.dataset.op === 'max') api.set(D.Store.balance);
        }
        if (set) api.set(parseFloat(set.dataset.set));
      });

      input.addEventListener('input', () => {
        lastBet = api.get();
        if (opts.onChange) opts.onChange(api.get());
      });

      api.refreshMax = () => { maxLabel.textContent = 'Balance ' + D.fmt(D.Store.balance); };
      api.refreshMax();
      return api;
    },

    readout(label, value) {
      const node = D.h('<div class="bp-readout"><span>' + label + '</span><b></b></div>');
      const b = node.querySelector('b');
      const api = { node, set: (v) => { b.textContent = v; } };
      api.set(value || '—');
      return api;
    },

    seg(items, onPick, activeValue) {
      const node = D.h('<div class="bp-seg"></div>');
      items.forEach((it) => {
        const btn = D.h('<button type="button"></button>');
        btn.textContent = it.label;
        btn.dataset.value = it.value;
        if (String(it.value) === String(activeValue)) btn.classList.add('active');
        node.appendChild(btn);
      });
      node.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || btn.disabled) return;
        D.$$('button', node).forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        onPick(btn.dataset.value);
      });
      node.setDisabled = (s) => D.$$('button', node).forEach((b) => (b.disabled = !!s));
      return node;
    },

    select(options, onPick, value) {
      const node = D.h('<select class="bp-select"></select>');
      options.forEach((o) => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        if (String(o.value) === String(value)) opt.selected = true;
        node.appendChild(opt);
      });
      node.addEventListener('change', () => onPick(node.value));
      return node;
    },

    action(label, kind) {
      const btn = D.h('<button class="btn ' + (kind || 'btn-primary') + ' btn-lg btn-block"></button>');
      btn.textContent = label;
      return btn;
    },

    note(text) {
      const node = D.h('<p class="bp-note"></p>');
      node.textContent = text;
      return node;
    },
  };

  /* ---------- modal plumbing ---------- */
  function registerGame(def) { registry[def.id] = def; }

  function openGame(id) {
    const def = registry[id];
    const meta = D.games[id] || {};
    if (!def) { D.toast('This game is coming soon', 'info'); return; }
    closeGame();

    const overlay = document.getElementById('gameModal');
    const panel = document.getElementById('betPanel');
    const stage = document.getElementById('gameStage');

    panel.innerHTML = '';
    stage.innerHTML = '';
    document.getElementById('gameTitle').textContent = def.name;
    document.getElementById('gameSub').textContent = def.sub || 'Dicey Original';
    const icon = document.getElementById('gameHeadIcon');
    icon.textContent = def.name.slice(0, 1);
    icon.style.background = meta.accent || 'linear-gradient(140deg,#00f083,#00b85f)';

    const ctx = {
      id: id,
      panel: panel,
      stage: stage,
      ui: ui,
      meta: meta,
      onClose: null,

      /** Validates and takes the stake. Returns false when the player can't cover it. */
      bet(amount) {
        if (!(amount > 0)) { D.toast('Enter a bet amount', 'info'); return false; }
        if (amount > D.Store.balance + 1e-9) { D.toast('Not enough balance', 'lose'); return false; }
        return D.Store.wager(amount);
      },

      /** Credits the return of a round and logs it. */
      settle(bet, payout, multiplier, opts) {
        opts = opts || {};
        D.Store.credit(payout);
        D.Store.record({ game: def.name, gameId: id, bet: bet, payout: payout, multiplier: multiplier });
        if (opts.silent) return;
        const profit = D.round2(payout - bet);
        if (payout > bet) D.toast('Won ' + D.fmt(profit) + ' · ' + D.fmtMult(multiplier), 'win');
        else if (payout > 0) D.toast('Returned ' + D.fmt(payout), 'info');
        else D.toast('Lost ' + D.fmt(bet), 'lose');
      },

      /** Small strip of recent results in the top-right of the stage. */
      historyStrip() {
        const strip = D.h('<div class="hist"></div>');
        stage.appendChild(strip);
        return {
          node: strip,
          push(text, win) {
            const chip = D.h('<span class="hist-chip ' + (win ? 'win' : 'lose') + '"></span>');
            chip.textContent = text;
            strip.insertBefore(chip, strip.firstChild);
            while (strip.children.length > 8) strip.lastChild.remove();
          },
        };
      },

      banner(text, kind) {
        const old = stage.querySelector('.result-banner');
        if (old) old.remove();
        if (!text) return;
        const node = D.h('<div class="result-banner ' + (kind || '') + '"></div>');
        node.textContent = text;
        stage.appendChild(node);
      },
    };

    current = { def: def, ctx: ctx, unsub: null };
    def.mount(ctx);

    current.unsub = D.Store.onChange(() => {
      const bal = document.getElementById('gameBalance');
      if (bal) bal.textContent = D.fmt(D.Store.balance);
      D.$$('.bp-max', panel).forEach((el) => { el.textContent = 'Balance ' + D.fmt(D.Store.balance); });
    });

    overlay.hidden = false;
    document.body.classList.add('modal-open');
    if (history.replaceState) history.replaceState(null, '', '#game=' + id);
  }

  function closeGame() {
    if (!current) return;
    if (typeof current.ctx.onClose === 'function') {
      try { current.ctx.onClose(); } catch (e) { /* keep closing even if a game hiccups */ }
    }
    if (current.unsub) current.unsub();
    current = null;
    const overlay = document.getElementById('gameModal');
    overlay.hidden = true;
    document.getElementById('betPanel').innerHTML = '';
    document.getElementById('gameStage').innerHTML = '';
    document.body.classList.remove('modal-open');
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  }

  D.registerGame = registerGame;
  D.openGame = openGame;
  D.closeGame = closeGame;
  D.ui = ui;
  D.hasGame = (id) => !!registry[id];
})(window.Dicey);
