/* Dice — roll over / under a target, 1% house edge */
(function (D) {
  'use strict';

  D.registerGame({
    id: 'dice',
    name: 'Dice',
    sub: 'Virtusjack Original · 99% RTP',

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

      // auto play: a stake, a number of bets, and it works through them itself
      const autoInput = D.h('<input class="bp-input" type="number" min="1" step="1" value="10">');
      const autoField = ctx.ui.stepper(autoInput, { step: 5, min: 1, decimals: 0 });
      const autoBtn = ctx.ui.action('Start Auto', 'btn-ghost');
      const autoLeft = ctx.ui.readout('Bets left');
      const autoLeftBlock = ctx.ui.block('', autoLeft.node);
      autoLeftBlock.classList.add('only-wide');

      // the count sits beside its button, inside the part of the panel that is
      // always on screen, so a phone never has to scroll for it
      const autoRow = D.h('<div class="bp-auto-row"><span class="bp-auto-label">Bets</span></div>');
      autoRow.append(autoField, autoBtn);

      // the win chance is the one readout a phone can do without
      const chanceBlock = ctx.ui.block('', chanceOut.node);
      chanceBlock.classList.add('only-wide');

      ctx.panel.append(
        amount.node,
        ctx.ui.block('<span>Direction</span>', modeSeg),
        ctx.ui.block('<span>Target</span>', targetRow),
        ctx.ui.block('', multOut.node),
        chanceBlock,
        ctx.ui.block('', profitOut.node),
        autoLeftBlock
      );
      const action = D.h('<div class="bp-action"></div>');
      action.append(rollBtn, autoRow, ctx.ui.note('Result is generated with the browser crypto RNG.'));
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

      /** One roll. `after` runs once it has settled, which is how auto keeps going. */
      function roll(after) {
        if (rolling) return false;
        const bet = amount.get();
        if (!ctx.bet(bet)) return false;

        rolling = true;
        rollBtn.disabled = true;
        autoBtn.disabled = !auto.on;
        amount.disable(true);
        slider.disabled = true;
        modeSeg.setDisabled(true);
        ctx.result(null);

        const rolled = D.round2(D.rand() * 100);
        const win = mode === 'over' ? rolled > target : rolled < target;
        const mult = multiplier();

        // brief scramble so the number feels rolled rather than assigned
        let ticks = 0;
        const spin = setInterval(() => {
          resultEl.textContent = (D.rand() * 100).toFixed(2);
          if (D.Sfx) D.Sfx.play('tick');
          if (++ticks > 7) {
            clearInterval(spin);
            finish();
          }
        }, 45);

        function finish() {
          resultEl.textContent = rolled.toFixed(2);
          resultEl.classList.toggle('win', win);
          resultEl.classList.toggle('lose', !win);
          marker.style.left = rolled + '%';
          marker.dataset.val = rolled.toFixed(2);
          subEl.textContent = win ? 'Paid ' + D.fmtMult(mult) : 'No win';

          const payout = win ? D.round2(bet * mult) : 0;
          ctx.settle(bet, payout, win ? mult : 0);
          hist.push(rolled.toFixed(2), win);

          rolling = false;
          rollBtn.disabled = auto.on;
          autoBtn.disabled = false;
          amount.disable(auto.on);
          slider.disabled = auto.on;
          modeSeg.setDisabled(auto.on);
          refresh();
          if (after) after();
        }
        return true;
      }

      /* ---- auto play ---- */

      const auto = { on: false, left: 0, timer: 0 };

      function paintAuto() {
        autoBtn.textContent = auto.on ? 'Stop Auto · ' + auto.left + ' left' : 'Start Auto';
        autoBtn.classList.toggle('btn-danger', auto.on);
        autoBtn.classList.toggle('btn-ghost', !auto.on);
        autoLeft.set(auto.on ? auto.left + ' to go' : '—');
        autoInput.disabled = auto.on;
        rollBtn.disabled = auto.on || rolling;
      }

      function stopAuto(note) {
        auto.on = false;
        auto.left = 0;
        clearTimeout(auto.timer);
        amount.disable(false);
        slider.disabled = false;
        modeSeg.setDisabled(false);
        paintAuto();
        if (note) D.toast(note, 'info');
      }

      /** Places one bet, waits a beat so it can be watched, then places the next. */
      function step() {
        if (!auto.on) return;
        if (auto.left <= 0) { stopAuto(); return; }
        if (amount.get() > D.Store.balance + 1e-9) { stopAuto('Auto stopped — not enough balance'); return; }

        auto.left -= 1;
        paintAuto();
        const started = roll(() => { auto.timer = setTimeout(step, 700); });
        if (!started) stopAuto();
      }

      autoBtn.addEventListener('click', () => {
        if (auto.on) { stopAuto(); return; }
        const rounds = Math.max(1, Math.min(1000, parseInt(autoInput.value, 10) || 0));
        if (amount.get() <= 0) { D.toast('Enter a bet amount', 'info'); return; }
        auto.on = true;
        auto.left = rounds;
        amount.disable(true);
        slider.disabled = true;
        modeSeg.setDisabled(true);
        paintAuto();
        step();
      });

      rollBtn.addEventListener('click', () => { if (!auto.on) roll(); });
      ctx.onClose = () => stopAuto();

      refresh();
      paintAuto();
    },
  });
})(window.Virtusjack);
