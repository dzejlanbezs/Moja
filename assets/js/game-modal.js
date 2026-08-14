/* ============================================================
   Virtusjack — game modal framework
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
      // the browser's spinner is replaced by our own stepper
      const row = node.querySelector('.bp-input-row');
      row.insertBefore(ui.stepper(input, { min: 0 }), row.firstChild);
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

    /**
     * A dropdown of our own rather than the browser's: the panel is positioned
     * on open so the bet panel cannot clip it, and it closes on a click
     * outside, on Escape or on a scroll. `node.disabled = true` still works,
     * so games drive it exactly like the old select.
     */
    select(options, onPick, value) {
      const node = D.h(
        '<div class="bp-pick">' +
          '<button class="bp-pick-btn" type="button" aria-haspopup="listbox" aria-expanded="false">' +
            '<span class="bp-pick-label"></span>' +
            '<svg class="bp-pick-caret" viewBox="0 0 24 24"><path d="M6 9.5l6 6 6-6"/></svg>' +
          '</button>' +
          '<div class="bp-pick-menu" role="listbox"></div>' +
        '</div>'
      );

      const button = node.querySelector('.bp-pick-btn');
      const label = node.querySelector('.bp-pick-label');
      const menu = node.querySelector('.bp-pick-menu');
      let current = String(value);
      let open = false;

      menu.innerHTML = options.map((o) =>
        '<button class="bp-pick-option" type="button" role="option" data-value="' + String(o.value)
          .replace(/"/g, '&quot;') + '">' +
          '<span>' + o.label + '</span>' +
          '<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>' +
        '</button>').join('');

      const paint = () => {
        const picked = options.filter((o) => String(o.value) === current)[0] || options[0];
        label.textContent = picked ? picked.label : '';
        D.$$('.bp-pick-option', menu).forEach((opt) => {
          opt.classList.toggle('on', opt.dataset.value === current);
        });
      };

      /** Sits the menu against the button in screen space, flipping up if needed. */
      const place = () => {
        const box = button.getBoundingClientRect();
        const height = Math.min(menu.scrollHeight, 240);
        const below = window.innerHeight - box.bottom - 12;
        menu.style.width = box.width + 'px';
        menu.style.left = box.left + 'px';
        if (below < height && box.top > height + 12) {
          menu.style.top = (box.top - height - 6) + 'px';
        } else {
          menu.style.top = (box.bottom + 6) + 'px';
        }
      };

      const close = () => {
        if (!open) return;
        open = false;
        node.classList.remove('open');
        button.setAttribute('aria-expanded', 'false');
      };

      const toggle = () => {
        if (node.classList.contains('is-disabled')) return;
        open = !open;
        node.classList.toggle('open', open);
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) place();
      };

      button.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
      menu.addEventListener('click', (e) => {
        const option = e.target.closest('.bp-pick-option');
        if (!option) return;
        current = option.dataset.value;
        paint();
        close();
        onPick(current);
      });

      document.addEventListener('click', (e) => { if (!node.contains(e.target)) close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);

      Object.defineProperty(node, 'disabled', {
        get() { return node.classList.contains('is-disabled'); },
        set(state) {
          node.classList.toggle('is-disabled', !!state);
          button.disabled = !!state;
          if (state) close();
        },
      });
      node.setValue = (next) => { current = String(next); paint(); };

      paint();
      return node;
    },

    /**
     * Wraps a number input in a stepper: two buttons, the mouse wheel while
     * focused, and none of the browser's own spinner. Returns the wrapper to
     * drop into the panel.
     */
    stepper(input, opts) {
      opts = opts || {};
      const field = D.h(
        '<div class="bp-field">' +
          '<span class="bp-steps">' +
            '<button class="bp-step" type="button" tabindex="-1" data-step="up" aria-label="More">' +
              '<svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5"/></svg></button>' +
            '<button class="bp-step" type="button" tabindex="-1" data-step="down" aria-label="Less">' +
              '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg></button>' +
          '</span>' +
        '</div>'
      );
      field.insertBefore(input, field.firstChild);

      // a step that suits the number on screen, unless the game asked for one
      const stepFor = (value) => {
        if (opts.step) return opts.step;
        const size = Math.abs(value);
        if (size < 10) return 1;
        if (size < 100) return 5;
        if (size < 1000) return 10;
        return 50;
      };

      const nudge = (direction) => {
        if (input.disabled) return;
        const value = parseFloat(input.value) || 0;
        const next = D.round2(value + direction * stepFor(value));
        const min = opts.min == null ? 0 : opts.min;
        input.value = Math.max(min, next).toFixed(opts.decimals == null ? 2 : opts.decimals);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (D.Sfx) D.Sfx.play('click');
      };

      field.addEventListener('click', (e) => {
        const step = e.target.closest('[data-step]');
        if (step) nudge(step.dataset.step === 'up' ? 1 : -1);
      });

      // scrolling only counts once the field has focus, so the page still scrolls
      input.addEventListener('wheel', (e) => {
        if (document.activeElement !== input) return;
        e.preventDefault();
        nudge(e.deltaY < 0 ? 1 : -1);
      }, { passive: false });

      return field;
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
    if (D.guardPlay && !D.guardPlay()) return;
    closeGame();

    const overlay = document.getElementById('gameModal');
    const panel = document.getElementById('betPanel');
    const stageOuter = document.getElementById('gameStage');

    panel.innerHTML = '';
    stageOuter.innerHTML = '';
    // games build into this wrapper, which is then scaled to whatever room the
    // board has, so a phone never has to scroll the table to see all of it
    const stage = D.h('<div class="stage-fit"></div>');
    stageOuter.appendChild(stage);
    document.getElementById('gameTitle').textContent = def.name;
    document.getElementById('gameSub').textContent = def.sub || 'Virtusjack Original';
    // the header square uses the same picture as the game's win in the strip
    const icon = document.getElementById('gameHeadIcon');
    icon.innerHTML = '<b>' + def.name.slice(0, 1) + '</b>';
    icon.style.background = meta.accent || 'linear-gradient(140deg,#00f083,#00b85f)';
    icon.dataset.thumb = id;
    if (D.applyThumbArt) D.applyThumbArt(icon.parentNode);

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

        // the result speaks through the game itself, so there is no toast — only sound
        if (opts.silent || !D.Sfx) return;
        D.Sfx.play(payout > bet ? (multiplier >= 8 ? 'big' : 'win') : payout > 0 ? 'push' : 'lose');
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

      /**
       * The result, said once and briefly: WIN with the multiplier, or LOST.
       * Called with no kind it just clears whatever is showing.
       */
      result(kind, detail) {
        const old = stage.querySelector('.result-pop');
        if (old) old.remove();
        if (!kind) return;

        const word = kind === 'win' ? 'WIN' : kind === 'push' ? 'PUSH' : 'LOST';
        const node = D.h('<div class="result-pop ' + kind + '"><b></b><span></span></div>');
        node.querySelector('b').textContent = word;
        const tail = node.querySelector('span');
        if (detail) tail.textContent = detail; else tail.remove();
        stage.appendChild(node);

        setTimeout(() => {
          node.classList.add('gone');
          setTimeout(() => node.remove(), 320);
        }, 2600);
      },
    };

    current = { def: def, ctx: ctx, unsub: null, watch: null };
    def.mount(ctx);

    /**
     * Measures what the board actually covers, not the box it was given: a flex
     * row that has run out of height lets its cards and tiles spill outside its
     * own box, and those still have to be seen.
     */
    const contentBox = () => {
      const box = stage.getBoundingClientRect();
      const edges = { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
      stage.querySelectorAll('*').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        edges.top = Math.min(edges.top, rect.top);
        edges.bottom = Math.max(edges.bottom, rect.bottom);
        edges.left = Math.min(edges.left, rect.left);
        edges.right = Math.max(edges.right, rect.right);
      });
      return edges;
    };

    /**
     * Shrinks the board until all of it fits the space it has, and slides it so
     * what is left sits in the middle. It never enlarges anything.
     */
    const fitStage = () => {
      stage.style.transform = 'none';
      const room = { w: stageOuter.clientWidth - 4, h: stageOuter.clientHeight - 4 };
      if (!room.w || !room.h) return;

      const box = stage.getBoundingClientRect();
      const content = contentBox();
      const size = { w: content.right - content.left, h: content.bottom - content.top };
      if (!size.w || !size.h) return;

      const scale = Math.min(1, room.w / size.w, room.h / size.h);
      if (Math.abs(scale - 1) < 0.02) return;

      // the box is centred in the stage, so pull the content's own centre onto it
      const shift = {
        x: -scale * ((content.left + content.right) / 2 - (box.left + box.right) / 2),
        y: -scale * ((content.top + content.bottom) / 2 - (box.top + box.bottom) / 2),
      };
      stage.style.transform = 'translate(' + shift.x.toFixed(2) + 'px,' + shift.y.toFixed(2) + 'px)' +
        ' scale(' + scale.toFixed(4) + ')';
    };

    fitStage();
    if (window.ResizeObserver) {
      // cards, tiles and rows come and go mid-round, so refit whenever they do
      current.watch = new ResizeObserver(fitStage);
      current.watch.observe(stage);
      current.watch.observe(stageOuter);
    }
    window.addEventListener('resize', fitStage);
    current.unfit = () => window.removeEventListener('resize', fitStage);

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
    if (current.watch) current.watch.disconnect();
    if (current.unfit) current.unfit();
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
})(window.Virtusjack);
