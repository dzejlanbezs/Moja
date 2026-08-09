/* Dice — roll over / under a target, 1% house edge */
(function (D) {
  'use strict';

  D.registerGame({
    id: 'dice',
    name: 'Dice',
    sub: 'Dicey Original · 99% RTP',

    mount(ctx) {
      let mode = 'over';
      let target = 50;
      let rolling = false;

      /* ---- stage ---- */
      const hist = ctx.historyStrip();
      const center = D.h(
        '<div class="stage-center">' +
          '<div style="text-align:center">' +
            '<div class="big-num" id="diceResult">0.00</div>' +
            '<div class="big-sub" id="diceSub">Roll to begin</div>' +
          '</div>' +
          '<div class="dice-track">' +
            '<div class="dice-bar"><div class="dice-marker" data-val="0.00"></div></div>' +
            '<div class="dice-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>' +
            '<input class="slider" type="range" min="2" max="98" step="1" value="50">' +
          '</div>' +
        '</div>'
      );
      ctx.stage.appendChild(center);

      const resultEl = center.querySelector('#diceResult');
      const subEl = center.querySelector('#diceSub');
      const bar = center.querySelector('.dice-bar');
      const marker = center.querySelector('.dice-marker');
      const slider = center.querySelector('.slider');

      /* ---- panel ---- */
      const amount = ctx.ui.amount();
      const multOut = ctx.ui.readout('Multiplier');
      const chanceOut = ctx.ui.readout('Win chance');
      const profitOut = ctx.ui.readout('Profit on win');
      const rollBtn = ctx.ui.action('Roll Dice');

      const modeSeg = ctx.ui.seg(
        [{ label: 'Roll Over', value: 'over' }, { label: 'Roll Under', value: 'under' }],
        (v) => { mode = v; refresh(); },
        'over'
      );

      const targetRow = D.h('<div class="bp-readout"><span id="tgtLabel">Roll over</span><b id="tgtVal">50.00</b></div>');

      ctx.panel.append(
        amount.node,
        ctx.ui.block('<span>Direction</span>', modeSeg),
        ctx.ui.block('<span>Target</span>', targetRow),
        ctx.ui.block('', multOut.node),
        ctx.ui.block('', chanceOut.node),
        ctx.ui.block('', profitOut.node)
      );
      const action = D.h('<div class="bp-action"></div>');
      action.append(rollBtn, ctx.ui.note('Result is generated with the browser crypto RNG.'));
      ctx.panel.appendChild(action);

      const chance = () => (mode === 'over' ? 100 - target : target);
      const multiplier = () => D.round2(99 / chance());

      function refresh() {
        bar.classList.toggle('flip', mode === 'under');
        bar.style.setProperty('--split', target + '%');
        targetRow.querySelector('#tgtLabel').textContent = mode === 'over' ? 'Roll over' : 'Roll under';
        targetRow.querySelector('#tgtVal').textContent = target.toFixed(2);
        multOut.set(D.fmtMult(multiplier()));
        chanceOut.set(chance().toFixed(2) + '%');
        profitOut.set(D.fmt(D.round2(amount.get() * multiplier() - amount.get())));
      }

      slider.addEventListener('input', () => { target = parseInt(slider.value, 10); refresh(); });
      amount.node.addEventListener('input', refresh);
      amount.node.addEventListener('click', () => setTimeout(refresh, 0));

      rollBtn.addEventListener('click', () => {
        if (rolling) return;
        const bet = amount.get();
        if (!ctx.bet(bet)) return;

        rolling = true;
        rollBtn.disabled = true;
        amount.disable(true);
        slider.disabled = true;
        modeSeg.setDisabled(true);
        ctx.banner('');

        const roll = D.round2(D.rand() * 100);
        const win = mode === 'over' ? roll > target : roll < target;
        const mult = multiplier();

        // brief scramble so the number feels rolled rather than assigned
        let ticks = 0;
        const spin = setInterval(() => {
          resultEl.textContent = (D.rand() * 100).toFixed(2);
          if (++ticks > 7) {
            clearInterval(spin);
            finish();
          }
        }, 45);

        function finish() {
          resultEl.textContent = roll.toFixed(2);
          resultEl.classList.toggle('win', win);
          resultEl.classList.toggle('lose', !win);
          marker.style.left = roll + '%';
          marker.dataset.val = roll.toFixed(2);
          subEl.textContent = win ? 'Paid ' + D.fmtMult(mult) : 'No win';

          const payout = win ? D.round2(bet * mult) : 0;
          ctx.settle(bet, payout, win ? mult : 0);
          ctx.banner(win ? 'Win ' + D.fmt(D.round2(payout - bet)) : 'Lost ' + D.fmt(bet), win ? 'win' : 'lose');
          hist.push(roll.toFixed(2), win);

          rolling = false;
          rollBtn.disabled = false;
          amount.disable(false);
          slider.disabled = false;
          modeSeg.setDisabled(false);
          refresh();
        }
      });

      refresh();
    },
  });
})(window.Dicey);
