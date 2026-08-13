/* Blackjack — 6 deck shoe, dealer stands on 17, blackjack pays 3:2,
   split to four hands, insurance when the dealer shows an ace */
(function (D) {
  'use strict';

  // suits are drawn as paths so the cards never depend on font glyph coverage
  const SUIT_PATHS = {
    spade: 'M12 2.2C9.2 6.1 4.2 8.4 4.2 12.9a4.4 4.4 0 0 0 7 3.5c-.2 2-1 3.5-2.3 4.4h6.2c-1.3-.9-2.1-2.4-2.3-4.4a4.4 4.4 0 0 0 7-3.5c0-4.5-5-6.8-7.8-10.7Z',
    heart: 'M12 21.2S3.6 15.9 3.6 9.9c0-2.7 2-4.7 4.5-4.7 1.7 0 3.1.9 3.9 2.3.8-1.4 2.2-2.3 3.9-2.3 2.5 0 4.5 2 4.5 4.7 0 6-8.4 11.3-8.4 11.3Z',
    diamond: 'M12 2.4 19 12l-7 9.6L5 12l7-9.6Z',
    club: 'M12 2.6a3.5 3.5 0 0 0-2.6 5.8A3.6 3.6 0 1 0 8.7 15.5c1 0 1.9-.4 2.6-1-.2 2-1 3.5-2.3 4.4h6.2c-1.3-.9-2.1-2.4-2.3-4.4.7.6 1.6 1 2.6 1a3.6 3.6 0 1 0-.7-7.1A3.5 3.5 0 0 0 12 2.6Z',
  };

  const SUITS = [
    { key: 'spade', red: false },
    { key: 'heart', red: true },
    { key: 'diamond', red: true },
    { key: 'club', red: false },
  ];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const TENS = ['10', 'J', 'Q', 'K'];
  const HANDS_MAX = 4;               // the first hand plus three splits

  const suitSvg = (key) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + SUIT_PATHS[key] + '"/></svg>';

  function freshShoe() {
    const shoe = [];
    for (let d = 0; d < 6; d++) {
      SUITS.forEach((su) => RANKS.forEach((r) => shoe.push({ rank: r, suit: su.key, red: su.red })));
    }
    return D.shuffle(shoe);
  }

  const cardValue = (card) => (card.rank === 'A' ? 11 : TENS.indexOf(card.rank) > -1 ? 10 : parseInt(card.rank, 10));

  /** Counts a hand both ways: aces as one, and as eleven while that still fits. */
  function counts(cards) {
    let hard = 0, aces = 0;
    cards.forEach((card) => {
      if (card.rank === 'A') { aces++; hard += 1; }
      else hard += cardValue(card);
    });
    return { hard: hard, soft: aces && hard + 10 <= 21 ? hard + 10 : 0 };
  }

  const score = (cards) => {
    const c = counts(cards);
    return c.soft || c.hard;
  };

  /** A soft hand shows both totals — "7/17" — the way a table does. */
  const scoreText = (cards) => {
    const c = counts(cards);
    return c.soft ? c.hard + '/' + c.soft : String(c.hard);
  };

  const isBlackjack = (cards) => cards.length === 2 && score(cards) === 21;

  /** What one hand is worth against the dealer's final total. */
  function settleHand(item, dealerTotal, dealerBJ) {
    const p = score(item.cards);
    // two cards worth 21 after a split is a plain 21, not a blackjack
    const pBJ = isBlackjack(item.cards) && !item.split;

    if (p > 21) return { payout: 0, text: 'bust ' + p, kind: 'lose' };
    if (pBJ && dealerBJ) return { payout: item.stake, text: 'both blackjack', kind: 'push' };
    if (pBJ) return { payout: D.round2(item.stake * 2.5), text: 'blackjack, paid 3:2', kind: 'win' };
    if (dealerBJ) return { payout: 0, text: 'dealer blackjack', kind: 'lose' };
    if (dealerTotal > 21) return { payout: D.round2(item.stake * 2), text: 'dealer busts with ' + dealerTotal, kind: 'win' };
    if (p > dealerTotal) return { payout: D.round2(item.stake * 2), text: p + ' beats ' + dealerTotal, kind: 'win' };
    if (p === dealerTotal) return { payout: item.stake, text: 'push on ' + p, kind: 'push' };
    return { payout: 0, text: dealerTotal + ' beats ' + p, kind: 'lose' };
  }

  D.registerGame({
    id: 'blackjack',
    name: 'Blackjack',
    sub: 'Table game · dealer stands on 17',

    mount(ctx) {
      let shoe = freshShoe();
      let dealer = [];
      let hands = [];               // { cards, stake, done, doubled, split }
      let active = 0;
      let insurance = 0;
      let round = 'idle';           // idle | insurance | player | done
      let hideHole = true;
      let dealing = false;

      const hist = ctx.historyStrip();
      const table = D.h(
        '<div class="bj-table">' +
          '<div class="bj-side">' +
            '<div class="bj-side-label">Dealer <span class="bj-score" id="dScore">—</span></div>' +
            '<div class="bj-hand" id="dHand"></div>' +
          '</div>' +
          '<div class="bj-msg" id="bjMsg">Place your bet to deal</div>' +
          '<div class="bj-seats" id="pSeats"></div>' +
        '</div>'
      );
      ctx.stage.appendChild(table);

      const dHand = table.querySelector('#dHand');
      const dScore = table.querySelector('#dScore');
      const seatsEl = table.querySelector('#pSeats');
      const msg = table.querySelector('#bjMsg');

      const amount = ctx.ui.amount();
      const dealBtn = ctx.ui.action('Deal');
      const actions = D.h('<div class="bj-actions"></div>');
      const hitBtn = D.h('<button class="btn btn-ghost btn-lg">Hit</button>');
      const standBtn = D.h('<button class="btn btn-ghost btn-lg">Stand</button>');
      const dblBtn = D.h('<button class="btn btn-ghost btn-lg">Double</button>');
      const splitBtn = D.h('<button class="btn btn-ghost btn-lg">Split</button>');
      const insRow = D.h('<div class="bj-ins"></div>');
      const insYes = D.h('<button class="btn btn-primary btn-lg">Insurance</button>');
      const insNo = D.h('<button class="btn btn-ghost btn-lg">No thanks</button>');
      const shoeOut = ctx.ui.readout('Cards left');
      actions.append(hitBtn, standBtn, dblBtn, splitBtn);
      insRow.append(insYes, insNo);
      actions.hidden = true;
      insRow.hidden = true;

      ctx.panel.append(amount.node, ctx.ui.block('', shoeOut.node));
      const action = D.h('<div class="bp-action"></div>');
      action.append(dealBtn, actions, insRow,
        ctx.ui.note('Blackjack pays 3:2 · insurance 2:1 · split up to four hands'));
      ctx.panel.appendChild(action);

      const stakeTotal = () => D.round2(hands.reduce((sum, hand) => sum + hand.stake, 0) + insurance);

      function cardNode(card, faceDown) {
        if (faceDown) return D.h('<div class="card back" aria-label="Face down card"></div>');
        const pip = suitSvg(card.suit);
        return D.h(
          '<div class="card' + (card.red ? ' red' : '') + '" aria-label="' + card.rank + ' of ' + card.suit + 's">' +
            '<span class="corner tl"><b>' + card.rank + '</b>' + pip + '</span>' +
            '<span class="pip">' + pip + '</span>' +
            '<span class="corner br"><b>' + card.rank + '</b>' + pip + '</span>' +
          '</div>'
        );
      }

      /** Only draws cards that are new or have just been flipped, so nothing re-animates. */
      function renderHand(container, cards, faceDownIndex) {
        while (container.children.length > cards.length) container.lastChild.remove();
        cards.forEach((card, i) => {
          const faceDown = faceDownIndex === i;
          const key = faceDown ? 'back' : card.rank + card.suit;
          const existing = container.children[i];
          if (existing && existing.dataset.key === key) return;
          const node = cardNode(card, faceDown);
          node.dataset.key = key;
          if (existing) container.replaceChild(node, existing);
          else container.appendChild(node);
        });
      }

      function render() {
        renderHand(dHand, dealer, hideHole ? 1 : -1);
        dScore.textContent = dealer.length
          ? (hideHole ? scoreText(dealer.slice(0, 1)) + '+' : scoreText(dealer))
          : '—';

        while (seatsEl.children.length > hands.length) seatsEl.lastChild.remove();
        hands.forEach((hand, i) => {
          let seat = seatsEl.children[i];
          if (!seat) {
            seat = D.h('<div class="bj-seat"><div class="bj-hand"></div><div class="bj-side-label"></div></div>');
            seatsEl.appendChild(seat);
          }
          renderHand(seat.querySelector('.bj-hand'), hand.cards, -1);
          seat.querySelector('.bj-side-label').innerHTML =
            (hands.length > 1 ? 'Hand ' + (i + 1) : 'You') +
            ' <span class="bj-score">' + (hand.cards.length ? scoreText(hand.cards) : '—') + '</span>' +
            ' <em>' + D.fmt(hand.stake) + (hand.doubled ? ' ×2' : '') + '</em>';
          seat.classList.toggle('active', i === active && round === 'player' && hands.length > 1);
          seat.classList.toggle('spent', hand.cards.length > 0 && score(hand.cards) > 21);
        });

        shoeOut.set(shoe.length + ' / 312');
      }

      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const hand = () => hands[active] || null;

      const canDouble = () => {
        const h = hand();
        return !!h && h.cards.length === 2 && !h.done && D.Store.balance >= h.stake - 1e-9;
      };

      const canSplit = () => {
        const h = hand();
        return !!h && h.cards.length === 2 && !h.done && hands.length < HANDS_MAX &&
          cardValue(h.cards[0]) === cardValue(h.cards[1]) && D.Store.balance >= h.stake - 1e-9;
      };

      function setPhase(p) {
        round = p;
        dealBtn.hidden = p !== 'idle' && p !== 'done';
        dealBtn.textContent = p === 'done' ? 'Deal Again' : 'Deal';
        actions.hidden = p !== 'player';
        insRow.hidden = p !== 'insurance';
        amount.disable(p === 'player' || p === 'insurance');
        dblBtn.disabled = !canDouble();
        splitBtn.disabled = !canSplit();
        if (p === 'insurance') insYes.textContent = 'Insurance ' + D.fmt(D.round2(hands[0].stake / 2));
      }

      /** Locks the controls while cards are sliding in. */
      function setBusy(state) {
        dealing = state;
        [dealBtn, hitBtn, standBtn, dblBtn, splitBtn, insYes, insNo].forEach((btn) => { btn.disabled = state; });
        if (!state) setPhase(round);
      }

      async function slide(cards, card, faceDown) {
        cards.push(card);
        render();
        await wait(faceDown ? 340 : 520);
      }

      function draw() {
        if (shoe.length < 20) { shoe = freshShoe(); D.toast('Shoe reshuffled', 'info'); }
        return shoe.pop();
      }

      async function deal() {
        if (dealing || round === 'player' || round === 'insurance') return;   // never abandon a hand with money on it
        const bet = amount.get();
        if (!ctx.bet(bet)) return;

        dealer = [];
        hands = [{ cards: [], stake: bet, done: false, doubled: false, split: false }];
        active = 0;
        insurance = 0;
        hideHole = true;
        msg.className = 'bj-msg';
        msg.textContent = 'Dealing…';
        ctx.banner('');
        render();
        setPhase('player');
        setBusy(true);

        await wait(220);
        await slide(hands[0].cards, draw(), false);
        await slide(dealer, draw(), false);
        await slide(hands[0].cards, draw(), false);
        await slide(dealer, draw(), true);

        // insurance is offered against an ace, before anybody else acts
        if (dealer[0].rank === 'A' && D.Store.balance >= D.round2(hands[0].stake / 2) - 1e-9) {
          msg.textContent = 'Dealer shows an ace — take insurance?';
          setPhase('insurance');
          setBusy(false);
          return;
        }
        await afterPeek();
      }

      /** Both blackjacks are settled before the player can act. */
      async function afterPeek() {
        setBusy(true);
        if (isBlackjack(dealer) || isBlackjack(hands[0].cards)) {
          await revealDealer(false);
          return finish();
        }
        msg.textContent = 'Hit, stand, double or split';
        setPhase('player');
        setBusy(false);
      }

      async function takeInsurance(yes) {
        if (dealing) return;
        if (yes) {
          const half = D.round2(hands[0].stake / 2);
          if (!ctx.bet(half)) return;
          insurance = half;
          msg.textContent = 'Insurance ' + D.fmt(half) + ' placed';
        }
        await afterPeek();
      }

      async function hit() {
        if (dealing) return;
        setBusy(true);
        const h = hand();
        await slide(h.cards, draw(), false);
        if (score(h.cards) >= 21) return advance();
        setBusy(false);
      }

      async function double() {
        if (dealing || !canDouble()) return;
        const h = hand();
        if (!ctx.bet(h.stake)) return;
        h.stake = D.round2(h.stake * 2);
        h.doubled = true;
        setBusy(true);
        await slide(h.cards, draw(), false);
        return advance();
      }

      /**
       * Splits the active hand in two and deals a card to each. Split aces get
       * one card only, the way a table plays them.
       */
      async function split() {
        if (dealing || !canSplit()) return;
        const h = hand();
        if (!ctx.bet(h.stake)) return;
        setBusy(true);

        const moved = h.cards.pop();
        h.split = true;
        const extra = { cards: [moved], stake: h.stake, done: false, doubled: false, split: true };
        hands.splice(active + 1, 0, extra);
        render();
        await wait(320);

        await slide(h.cards, draw(), false);
        await slide(extra.cards, draw(), false);

        if (moved.rank === 'A') {
          h.done = true;               // split aces take one card each and stand
          extra.done = true;
          return advance();
        }
        msg.textContent = 'Hand ' + (active + 1) + ' — hit, stand, double or split';
        setBusy(false);
      }

      function stand() {
        if (dealing) return;
        return advance();
      }

      /** Closes the active hand and moves on, or hands over to the dealer. */
      async function advance() {
        const h = hand();
        if (h) h.done = true;

        const next = hands.map((item, i) => (item.done ? -1 : i)).filter((i) => i > -1)[0];
        if (next != null) {
          active = next;
          msg.textContent = 'Hand ' + (next + 1) + ' — hit, stand, double or split';
          render();
          setPhase('player');
          setBusy(false);
          return;
        }

        setBusy(true);
        const live = hands.some((item) => score(item.cards) <= 21);
        msg.textContent = live ? 'Dealer plays…' : 'Dealer wins';
        await revealDealer(live);
        finish();
      }

      /** Flips the hole card over, then lets the dealer draw one card at a time. */
      async function revealDealer(drawCards) {
        hideHole = false;
        render();
        await wait(520);
        if (drawCards === false) return;
        while (score(dealer) < 17) {
          await slide(dealer, draw(), false);
          await wait(220);
        }
      }

      function finish() {
        const d = score(dealer);
        const dBJ = isBlackjack(dealer);
        const results = hands.map((item) => settleHand(item, d, dBJ));

        const staked = stakeTotal();
        const insurancePay = insurance && dBJ ? D.round2(insurance * 3) : 0;
        const payout = D.round2(results.reduce((sum, r) => sum + r.payout, 0) + insurancePay);
        const profit = D.round2(payout - staked);

        const parts = results.map((r, i) => (hands.length > 1 ? 'Hand ' + (i + 1) + ' ' + r.text : r.text.charAt(0).toUpperCase() + r.text.slice(1)));
        if (insurance) parts.push(insurancePay ? 'insurance paid ' + D.fmt(insurancePay) : 'insurance lost');
        const text = parts.join(' · ');
        const kind = profit > 0 ? 'win' : profit < 0 ? 'lose' : 'push';

        render();
        msg.className = 'bj-msg ' + kind;
        msg.textContent = text;
        ctx.settle(staked, payout, payout ? D.round2(payout / staked) : 0);
        ctx.banner(text, kind === 'win' ? 'win' : kind === 'push' ? '' : 'lose');
        hist.push(
          hands.length > 1
            ? (profit > 0 ? '+' + D.fmt(profit) : profit < 0 ? D.fmt(profit) : 'push')
            : (kind === 'win' ? '+' + score(hands[0].cards) : kind === 'push' ? 'push' : String(score(hands[0].cards))),
          kind === 'win'
        );
        setBusy(false);
        setPhase('done');
      }

      dealBtn.addEventListener('click', () => { deal(); });
      hitBtn.addEventListener('click', () => { hit(); });
      standBtn.addEventListener('click', () => { stand(); });
      dblBtn.addEventListener('click', () => { double(); });
      splitBtn.addEventListener('click', () => { split(); });
      insYes.addEventListener('click', () => { takeInsurance(true); });
      insNo.addEventListener('click', () => { takeInsurance(false); });

      ctx.onClose = () => {
        if (round !== 'player' && round !== 'insurance') return;
        // settle the open hands straight away rather than leaving the stakes in limbo
        hideHole = false;
        if (hands.some((item) => score(item.cards) <= 21)) {
          while (score(dealer) < 17) dealer.push(draw());
        }
        finish();
      };

      render();
      setPhase('idle');
    },
  });
})(window.Virtusjack);
