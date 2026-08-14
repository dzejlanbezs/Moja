/* Coinflip — heads or tails, ride the streak or cash out */
(function (D) {
  'use strict';

  const MULT = 1.98;

  D.registerGame({
    id: 'coinflip',
    name: 'Coinflip',
    sub: 'Virtusjack Original · 1.98\u00d7 per flip',

    mount(ctx) {
      let side = 'heads';
      let busy = false;
      let streak = 0;        // wins in the current run
      let stake = 0;         // original stake of the run
      let pot = 0;           // current collectable amount
      let spin = 0;          // accumulated rotation so the coin keeps turning

      const hist = ctx.historyStrip();
      const center = D.h(
        '<div class="stage-center">' +
          '<div class="coin-wrap">' +
            '<div class="coin3d">' +
              '<div class="coin-face coin-heads">H</div>' +
              '<div class="coin-face coin-tails">T</div>' +
            '</div>' +
          '</div>' +
          '<div class="mine-stats">' +
            '<div class="chip-stat"><b id="cfStreak">0</b><span>Streak</span></div>' +
            '<div class="chip-stat"><b id="cfPot">$0.00</b><span>Collectable</span></div>' +
            '<div class="chip-stat"><b id="cfNext">$0.00</b><span>Next flip pays</span></div>' +
          '</div>' +
        '</div>'
      );
      ctx.stage.appendChild(center);

      const coin = center.querySelector('.coin3d');
      const streakEl = center.querySelector('#cfStreak');
      const potEl = center.querySelector('#cfPot');
      const nextEl = center.querySelector('#cfNext');

      const amount = ctx.ui.amount();
      const pickRow = D.h(
        '<div class="pick-row">' +
          '<button class="pick active" data-side="heads"><i class="h"></i>Heads</button>' +
          '<button class="pick" data-side="tails"><i class="t"></i>Tails</button>' +
        '</div>'
      );
      const flipBtn = ctx.ui.action('Flip Coin');
      const cashBtn = ctx.ui.action('Collect', 'btn-ghost');
      cashBtn.hidden = true;

      ctx.panel.append(amount.node, ctx.ui.block('<span>Your pick</span>', pickRow));
      const action = D.h('<div class="bp-action"></div>');
      action.append(flipBtn, cashBtn, ctx.ui.note('Keep flipping to double up, or collect any time.'));
      ctx.panel.appendChild(action);

      pickRow.addEventListener('click', (e) => {
        const btn = e.target.closest('.pick');
        if (!btn || busy) return;
        D.$$('.pick', pickRow).forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        side = btn.dataset.side;
      });

      function paint() {
        streakEl.textContent = streak;
        potEl.textContent = D.fmt(pot);
        nextEl.textContent = D.fmt(D.round2((pot || amount.get()) * MULT));
        flipBtn.textContent = streak > 0 ? 'Flip Again (' + D.fmtMult(Math.pow(MULT, streak + 1)) + ')' : 'Flip Coin';
        cashBtn.hidden = streak === 0;
        cashBtn.textContent = 'Collect ' + D.fmt(pot);
        amount.disable(streak > 0);
      }

      amount.node.addEventListener('input', paint);
      amount.node.addEventListener('click', () => setTimeout(paint, 0));

      flipBtn.addEventListener('click', () => {
        if (D.Sfx) D.Sfx.play('flip');
        if (busy) return;

        if (streak === 0) {
          const bet = amount.get();
          if (!ctx.bet(bet)) return;
          stake = bet;
          pot = bet;
        }

        busy = true;
        flipBtn.disabled = true;
        cashBtn.disabled = true;
        ctx.result(null);

        const landed = D.rand() < 0.5 ? 'heads' : 'tails';
        const win = landed === side;

        spin += 1440 + (landed === 'tails' ? 180 : 0) + (coin.dataset.face === 'tails' ? 180 : 0);
        coin.dataset.face = landed;
        coin.style.transform = 'rotateY(' + spin + 'deg)';

        setTimeout(() => {
          if (win) {
            streak += 1;
            pot = D.round2(pot * MULT);
            ctx.result('win', D.fmtMult(D.round2(pot / stake)));
            hist.push(landed === 'heads' ? 'H' : 'T', true);
          } else {
            ctx.settle(stake, 0, 0, { silent: true });
            ctx.result('lose');
            hist.push(landed === 'heads' ? 'H' : 'T', false);
            streak = 0; pot = 0; stake = 0;
          }
          busy = false;
          flipBtn.disabled = false;
          cashBtn.disabled = false;
          paint();
        }, 1150);
      });

      cashBtn.addEventListener('click', () => {
        if (busy || streak === 0) return;
        const mult = D.round2(pot / stake);
        ctx.settle(stake, pot, mult);
        ctx.result('win', D.fmtMult(mult));
        streak = 0; pot = 0; stake = 0;
        paint();
      });

      // collecting an open run beats silently voiding it when the modal closes
      ctx.onClose = () => {
        if (streak > 0 && pot > 0) {
          D.Store.credit(pot);
          D.Store.record({ game: 'Coinflip', gameId: 'coinflip', bet: stake, payout: pot, multiplier: D.round2(pot / stake) });
        }
      };

      paint();
    },
  });
})(window.Virtusjack);
