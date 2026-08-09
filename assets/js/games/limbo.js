/* Limbo — pick a target multiplier, the round has to reach it */
(function (D) {
  'use strict';

  const EDGE = 0.99;
  const MAX = 1000000;

  D.registerGame({
    id: 'limbo',
    name: 'Limbo',
    sub: 'Dicey Original · 99% RTP',

    mount(ctx) {
      let target = 2;
      let busy = false;

      const hist = ctx.historyStrip();
      const center = D.h(
        '<div class="stage-center">' +
          '<div style="text-align:center">' +
            '<div class="big-num" id="limboOut">1.00\u00d7</div>' +
            '<div class="big-sub" id="limboSub">Set a target and play</div>' +
          '</div>' +
        '</div>'
      );
      ctx.stage.appendChild(center);
      const out = center.querySelector('#limboOut');
      const sub = center.querySelector('#limboSub');

      const amount = ctx.ui.amount();
      const targetInput = D.h('<input class="bp-input" type="number" min="1.01" step="0.01" value="2.00">');
      const chanceOut = ctx.ui.readout('Win chance');
      const profitOut = ctx.ui.readout('Profit on win');
      const playBtn = ctx.ui.action('Play');

      const quick = ctx.ui.seg(
        [{ label: '1.5\u00d7', value: 1.5 }, { label: '2\u00d7', value: 2 }, { label: '5\u00d7', value: 5 }, { label: '25\u00d7', value: 25 }],
        (v) => { targetInput.value = parseFloat(v).toFixed(2); readTarget(); },
        2
      );

      ctx.panel.append(
        amount.node,
        ctx.ui.block('<span>Target multiplier</span>', targetInput),
        ctx.ui.block('', quick),
        ctx.ui.block('', chanceOut.node),
        ctx.ui.block('', profitOut.node)
      );
      const action = D.h('<div class="bp-action"></div>');
      action.append(playBtn, ctx.ui.note('Win chance = 99 / target. Payout equals your target.'));
      ctx.panel.appendChild(action);

      function readTarget() {
        const v = parseFloat(targetInput.value);
        target = D.clamp(isFinite(v) ? v : 2, 1.01, MAX);
        refresh();
      }

      function refresh() {
        chanceOut.set((EDGE / target * 100).toFixed(4) + '%');
        profitOut.set(D.fmt(D.round2(amount.get() * target - amount.get())));
      }

      targetInput.addEventListener('input', readTarget);
      targetInput.addEventListener('blur', () => { targetInput.value = target.toFixed(2); });
      amount.node.addEventListener('input', refresh);
      amount.node.addEventListener('click', () => setTimeout(refresh, 0));

      playBtn.addEventListener('click', () => {
        if (busy) return;
        readTarget();
        const bet = amount.get();
        if (!ctx.bet(bet)) return;

        busy = true;
        playBtn.disabled = true;
        amount.disable(true);
        targetInput.disabled = true;
        quick.setDisabled(true);
        ctx.banner('');

        const r = Math.max(1e-9, D.rand());
        const crash = Math.min(MAX, Math.max(1, D.round2(EDGE / r)));
        const win = crash >= target;

        // count up toward the outcome for a bit of tension
        const start = performance.now();
        const dur = 620;
        (function tick(now) {
          const t = Math.min(1, ((now || performance.now()) - start) / dur);
          const shown = 1 + (crash - 1) * (1 - Math.pow(1 - t, 3));
          out.textContent = shown.toFixed(2) + '\u00d7';
          if (t < 1) requestAnimationFrame(tick);
          else finish();
        })();

        function finish() {
          out.textContent = crash.toFixed(2) + '\u00d7';
          out.classList.toggle('win', win);
          out.classList.toggle('lose', !win);
          sub.textContent = win ? 'Target ' + target.toFixed(2) + '\u00d7 reached' : 'Below target ' + target.toFixed(2) + '\u00d7';

          const payout = win ? D.round2(bet * target) : 0;
          ctx.settle(bet, payout, win ? target : 0);
          ctx.banner(win ? 'Win ' + D.fmt(D.round2(payout - bet)) : 'Lost ' + D.fmt(bet), win ? 'win' : 'lose');
          hist.push(crash.toFixed(2) + '\u00d7', win);

          busy = false;
          playBtn.disabled = false;
          amount.disable(false);
          targetInput.disabled = false;
          quick.setDisabled(false);
          refresh();
        }
      });

      refresh();
    },
  });
})(window.Dicey);
