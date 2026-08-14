/* Plinko — drop balls through 12 rows of pegs */
(function (D) {
  'use strict';

  const ROWS = 12;
  const TABLES = {
    low: [8.4, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 8.4],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  };

  function bucketColor(mult) {
    if (mult >= 20) return '#ff4757';
    if (mult >= 4) return '#ff8a3d';
    if (mult >= 1.5) return '#ffcc33';
    if (mult >= 1) return '#9ede4d';
    return '#4fd6a0';
  }

  D.registerGame({
    id: 'plinko',
    name: 'Plinko',
    sub: 'Virtusjack Original · drop and pray',

    mount(ctx) {
      let risk = 'medium';
      let raf = 0;
      const balls = [];

      const hist = ctx.historyStrip();
      const wrap = D.h(
        '<div class="stage-center">' +
          '<div class="plinko-wrap">' +
            '<canvas id="plinkoCanvas" width="560" height="380"></canvas>' +
            '<div class="plinko-buckets" id="buckets"></div>' +
          '</div>' +
        '</div>'
      );
      ctx.stage.appendChild(wrap);

      const canvas = wrap.querySelector('#plinkoCanvas');
      const c2d = canvas.getContext('2d');
      const bucketsEl = wrap.querySelector('#buckets');

      const amount = ctx.ui.amount();
      const riskSeg = ctx.ui.seg(
        [{ label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' }],
        (v) => { risk = v; renderBuckets(); },
        'medium'
      );
      const dropBtn = ctx.ui.action('Drop Ball');

      ctx.panel.append(amount.node, ctx.ui.block('<span>Risk</span>', riskSeg), ctx.ui.block('<span>Rows</span>', ctx.ui.readout('Pegs', ROWS + ' rows').node));
      const action = D.h('<div class="bp-action"></div>');
      action.append(dropBtn, ctx.ui.note('Drop as many balls as you like — each one is its own bet.'));
      ctx.panel.appendChild(action);

      const W = canvas.width, H = canvas.height;
      const step = W / (ROWS + 4);
      const topY = 34;
      const rowGap = (H - topY - 30) / ROWS;

      function pegPositions() {
        const pegs = [];
        for (let r = 0; r < ROWS; r++) {
          const count = r + 3;
          const y = topY + r * rowGap;
          for (let i = 0; i < count; i++) {
            pegs.push({ x: W / 2 + (i - (count - 1) / 2) * step, y: y });
          }
        }
        return pegs;
      }
      const pegs = pegPositions();

      function renderBuckets() {
        const table = TABLES[risk];
        bucketsEl.innerHTML = '';
        table.forEach((m, i) => {
          const b = D.h('<div class="bucket"></div>');
          b.dataset.index = i;
          b.style.background = bucketColor(m);
          b.textContent = m + '\u00d7';
          bucketsEl.appendChild(b);
        });
      }

      function draw() {
        c2d.clearRect(0, 0, W, H);
        c2d.fillStyle = 'rgba(255,255,255,.22)';
        pegs.forEach((p) => {
          c2d.beginPath();
          c2d.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
          c2d.fill();
        });

        balls.forEach((ball) => {
          const grad = c2d.createRadialGradient(ball.x - 2, ball.y - 3, 1, ball.x, ball.y, 9);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(1, '#00c853');
          c2d.beginPath();
          c2d.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
          c2d.fillStyle = grad;
          c2d.fill();
        });

        if (balls.length) raf = requestAnimationFrame(tick);
        else raf = 0;
      }

      function tick() {
        const now = performance.now();
        for (let i = balls.length - 1; i >= 0; i--) {
          const ball = balls[i];
          const t = (now - ball.start) / ball.rowMs;
          const row = Math.floor(t);
          if (row >= ROWS) {
            land(ball);
            balls.splice(i, 1);
            continue;
          }
          const frac = t - row;
          const fromX = ball.xs[row];
          const toX = ball.xs[row + 1];
          ball.x = fromX + (toX - fromX) * frac;
          const fromY = topY + row * rowGap;
          ball.y = fromY + rowGap * frac - Math.sin(frac * Math.PI) * 7;
        }
        draw();
      }

      function land(ball) {
        const mult = ball.table[ball.bucket];
        const payout = D.round2(ball.bet * mult);
        ctx.settle(ball.bet, payout, mult, { silent: true });
        if (D.Sfx) D.Sfx.play(payout > ball.bet ? 'gem' : 'tick');
        hist.push(mult + '\u00d7', payout > ball.bet);
        const el = bucketsEl.querySelector('.bucket[data-index="' + ball.bucket + '"]');
        if (el) {
          el.classList.add('hit');
          setTimeout(() => el.classList.remove('hit'), 220);
        }
      }

      dropBtn.addEventListener('click', () => {
        if (D.Sfx) D.Sfx.play('drop');
        const bet = amount.get();
        if (!ctx.bet(bet)) return;

        let right = 0;
        const xs = [W / 2];
        for (let r = 0; r < ROWS; r++) {
          const goRight = D.rand() < 0.5;
          if (goRight) right++;
          xs.push(xs[xs.length - 1] + (goRight ? step / 2 : -step / 2));
        }

        balls.push({
          bet: bet,
          table: TABLES[risk].slice(),
          bucket: right,
          xs: xs,
          x: W / 2,
          y: topY,
          start: performance.now(),
          rowMs: 132,          // a slower, more watchable drop
        });

        if (!raf) raf = requestAnimationFrame(tick);
      });

      ctx.onClose = () => {
        if (raf) cancelAnimationFrame(raf);
        balls.forEach((ball) => ctx.settle(ball.bet, D.round2(ball.bet * ball.table[ball.bucket]), ball.table[ball.bucket], { silent: true }));
        balls.length = 0;
      };

      renderBuckets();
      draw();
    },
  });
})(window.Virtusjack);
