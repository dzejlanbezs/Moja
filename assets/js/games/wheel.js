/* Wheel — 12 segments, three risk levels */
(function (D) {
  'use strict';

  const SEGMENTS = {
    low: [1.2, 0, 1.2, 1.5, 1.2, 0, 1.2, 1.5, 1.2, 0, 1.2, 1.5],
    medium: [0, 1.5, 0, 2, 0, 1.5, 0, 3, 0, 1.5, 0, 2],
    high: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 9.9],
  };

  function color(m) {
    if (m === 0) return '#2b3348';
    if (m < 1.4) return '#4fd6a0';
    if (m < 2) return '#ffcc33';
    if (m < 5) return '#ff8a3d';
    return '#ff4757';
  }

  D.registerGame({
    id: 'wheel',
    name: 'Wheel',
    sub: 'Virtusjack Original · spin to win',

    mount(ctx) {
      let risk = 'medium';
      let spinning = false;
      let rotation = 0;

      const hist = ctx.historyStrip();
      const center = D.h(
        '<div class="stage-center">' +
          '<div class="wheel-wrap">' +
            '<div class="wheel-pointer"></div>' +
            '<div class="wheel"></div>' +
            '<div class="wheel-hub">—</div>' +
          '</div>' +
          '<div class="wheel-legend"></div>' +
        '</div>'
      );
      ctx.stage.appendChild(center);

      const wheel = center.querySelector('.wheel');
      const hub = center.querySelector('.wheel-hub');
      const legend = center.querySelector('.wheel-legend');

      const amount = ctx.ui.amount();
      const riskSeg = ctx.ui.seg(
        [{ label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' }],
        (v) => { risk = v; paintWheel(); },
        'medium'
      );
      const spinBtn = ctx.ui.action('Spin');

      ctx.panel.append(amount.node, ctx.ui.block('<span>Risk</span>', riskSeg));
      const action = D.h('<div class="bp-action"></div>');
      action.append(spinBtn, ctx.ui.note('12 segments. High risk hides one 9.9\u00d7 slice.'));
      ctx.panel.appendChild(action);

      function paintWheel() {
        const segs = SEGMENTS[risk];
        const size = 360 / segs.length;
        const stops = segs.map((m, i) => color(m) + ' ' + (i * size) + 'deg ' + ((i + 1) * size) + 'deg');
        wheel.style.background = 'conic-gradient(' + stops.join(',') + ')';

        const unique = [];
        segs.forEach((m) => { if (unique.indexOf(m) === -1) unique.push(m); });
        unique.sort((a, b) => a - b);
        legend.innerHTML = '';
        unique.forEach((m) => {
          const item = D.h('<span><i></i></span>');
          item.querySelector('i').style.background = color(m);
          item.appendChild(document.createTextNode(m + '\u00d7'));
          legend.appendChild(item);
        });
      }

      spinBtn.addEventListener('click', () => {
        if (D.Sfx) D.Sfx.play('spin');
        if (spinning) return;
        const bet = amount.get();
        if (!ctx.bet(bet)) return;

        const segs = SEGMENTS[risk];
        const size = 360 / segs.length;
        const index = D.randInt(segs.length);
        const mult = segs[index];

        spinning = true;
        spinBtn.disabled = true;
        amount.disable(true);
        riskSeg.setDisabled(true);
        ctx.banner('');
        hub.textContent = '—';

        const base = Math.ceil(rotation / 360) * 360;
        rotation = base + 360 * 5 + (360 - (index * size + size / 2));
        wheel.style.transform = 'rotate(' + rotation + 'deg)';

        setTimeout(() => {
          const payout = D.round2(bet * mult);
          hub.textContent = mult + '\u00d7';
          hub.style.color = color(mult);
          ctx.settle(bet, payout, mult);
          ctx.banner(mult ? 'Landed ' + mult + '\u00d7 · ' + D.fmt(payout) : 'Landed on 0\u00d7', payout > bet ? 'win' : 'lose');
          hist.push(mult + '\u00d7', payout > bet);
          spinning = false;
          spinBtn.disabled = false;
          amount.disable(false);
          riskSeg.setDisabled(false);
        }, 4100);
      });

      paintWheel();
    },
  });
})(window.Virtusjack);
