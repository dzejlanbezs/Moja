/* Dig Dig — dig down level by level, dodge the rocks, cash out any time */
(function (D) {
  'use strict';

  const LEVELS = 8;
  const EDGE = 0.99;

  const MODES = {
    easy: { tiles: 4, rocks: 1, label: 'Easy · 1 rock of 4' },
    medium: { tiles: 3, rocks: 1, label: 'Medium · 1 rock of 3' },
    hard: { tiles: 3, rocks: 2, label: 'Hard · 2 rocks of 3' },
    extreme: { tiles: 4, rocks: 3, label: 'Extreme · 3 rocks of 4' },
  };

  const GOLD = '<svg class="gem-ico" viewBox="0 0 24 24"><path d="M4 8h16l-2 11H6L4 8Zm2-3h12l1 3H5l1-3Z"/></svg>';
  const ROCK = '<svg class="bomb-ico" viewBox="0 0 24 24"><path d="M5 15l3-7 5-2 6 4-1 7H6l-1-2Z"/></svg>';

  const multAt = (mode, level) => (level === 0 ? 1 : D.round2(EDGE * Math.pow(MODES[mode].tiles / (MODES[mode].tiles - MODES[mode].rocks), level)));

  D.registerGame({
    id: 'digdig',
    name: 'Dig Dig',
    sub: 'Dicey Original · climb the tower',

    mount(ctx) {
      let mode = 'medium';
      let level = 0;
      let layout = [];
      let active = false;
      let stake = 0;

      const hist = ctx.historyStrip();
      const center = D.h(
        '<div class="stage-center">' +
          '<div class="mine-stats">' +
            '<div class="chip-stat"><b id="dgMult">1.00\u00d7</b><span>Multiplier</span></div>' +
            '<div class="chip-stat"><b id="dgCash">$0.00</b><span>Cash out</span></div>' +
            '<div class="chip-stat"><b id="dgLevel">0 / 8</b><span>Depth</span></div>' +
          '</div>' +
          '<div class="dig-tower"></div>' +
        '</div>'
      );
      ctx.stage.appendChild(center);
      const tower = center.querySelector('.dig-tower');
      const multEl = center.querySelector('#dgMult');
      const cashEl = center.querySelector('#dgCash');
      const levelEl = center.querySelector('#dgLevel');

      const amount = ctx.ui.amount();
      const modeSelect = ctx.ui.select(
        Object.keys(MODES).map((k) => ({ value: k, label: MODES[k].label })),
        (v) => { mode = v; build(); paint(); },
        'medium'
      );
      const startBtn = ctx.ui.action('Start Digging');
      const cashBtn = ctx.ui.action('Cash Out', 'btn-ghost');
      cashBtn.hidden = true;

      ctx.panel.append(amount.node, ctx.ui.block('<span>Difficulty</span>', modeSelect));
      const action = D.h('<div class="bp-action"></div>');
      action.append(startBtn, cashBtn, ctx.ui.note('Reach depth 8 to clear the mine at the top multiplier.'));
      ctx.panel.appendChild(action);

      function build() {
        tower.innerHTML = '';
        const cfg = MODES[mode];
        for (let l = 1; l <= LEVELS; l++) {
          const line = D.h('<div class="dig-line"></div>');
          const label = D.h('<span class="dig-row-label"></span>');
          label.textContent = multAt(mode, l).toFixed(2) + '\u00d7';
          const row = D.h('<div class="dig-row"></div>');
          row.dataset.level = l;
          row.style.gridTemplateColumns = 'repeat(' + cfg.tiles + ',1fr)';
          for (let t = 0; t < cfg.tiles; t++) {
            const cell = D.h('<button class="dig-cell" type="button"></button>');
            cell.dataset.tile = t;
            cell.disabled = true;
            row.appendChild(cell);
          }
          line.append(label, row);
          tower.appendChild(line);
        }
      }

      function rowFor(l) { return tower.querySelector('.dig-row[data-level="' + l + '"]'); }

      function paint() {
        const mult = multAt(mode, level);
        multEl.textContent = D.fmtMult(mult);
        cashEl.textContent = D.fmt(active ? D.round2(stake * mult) : 0);
        levelEl.textContent = level + ' / ' + LEVELS;
        startBtn.hidden = active;
        cashBtn.hidden = !active;
        cashBtn.disabled = level === 0;
        cashBtn.textContent = level === 0 ? 'Dig one level first' : 'Cash Out ' + D.fmt(D.round2(stake * mult));
        amount.disable(active);
        modeSelect.disabled = active;

        D.$$('.dig-row', tower).forEach((row) => {
          const l = +row.dataset.level;
          row.classList.toggle('current', active && l === level + 1);
          row.classList.toggle('done', l <= level);
          D.$$('.dig-cell', row).forEach((c) => { c.disabled = !active || l !== level + 1; });
        });
      }

      function start() {
        const bet = amount.get();
        if (!ctx.bet(bet)) return;
        stake = bet;
        level = 0;
        active = true;
        const cfg = MODES[mode];
        layout = [];
        for (let l = 0; l < LEVELS; l++) {
          const rocks = D.shuffle(Array.from({ length: cfg.tiles }, (_, i) => i)).slice(0, cfg.rocks);
          layout.push(rocks);
        }
        build();
        ctx.banner('');
        paint();
      }

      function revealRow(l, showAll) {
        const row = rowFor(l);
        if (!row) return;
        D.$$('.dig-cell', row).forEach((cell) => {
          const isRock = layout[l - 1].indexOf(+cell.dataset.tile) > -1;
          if (isRock) { cell.classList.add('rock'); cell.innerHTML = ROCK; }
          else if (showAll) { cell.classList.add('safe'); cell.innerHTML = GOLD; }
        });
      }

      function cashOut() {
        if (!active || level === 0) return;
        const mult = multAt(mode, level);
        const payout = D.round2(stake * mult);
        active = false;
        ctx.settle(stake, payout, mult);
        ctx.banner('Cashed out ' + D.fmt(payout) + ' at ' + D.fmtMult(mult), 'win');
        hist.push(D.fmtMult(mult), true);
        for (let l = level + 1; l <= LEVELS; l++) revealRow(l, false);
        paint();
      }

      tower.addEventListener('click', (e) => {
        const cell = e.target.closest('.dig-cell');
        if (!cell || cell.disabled || !active) return;
        const row = cell.closest('.dig-row');
        const l = +row.dataset.level;
        const tile = +cell.dataset.tile;

        if (layout[l - 1].indexOf(tile) > -1) {
          cell.classList.add('rock', 'cell-pop');
          cell.innerHTML = ROCK;
          active = false;
          ctx.settle(stake, 0, 0);
          ctx.banner('Hit a rock — lost ' + D.fmt(stake), 'lose');
          hist.push('\u2717', false);
          revealRow(l, false);
          paint();
          return;
        }

        cell.classList.add('safe', 'cell-pop');
        cell.innerHTML = GOLD;
        revealRow(l, false);
        level = l;
        paint();
        if (level === LEVELS) cashOut();
      });

      startBtn.addEventListener('click', start);
      cashBtn.addEventListener('click', cashOut);
      ctx.onClose = () => { if (active && level > 0) cashOut(); else if (active) ctx.settle(stake, 0, 0, { silent: true }); };

      build();
      paint();
    },
  });
})(window.Dicey);
