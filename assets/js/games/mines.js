/* Mines — reveal gems, cash out before you hit a mine */
(function (D) {
  'use strict';

  const SIZE = 25;
  const EDGE = 0.99;

  const GEM = '<svg class="gem-ico" viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9l4-6Z"/></svg>';
  const BOMB = '<svg class="bomb-ico" viewBox="0 0 24 24"><circle cx="10.5" cy="14.5" r="6.5"/><path d="M16 9l4-4M19 4h2v2"/></svg>';

  // gem.png and mine.png in assets/img/mines take over when they are there
  const art = { gem: '', mine: '' };
  const picture = (url) => '<span class="cell-img" style="background-image:url(\'' + url + '\')"></span>';
  const gemHtml = () => (art.gem ? picture(art.gem) : GEM);
  const mineHtml = () => (art.mine ? picture(art.mine) : BOMB);
  D.Art.load().then(() => {
    art.gem = D.Art.get('mines', 'gem');
    art.mine = D.Art.get('mines', 'mine');
  });

  function comb(n, k) {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  }
  const multFor = (mines, picks) => (picks === 0 ? 1 : D.round2(EDGE * comb(SIZE, picks) / comb(SIZE - mines, picks)));

  D.registerGame({
    id: 'mines',
    name: 'Mines',
    sub: 'Virtusjack Original · pick your risk',

    mount(ctx) {
      let mines = 3;
      let field = [];
      let picks = 0;
      let active = false;
      let stake = 0;

      const hist = ctx.historyStrip();
      const center = D.h(
        '<div class="stage-center">' +
          '<div class="mine-stats">' +
            '<div class="chip-stat"><b id="mMult">1.00\u00d7</b><span>Multiplier</span></div>' +
            '<div class="chip-stat"><b id="mCash">$0.00</b><span>Cash out</span></div>' +
            '<div class="chip-stat"><b id="mNext">—</b><span>Next gem</span></div>' +
          '</div>' +
          '<div class="mine-grid"></div>' +
        '</div>'
      );
      ctx.stage.appendChild(center);

      const grid = center.querySelector('.mine-grid');
      const multEl = center.querySelector('#mMult');
      const cashEl = center.querySelector('#mCash');
      const nextEl = center.querySelector('#mNext');

      const amount = ctx.ui.amount();
      const minesSelect = ctx.ui.select(
        [1, 2, 3, 5, 8, 10, 15, 20, 24].map((n) => ({ value: n, label: n + (n === 1 ? ' mine' : ' mines') })),
        (v) => { mines = parseInt(v, 10); buildBoard(); paint(); },
        3
      );
      const startBtn = ctx.ui.action('Start Game');
      const cashBtn = ctx.ui.action('Cash Out', 'btn-ghost');
      cashBtn.hidden = true;

      ctx.panel.append(amount.node, ctx.ui.block('<span>Mines</span>', minesSelect));
      const action = D.h('<div class="bp-action"></div>');
      action.append(startBtn, cashBtn, ctx.ui.note('More mines, bigger jumps — one wrong tile ends the round.'));
      ctx.panel.appendChild(action);

      function buildBoard() {
        grid.innerHTML = '';
        for (let i = 0; i < SIZE; i++) {
          const cell = D.h('<button class="cell" type="button"></button>');
          cell.dataset.index = i;
          cell.disabled = !active;
          grid.appendChild(cell);
        }
      }

      function paint() {
        const mult = multFor(mines, picks);
        multEl.textContent = D.fmtMult(mult);
        cashEl.textContent = D.fmt(active ? D.round2(stake * mult) : 0);
        nextEl.textContent = picks + mines >= SIZE ? '—' : D.fmtMult(multFor(mines, picks + 1));
        startBtn.hidden = active;
        cashBtn.hidden = !active;
        cashBtn.disabled = picks === 0;
        cashBtn.textContent = picks === 0 ? 'Pick a tile first' : 'Cash Out ' + D.fmt(D.round2(stake * mult));
        amount.disable(active);
        minesSelect.disabled = active;
      }

      function start() {
        const bet = amount.get();
        if (!ctx.bet(bet)) return;
        stake = bet;
        picks = 0;
        active = true;
        field = new Array(SIZE).fill(false);
        D.shuffle(Array.from({ length: SIZE }, (_, i) => i)).slice(0, mines).forEach((i) => { field[i] = true; });
        buildBoard();
        D.$$('.cell', grid).forEach((c) => { c.disabled = false; });
        ctx.result(null);
        paint();
      }

      function revealAll(hitIndex) {
        D.$$('.cell', grid).forEach((cell) => {
          const i = +cell.dataset.index;
          cell.disabled = true;
          if (field[i]) {
            cell.classList.add('bomb');
            cell.innerHTML = mineHtml();
            if (i !== hitIndex) cell.classList.add('dim');
          } else if (!cell.classList.contains('gem')) {
            cell.classList.add('dim');
            cell.innerHTML = gemHtml();
          }
        });
      }

      function cashOut() {
        if (!active || picks === 0) return;
        const mult = multFor(mines, picks);
        const payout = D.round2(stake * mult);
        active = false;
        ctx.settle(stake, payout, mult);
        ctx.result('win', D.fmtMult(mult));
        hist.push(D.fmtMult(mult), true);
        revealAll(-1);
        paint();
      }

      grid.addEventListener('click', (e) => {
        const cell = e.target.closest('.cell');
        if (!cell || cell.disabled || !active) return;
        const i = +cell.dataset.index;
        cell.disabled = true;
        cell.classList.add('cell-pop');

        if (field[i]) {
          cell.classList.add('bomb');
          cell.innerHTML = mineHtml();
          if (D.Sfx) D.Sfx.play('mine');
          active = false;
          ctx.settle(stake, 0, 0);
          ctx.result('lose');
          hist.push('\u2717', false);
          revealAll(i);
          paint();
          return;
        }

        cell.classList.add('gem');
        cell.innerHTML = gemHtml();
        if (D.Sfx) D.Sfx.play('gem');
        picks += 1;
        paint();

        if (picks + mines === SIZE) cashOut();
      });

      startBtn.addEventListener('click', start);
      cashBtn.addEventListener('click', cashOut);
      ctx.onClose = () => { if (active && picks > 0) cashOut(); else if (active) ctx.settle(stake, 0, 0, { silent: true }); };

      buildBoard();
      paint();
    },
  });
})(window.Virtusjack);
