/* Black Holes — the drawing game: open holes, add up what falls out */
(function (D) {
  'use strict';

  const HOLES = 16;
  const DRAWS = 3;

  // weights are tuned so three draws return ~98% of the stake on average
  const TABLE = [
    { v: 0, w: 595.6 },
    { v: 0.1, w: 150 },
    { v: 0.2, w: 100 },
    { v: 0.5, w: 70 },
    { v: 1, w: 52 },
    { v: 2, w: 22 },
    { v: 5, w: 8 },
    { v: 20, w: 1.5 },
    { v: 100, w: 0.9 },
  ];

  D.registerGame({
    id: 'blackholes',
    name: 'Black Holes',
    sub: 'Dicey Original · the drawing game',

    mount(ctx) {
      let active = false;
      let stake = 0;
      let drawn = [];
      let values = [];

      const hist = ctx.historyStrip();
      const center = D.h(
        '<div class="stage-center">' +
          '<div class="draw-slots">' +
            '<div class="draw-slot">—</div><div class="draw-slot">—</div><div class="draw-slot">—</div>' +
          '</div>' +
          '<div class="hole-grid"></div>' +
          '<div class="mine-stats">' +
            '<div class="chip-stat"><b id="bhTotal">0.00\u00d7</b><span>Total multiplier</span></div>' +
            '<div class="chip-stat"><b id="bhPay">$0.00</b><span>Payout</span></div>' +
            '<div class="chip-stat"><b id="bhLeft">3</b><span>Draws left</span></div>' +
          '</div>' +
        '</div>'
      );
      ctx.stage.appendChild(center);

      const grid = center.querySelector('.hole-grid');
      const slots = D.$$('.draw-slot', center);
      const totalEl = center.querySelector('#bhTotal');
      const payEl = center.querySelector('#bhPay');
      const leftEl = center.querySelector('#bhLeft');

      const amount = ctx.ui.amount();
      const startBtn = ctx.ui.action('Place Bet');
      const topOut = ctx.ui.readout('Top prize', '100\u00d7 per hole');

      ctx.panel.append(amount.node, ctx.ui.block('', topOut.node));
      const action = D.h('<div class="bp-action"></div>');
      action.append(startBtn, ctx.ui.note('Open three of the sixteen holes. Their multipliers are added together.'));
      ctx.panel.appendChild(action);

      function build() {
        grid.innerHTML = '';
        for (let i = 0; i < HOLES; i++) {
          const hole = D.h('<button class="hole" type="button"></button>');
          hole.dataset.index = i;
          hole.disabled = true;
          grid.appendChild(hole);
        }
        slots.forEach((s) => { s.textContent = '—'; s.classList.remove('filled'); });
      }

      function paint() {
        const total = D.round2(values.reduce((a, b) => a + b, 0));
        totalEl.textContent = total.toFixed(2) + '\u00d7';
        payEl.textContent = D.fmt(D.round2(stake * total));
        leftEl.textContent = DRAWS - drawn.length;
        startBtn.hidden = active;
        amount.disable(active);
      }

      function start() {
        const bet = amount.get();
        if (!ctx.bet(bet)) return;
        stake = bet;
        active = true;
        drawn = [];
        values = [];
        build();
        D.$$('.hole', grid).forEach((h) => { h.disabled = false; });
        ctx.banner('');
        paint();
      }

      grid.addEventListener('click', (e) => {
        const hole = e.target.closest('.hole');
        if (!hole || hole.disabled || !active) return;
        const value = D.pickWeighted(TABLE).v;
        hole.disabled = true;
        hole.classList.add('open');
        hole.classList.toggle('zero', value === 0);
        hole.classList.toggle('big', value >= 5);
        hole.textContent = value === 0 ? '0\u00d7' : value + '\u00d7';

        drawn.push(+hole.dataset.index);
        values.push(value);
        const slot = slots[drawn.length - 1];
        slot.textContent = value + '\u00d7';
        slot.classList.add('filled');
        paint();

        if (drawn.length === DRAWS) finish();
      });

      function finish() {
        active = false;
        D.$$('.hole', grid).forEach((h) => { h.disabled = true; });
        const total = D.round2(values.reduce((a, b) => a + b, 0));
        const payout = D.round2(stake * total);
        ctx.settle(stake, payout, total);
        ctx.banner(
          total > 0 ? 'Drew ' + total.toFixed(2) + '\u00d7 · ' + D.fmt(payout) : 'All three holes were empty',
          payout > stake ? 'win' : 'lose'
        );
        hist.push(total.toFixed(2) + '\u00d7', payout > stake);
        paint();
      }

      startBtn.addEventListener('click', start);
      ctx.onClose = () => {
        if (!active) return;
        const total = D.round2(values.reduce((a, b) => a + b, 0));
        ctx.settle(stake, D.round2(stake * total), total, { silent: true });
      };

      build();
      paint();
    },
  });
})(window.Dicey);
