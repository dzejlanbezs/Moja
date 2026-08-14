/* Keno — pick up to 10 of 40, we draw 10 */
(function (D) {
  'use strict';

  const TOTAL = 40;
  const DRAWN = 10;
  const MAX_PICKS = 10;

  const PAY = {
    1: [0, 1.9],
    2: [0, 2, 3.8],
    3: [0, 1.1, 1.38, 26],
    4: [0, 0, 2.2, 7.9, 90],
    5: [0, 0, 1.5, 4.2, 13, 300],
    6: [0, 0, 1.1, 2, 6.2, 100, 700],
    7: [0, 0, 1.1, 1.6, 3.5, 15, 225, 700],
    8: [0, 0, 1.1, 1.5, 2, 5.5, 39, 100, 800],
    9: [0, 0, 1.1, 1.3, 1.7, 2.5, 7.5, 50, 250, 1000],
    10: [0, 0, 1.1, 1.2, 1.3, 1.8, 3.5, 13, 50, 250, 1000],
  };

  D.registerGame({
    id: 'keno',
    name: 'Keno',
    sub: 'Virtusjack Original · up to 1000\u00d7',

    mount(ctx) {
      const picked = new Set();
      let busy = false;

      const hist = ctx.historyStrip();
      const center = D.h(
        '<div class="stage-center">' +
          '<div class="keno-grid"></div>' +
          '<div class="pay-table" id="payTable"></div>' +
        '</div>'
      );
      ctx.stage.appendChild(center);
      const grid = center.querySelector('.keno-grid');
      const payTable = center.querySelector('#payTable');

      for (let n = 1; n <= TOTAL; n++) {
        const cell = D.h('<button class="keno-cell" type="button"></button>');
        cell.textContent = n;
        cell.dataset.n = n;
        grid.appendChild(cell);
      }

      const amount = ctx.ui.amount();
      const picksOut = ctx.ui.readout('Numbers picked', '0 / 10');
      const playBtn = ctx.ui.action('Play Round');
      const autoBtn = D.h('<button class="btn btn-ghost btn-block">Auto pick 10</button>');
      const clearBtn = D.h('<button class="btn btn-ghost btn-block">Clear picks</button>');

      ctx.panel.append(amount.node, ctx.ui.block('', picksOut.node), ctx.ui.block('', autoBtn), ctx.ui.block('', clearBtn));
      const action = D.h('<div class="bp-action"></div>');
      action.append(playBtn, ctx.ui.note('10 of 40 numbers are drawn each round.'));
      ctx.panel.appendChild(action);

      function paintPayTable(hits) {
        const table = PAY[picked.size];
        payTable.innerHTML = '';
        if (!table) {
          payTable.appendChild(D.h('<div class="bp-note">Pick 1 to 10 numbers to see the paytable</div>'));
          return;
        }
        table.forEach((mult, i) => {
          const cell = D.h('<div class="pay-cell' + (hits === i ? ' on' : '') + '"><b></b><span></span></div>');
          cell.querySelector('b').textContent = mult ? mult + '\u00d7' : '0\u00d7';
          cell.querySelector('span').textContent = i + ' hit' + (i === 1 ? '' : 's');
          payTable.appendChild(cell);
        });
      }

      function paint() {
        picksOut.set(picked.size + ' / ' + MAX_PICKS);
        playBtn.disabled = busy || picked.size === 0;
        paintPayTable(-1);
      }

      function reset() {
        D.$$('.keno-cell', grid).forEach((c) => {
          c.classList.remove('hit', 'drawn');
          c.disabled = false;
          c.classList.toggle('picked', picked.has(+c.dataset.n));
        });
      }

      grid.addEventListener('click', (e) => {
        const cell = e.target.closest('.keno-cell');
        if (!cell || busy) return;
        const n = +cell.dataset.n;
        if (picked.has(n)) picked.delete(n);
        else if (picked.size >= MAX_PICKS) { D.toast('Maximum 10 numbers', 'info'); return; }
        else picked.add(n);
        reset();
        paint();
      });

      autoBtn.addEventListener('click', () => {
        if (busy) return;
        picked.clear();
        D.shuffle(Array.from({ length: TOTAL }, (_, i) => i + 1)).slice(0, MAX_PICKS).forEach((n) => picked.add(n));
        reset();
        paint();
      });

      clearBtn.addEventListener('click', () => {
        if (busy) return;
        picked.clear();
        reset();
        paint();
      });

      playBtn.addEventListener('click', () => {
        if (busy || picked.size === 0) return;
        const bet = amount.get();
        if (!ctx.bet(bet)) return;

        busy = true;
        playBtn.disabled = true;
        autoBtn.disabled = true;
        clearBtn.disabled = true;
        amount.disable(true);
        reset();
        ctx.result(null);

        const draw = D.shuffle(Array.from({ length: TOTAL }, (_, i) => i + 1)).slice(0, DRAWN);
        let hits = 0;
        let i = 0;

        const timer = setInterval(() => {
          const n = draw[i++];
          const cell = grid.querySelector('.keno-cell[data-n="' + n + '"]');
          if (picked.has(n)) { cell.classList.add('hit'); hits++; if (D.Sfx) D.Sfx.play('gem'); }
          else { cell.classList.add('drawn'); if (D.Sfx) D.Sfx.play('tick'); }
          paintPayTable(hits);
          if (i >= draw.length) { clearInterval(timer); finish(hits); }
        }, 110);

        function finish(hitCount) {
          const mult = PAY[picked.size][hitCount] || 0;
          const payout = D.round2(bet * mult);
          ctx.settle(bet, payout, mult);
          ctx.result(payout > bet ? 'win' : 'lose', payout > bet ? D.fmtMult(mult) : '');
          hist.push(hitCount + '/' + picked.size, payout > bet);
          paintPayTable(hitCount);
          busy = false;
          playBtn.disabled = false;
          autoBtn.disabled = false;
          clearBtn.disabled = false;
          amount.disable(false);
        }
      });

      paint();
    },
  });
})(window.Virtusjack);
