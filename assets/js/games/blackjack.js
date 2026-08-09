/* Blackjack — 6 deck shoe, dealer stands on 17, blackjack pays 3:2 */
(function (D) {
  'use strict';

  const SUITS = [
    { s: '\u2660', red: false },
    { s: '\u2665', red: true },
    { s: '\u2666', red: true },
    { s: '\u2663', red: false },
  ];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function freshShoe() {
    const shoe = [];
    for (let d = 0; d < 6; d++) {
      SUITS.forEach((su) => RANKS.forEach((r) => shoe.push({ rank: r, suit: su.s, red: su.red })));
    }
    return D.shuffle(shoe);
  }

  function score(hand) {
    let total = 0, aces = 0;
    hand.forEach((c) => {
      if (c.rank === 'A') { aces++; total += 11; }
      else if (['10', 'J', 'Q', 'K'].indexOf(c.rank) > -1) total += 10;
      else total += parseInt(c.rank, 10);
    });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }
  const isBlackjack = (hand) => hand.length === 2 && score(hand) === 21;

  D.registerGame({
    id: 'blackjack',
    name: 'Blackjack',
    sub: 'Table game · dealer stands on 17',

    mount(ctx) {
      let shoe = freshShoe();
      let player = [];
      let dealer = [];
      let stake = 0;
      let round = 'idle'; // idle | player | done
      let hideHole = true;

      const hist = ctx.historyStrip();
      const table = D.h(
        '<div class="bj-table">' +
          '<div class="bj-side">' +
            '<div class="bj-side-label">Dealer <span class="bj-score" id="dScore">—</span></div>' +
            '<div class="bj-hand" id="dHand"></div>' +
          '</div>' +
          '<div class="bj-msg" id="bjMsg">Place your bet to deal</div>' +
          '<div class="bj-side">' +
            '<div class="bj-hand" id="pHand"></div>' +
            '<div class="bj-side-label">You <span class="bj-score" id="pScore">—</span></div>' +
          '</div>' +
        '</div>'
      );
      ctx.stage.appendChild(table);

      const dHand = table.querySelector('#dHand');
      const pHand = table.querySelector('#pHand');
      const dScore = table.querySelector('#dScore');
      const pScore = table.querySelector('#pScore');
      const msg = table.querySelector('#bjMsg');

      const amount = ctx.ui.amount();
      const dealBtn = ctx.ui.action('Deal');
      const actions = D.h('<div class="bj-actions"></div>');
      const hitBtn = D.h('<button class="btn btn-ghost btn-lg">Hit</button>');
      const standBtn = D.h('<button class="btn btn-ghost btn-lg">Stand</button>');
      const dblBtn = D.h('<button class="btn btn-ghost btn-lg">Double</button>');
      const shoeOut = ctx.ui.readout('Cards left');
      actions.append(hitBtn, standBtn, dblBtn);
      actions.hidden = true;

      ctx.panel.append(amount.node, ctx.ui.block('', shoeOut.node));
      const action = D.h('<div class="bp-action"></div>');
      action.append(dealBtn, actions, ctx.ui.note('Blackjack pays 3:2 · insurance not offered'));
      ctx.panel.appendChild(action);

      function cardNode(card, faceDown) {
        if (faceDown) return D.h('<div class="card back"></div>');
        const node = D.h('<div class="card' + (card.red ? ' red' : '') + '"><span class="rank"></span><span class="suit"></span></div>');
        node.querySelector('.rank').textContent = card.rank;
        node.querySelector('.suit').textContent = card.suit;
        return node;
      }

      function render() {
        pHand.innerHTML = '';
        player.forEach((c) => pHand.appendChild(cardNode(c, false)));
        dHand.innerHTML = '';
        dealer.forEach((c, i) => dHand.appendChild(cardNode(c, hideHole && i === 1)));
        pScore.textContent = player.length ? score(player) : '—';
        dScore.textContent = dealer.length ? (hideHole ? score(dealer.slice(0, 1)) + ' +' : score(dealer)) : '—';
        shoeOut.set(shoe.length + ' / 312');
      }

      function setPhase(p) {
        round = p;
        dealBtn.hidden = p !== 'idle' && p !== 'done';
        dealBtn.textContent = p === 'done' ? 'Deal Again' : 'Deal';
        actions.hidden = p !== 'player';
        amount.disable(p === 'player');
        const canDouble = player.length === 2 && D.Store.balance >= stake;
        dblBtn.disabled = !canDouble;
      }

      function draw() {
        if (shoe.length < 20) { shoe = freshShoe(); D.toast('Shoe reshuffled', 'info'); }
        return shoe.pop();
      }

      function deal() {
        const bet = amount.get();
        if (!ctx.bet(bet)) return;
        stake = bet;
        player = [draw(), draw()];
        dealer = [draw(), draw()];
        hideHole = true;
        msg.className = 'bj-msg';
        msg.textContent = 'Hit, stand or double';
        ctx.banner('');
        render();
        setPhase('player');

        if (isBlackjack(player) || isBlackjack(dealer)) { hideHole = false; finish(); }
      }

      function hit() {
        player.push(draw());
        render();
        setPhase('player');
        if (score(player) > 21) { hideHole = false; finish(); }
      }

      function double() {
        if (!ctx.bet(stake)) return;
        stake = D.round2(stake * 2);
        player.push(draw());
        render();
        stand();
      }

      function stand() {
        hideHole = false;
        while (score(dealer) < 17) dealer.push(draw());
        render();
        finish();
      }

      function finish() {
        const p = score(player);
        const d = score(dealer);
        const pBJ = isBlackjack(player);
        const dBJ = isBlackjack(dealer);
        let payout = 0, text = '', kind = 'lose';

        if (pBJ && dBJ) { payout = stake; text = 'Both blackjack — push'; kind = 'push'; }
        else if (pBJ) { payout = D.round2(stake * 2.5); text = 'Blackjack! Paid 3:2'; kind = 'win'; }
        else if (dBJ) { payout = 0; text = 'Dealer blackjack'; }
        else if (p > 21) { payout = 0; text = 'Bust with ' + p; }
        else if (d > 21) { payout = D.round2(stake * 2); text = 'Dealer busts with ' + d; kind = 'win'; }
        else if (p > d) { payout = D.round2(stake * 2); text = p + ' beats ' + d; kind = 'win'; }
        else if (p === d) { payout = stake; text = 'Push on ' + p; kind = 'push'; }
        else { payout = 0; text = d + ' beats your ' + p; }

        render();
        msg.className = 'bj-msg ' + kind;
        msg.textContent = text;
        ctx.settle(stake, payout, payout ? D.round2(payout / stake) : 0);
        ctx.banner(text, kind === 'win' ? 'win' : kind === 'push' ? '' : 'lose');
        hist.push(kind === 'win' ? '+' + p : kind === 'push' ? 'push' : String(p), kind === 'win');
        setPhase('done');
      }

      dealBtn.addEventListener('click', deal);
      hitBtn.addEventListener('click', hit);
      standBtn.addEventListener('click', stand);
      dblBtn.addEventListener('click', double);
      ctx.onClose = () => { if (round === 'player') { hideHole = false; stand(); } };

      render();
      setPhase('idle');
    },
  });
})(window.Dicey);
