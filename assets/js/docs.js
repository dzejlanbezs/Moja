/* ============================================================
   Virtus — the pages behind the footer links

   Every entry below becomes its own page, opened by any element
   with data-doc="<key>" and reachable at #doc=<key>. The copy is
   placeholder text: edit the strings here and nothing else needs
   to change. `body` takes plain paragraphs, and a section is a
   heading plus its own paragraphs or bullet list.
   ============================================================ */

(function (D) {
  'use strict';

  const DOCS = {
    help: {
      title: 'Help Center',
      kicker: 'Support',
      intro: 'Answers to the questions we are asked most. If yours is not here, live support is in the left rail and replies around the clock.',
      sections: [
        {
          heading: 'Getting started',
          body: ['Create an account with an email and a password, open the Cashier and send any supported coin to the address shown there. The address belongs to your account alone, so nothing else is needed — the balance moves on its own once the network confirms.'],
        },
        {
          heading: 'Deposits and withdrawals',
          list: [
            'Deposits credit automatically above the minimum shown in the Cashier.',
            'USDT and USDC arrive on Ethereum, Solana or Tron — pick the network before you send.',
            'Withdrawals are reviewed by hand and normally paid within 30 minutes.',
            'Always send on the network shown next to the address; coins sent on another chain cannot be recovered.',
          ],
        },
        {
          heading: 'Account and security',
          body: ['Keep your password to yourself and treat your email inbox as the key to the account. If you think someone else has access, change the password and contact support straight away.'],
        },
      ],
    },

    responsible: {
      title: 'Responsible Gaming',
      kicker: 'Support',
      intro: 'Play is entertainment, never an income. These tools and habits keep it that way.',
      sections: [
        {
          heading: 'Know the signs',
          list: [
            'Betting more than you planned, or more than you can afford to lose.',
            'Chasing losses with bigger stakes.',
            'Borrowing money, or hiding how much you play.',
            'Playing to escape stress, boredom or low mood.',
          ],
        },
        {
          heading: 'Staying in control',
          body: ['Decide on a budget before you play and stop when it is gone. Take breaks, keep your own record of wins and losses, and never treat a losing session as something to win back.'],
        },
        {
          heading: 'Taking a break',
          body: ['Ask support for a cool-off period or a full self-exclusion at any time and it is applied without questions. Independent, free and confidential help is available from BeGambleAware, GamCare and Gamblers Anonymous.'],
        },
        {
          heading: 'Under 18s',
          body: ['Accounts are for adults only. We verify age where required and close any account that turns out to belong to a minor, returning the balance to the depositor.'],
        },
      ],
    },

    fair: {
      title: 'Provably Fair',
      kicker: 'Platform',
      intro: 'Every original game settles from numbers you can check yourself, not from something only the house can see.',
      sections: [
        {
          heading: 'How a round is decided',
          body: ['Each round mixes a server seed, your own client seed and a nonce that counts up with every bet. The three are hashed together, and the hash is turned into the roll, the card order or the mine layout. Change any one of them and the result changes completely.'],
        },
        {
          heading: 'Checking a result',
          body: ['The hash of the server seed is published before you bet, and the seed itself is revealed when it is rotated. Hash the revealed seed and compare it with what was published: if they match, the seed could not have been swapped after your bet.'],
        },
        {
          heading: 'House edge',
          body: ['Every game states its return to player on the tile. The edge is in the payout table, never in the outcome, and no bet is ever treated differently from another.'],
        },
      ],
    },

    terms: {
      title: 'Terms of Service',
      kicker: 'Legal',
      intro: 'Placeholder terms. Replace this text with the agreement your licence requires before taking real money.',
      sections: [
        {
          heading: '1. Your account',
          body: ['One account per person. The details you register with must be your own and kept up to date. We may ask you to verify your identity, your age or the source of your funds, and may hold withdrawals until you do.'],
        },
        {
          heading: '2. Deposits, balances and withdrawals',
          body: ['Balances are held in US dollars and are not a deposit account: they earn no interest and are not covered by any deposit protection scheme. Crypto sent on an unsupported network, or to an address that is not yours, cannot be recovered.'],
        },
        {
          heading: '3. Fair play',
          list: [
            'No bots, scripts or automated play.',
            'No collusion, arbitrage between accounts, or bonus abuse.',
            'No use of the service where online gaming is prohibited.',
          ],
        },
        {
          heading: '4. Bets and settlement',
          body: ['A bet stands once it is accepted. Obvious errors — a price that is clearly wrong, a market left open in error, a round affected by a technical fault — may be voided and the stake returned.'],
        },
        {
          heading: '5. Closing an account',
          body: ['You may close your account at any time and withdraw any remaining balance, subject to the checks above. We may close an account that breaks these terms, and will always return the undisputed balance.'],
        },
      ],
    },

    aml: {
      title: 'AML Policy',
      kicker: 'Legal',
      intro: 'Placeholder anti-money-laundering policy. Replace it with the programme your licence and jurisdiction require.',
      sections: [
        {
          heading: 'Our commitment',
          body: ['We do not knowingly accept the proceeds of crime, and we cooperate fully with law enforcement and our regulator. Staff are trained to spot and escalate anything that looks like laundering or terrorist financing.'],
        },
        {
          heading: 'Know your customer',
          list: [
            'Identity and age verification before larger withdrawals.',
            'Proof of the source of funds where deposits are out of step with a player profile.',
            'Screening against sanctions and politically exposed person lists.',
          ],
        },
        {
          heading: 'Monitoring',
          body: ['Deposits, wagering and withdrawals are monitored for patterns that make no commercial sense — depositing and withdrawing with little play, splitting deposits to stay under thresholds, or a sudden change in behaviour. Suspicious activity is reported without telling the customer.'],
        },
        {
          heading: 'Records',
          body: ['Account, transaction and verification records are kept for the period the law requires and are available to the regulator on request.'],
        },
      ],
    },

    privacy: {
      title: 'Privacy Policy',
      kicker: 'Legal',
      intro: 'Placeholder privacy notice. Replace it with the notice your data protection regime requires.',
      sections: [
        {
          heading: 'What we collect',
          list: [
            'Account details: email address and password hash.',
            'Play and payment records: bets, balances, deposits and withdrawals.',
            'Technical data: IP address, device and browser, and the pages you open.',
          ],
        },
        {
          heading: 'Why we collect it',
          body: ['To run your account and settle bets, to meet our legal and licensing duties, to keep the platform secure, and to stop fraud and underage play. We do not sell personal data.'],
        },
        {
          heading: 'Your rights',
          body: ['Ask us for a copy of your data, ask for corrections, or ask us to delete it where we are not required to keep it. Requests go to the support address in the footer and are answered within a month.'],
        },
        {
          heading: 'Keeping it safe',
          body: ['Passwords are stored only as salted hashes, wallet keys never touch the site, and access to player data is limited to staff who need it.'],
        },
      ],
    },

    'sports-rules': {
      title: 'Sports Rules & Policies',
      kicker: 'Legal',
      intro: 'How sports bets are settled. Placeholder rules — replace them with the book your trading operation runs on.',
      sections: [
        {
          heading: 'Accepted price',
          body: ['A bet settles at the price stored with it when it was accepted, which is the price read from the feed at that moment. If a price has moved you are asked to accept the new one before the bet is placed.'],
        },
        {
          heading: 'Void bets',
          list: [
            'A match abandoned or postponed beyond the period stated for that sport.',
            'A market offered in error, or a price that is clearly wrong.',
            'A selection that becomes impossible before the event starts, such as a withdrawn competitor.',
          ],
        },
        {
          heading: 'Multiples',
          body: ['Selections from the same match cannot be combined. In a multi, a voided leg is priced at 1.00 and the rest of the bet stands.'],
        },
        {
          heading: 'Free bets',
          body: ['A free bet is staked once, on a single selection inside the odds range shown when it was granted. Winnings are paid without the stake, and the free bet cannot be split or cashed out.'],
        },
        {
          heading: 'Results',
          body: ['Official results from the competition organiser decide settlement. Later corrections are honoured for a reasonable period; scores shown on the site are for information only.'],
        },
      ],
    },

    cookies: {
      title: 'Cookie Preferences',
      kicker: 'Legal',
      intro: 'This build keeps only what it needs to run. Placeholder notice — replace it with the one your consent tooling requires.',
      sections: [
        {
          heading: 'Strictly necessary',
          body: ['A session cookie keeps you signed in, and local storage remembers your play-money balance in demo mode. Without these the site cannot work, so they cannot be switched off.'],
        },
        {
          heading: 'Analytics and marketing',
          body: ['None are set in this build. If you add them, list them here with their purpose and lifetime, and gate them behind consent.'],
        },
        {
          heading: 'Managing cookies',
          body: ['Your browser can block or clear cookies for this site at any time. Clearing them signs you out and forgets a demo-mode balance.'],
        },
      ],
    },
  };

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const page = D.$('#page-doc');
  const body = D.$('#docBody');

  function render(key) {
    const doc = DOCS[key];
    if (!doc || !body) return false;

    body.innerHTML =
      '<div class="section-head">' +
        '<span class="doc-kicker">' + esc(doc.kicker) + '</span>' +
        '<h1>' + esc(doc.title) + '</h1>' +
        '<p>' + esc(doc.intro) + '</p>' +
      '</div>' +
      '<article class="doc">' +
        doc.sections.map((section) =>
          '<section class="doc-section">' +
            '<h2>' + esc(section.heading) + '</h2>' +
            (section.body || []).map((text) => '<p>' + esc(text) + '</p>').join('') +
            (section.list
              ? '<ul>' + section.list.map((item) => '<li>' + esc(item) + '</li>').join('') + '</ul>'
              : '') +
          '</section>').join('') +
        '<p class="doc-foot">Last updated ' + new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) +
          ' · questions to <b>support@virtus.com</b></p>' +
      '</article>';
    return true;
  }

  function open(key) {
    if (!render(key)) return;
    D.navigate('doc');
    if (history.replaceState) history.replaceState(null, '', '#doc=' + key);
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-doc]');
    if (!link) return;
    e.preventDefault();
    open(link.dataset.doc);
  });

  D.$$('.footer-ico').forEach((button) => {
    button.addEventListener('click', () => D.toast('Community links are not part of this demo', 'info'));
  });

  const hash = (location.hash || '').replace('#', '');
  if (hash.indexOf('doc=') === 0 && page) open(hash.slice(4));

  D.Docs = { open: open, keys: Object.keys(DOCS) };
})(window.Dicey);
