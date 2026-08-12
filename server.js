/* ============================================================
   Dicey — accounts, wallet and admin backend

   Zero dependencies: run it with `node server.js`.
   Data lives in ./data/db.json. Nothing here talks to a real
   blockchain — deposits and withdrawals are requests that the
   admin confirms or rejects by hand.
   ============================================================ */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const chain = require('./chain');
const hd = require('./hd');
const sports = require('./sports');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(DATA_DIR, 'seed.txt');
const PORT = parseInt(process.env.PORT, 10) || 3000;
const SESSION_YEARS = 10;       // sessions do not expire in practice
const MAX_ROUNDS = 20000;

// Hours east of UTC used for the 02:00 bonus reset (2 = Serbia in summer).
const TZ_OFFSET = parseFloat(process.env.DICEY_TZ_OFFSET || '2');

// Weekly wager race: $15,000 split between the top ten, paid out
// automatically when the race closes on Sunday at 02:00.
const RACE_PRIZES = [6000, 4500, 2500, 1000, 500, 100, 100, 100, 100, 100];
const RACE_POOL = RACE_PRIZES.reduce((sum, prize) => sum + prize, 0);

// Anything worth at least this much is credited on its own.
const MIN_DEPOSIT_USD = parseFloat(process.env.DICEY_MIN_DEPOSIT_USD || '10');

// Promo signups get a free bet matching their first deposit; 0 means no cap.
const FREEBET_MAX = parseFloat(process.env.DICEY_FREEBET_MAX || '0');

const REWARD_RATES = {
  rakeback: { wager: 0.0005, loss: 0 },
  daily: { wager: 0.001, loss: 0.01 },
  weekly: { wager: 0.002, loss: 0.03 },
  monthly: { wager: 0.01, loss: 0.15 },
};

// Codes you hand out yourself. Anyone signing up with one gets the
// 100% first-deposit sports bonus banner in the cashier.
const PROMO_CODES = (process.env.DICEY_PROMO_CODES || 'DXDXDA,FGASDK')
  .split(',').map((code) => code.trim().toUpperCase()).filter(Boolean);

const COINS = [
  { sym: 'USDT', name: 'Tether', network: 'Ethereum · ERC-20', color: '#26a17b' },
  { sym: 'USDC', name: 'USD Coin', network: 'Ethereum · ERC-20', color: '#2775ca' },
  { sym: 'ETH', name: 'Ethereum', network: 'Ethereum · mainnet', color: '#627eea' },
  { sym: 'BTC', name: 'Bitcoin', network: 'Bitcoin · native segwit', color: '#f7931a' },
  { sym: 'SOL', name: 'Solana', network: 'Solana · mainnet', color: '#9945ff' },
];

/* ------------------------------------------------------------------ storage */

const EMPTY_DB = {
  users: [], sessions: {}, rounds: [], transactions: [], sportsBets: [],
  meta: { lastBlock: 0, seenTx: [], nextWalletIndex: 0, chainState: {} },
};

function loadDb() {
  try {
    return Object.assign({}, EMPTY_DB, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Could not read db.json, starting empty:', err.message);
    return JSON.parse(JSON.stringify(EMPTY_DB));
  }
}

const db = loadDb();
db.meta = Object.assign({ lastBlock: 0, seenTx: [], nextWalletIndex: 0, chainState: {} }, db.meta);
db.sportsBets = db.sportsBets || [];
let saveTimer = null;

function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('Failed to save db.json:', err.message);
    }
  }, 120);
}

/* ------------------------------------------------------------------ helpers */

const id = (prefix) => prefix + '_' + crypto.randomBytes(9).toString('hex');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const now = () => Date.now();

function hashPassword(password, salt) {
  const use = salt || crypto.randomBytes(16).toString('hex');
  return { salt: use, hash: crypto.scryptSync(password, use, 64).toString('hex') };
}

function checkPassword(password, user) {
  const attempt = hashPassword(password, user.salt).hash;
  const a = Buffer.from(attempt, 'hex');
  const b = Buffer.from(user.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function referralCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
  } while (db.users.some((u) => u.referralCode === code));
  return code;
}

function clientIp(req) {
  const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const raw = forwarded || req.socket.remoteAddress || '';
  return raw.replace(/^::ffff:/, '') || 'unknown';
}

const findUser = (userId) => db.users.filter((u) => u.id === userId)[0] || null;
const findByEmail = (email) => db.users.filter((u) => u.email === String(email).trim().toLowerCase())[0] || null;

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    balance: round2(user.balance),
    isAdmin: !!user.isAdmin,
    referralCode: user.referralCode,
    referredBy: user.referredBy || null,
    promoCode: user.promoCode || null,
    bonus: user.bonus || null,
    freeBet: user.freeBet || null,
    walletAddress: user.walletAddress || null,
    depositRef: user.depositRef || null,
    createdAt: user.createdAt,
    stats: user.stats,
  };
}

/** "player@mail.com" -> "pl***" so the public feed leaks nothing. */
function maskEmail(email) {
  const handle = String(email || '').split('@')[0];
  return handle.slice(0, 2) + '***';
}

/* ------------------------------------------------------------------ hd wallet */

// The mnemonic never lives in the repo: put it in data/seed.txt or DICEY_MNEMONIC.
let hdSeed = null;

function loadSeed() {
  let mnemonic = process.env.DICEY_MNEMONIC || '';
  if (!mnemonic) {
    try { mnemonic = fs.readFileSync(SEED_FILE, 'utf8'); } catch (err) { mnemonic = ''; }
  }
  mnemonic = mnemonic.trim();
  if (!mnemonic) return null;
  if (mnemonic.split(/\s+/).length < 12) {
    console.error('Ignoring seed: a BIP39 mnemonic needs at least 12 words.');
    return null;
  }
  return hd.mnemonicToSeed(mnemonic, process.env.DICEY_MNEMONIC_PASSPHRASE || '');
}

/** Derives (and caches) this player's own deposit address for every coin. */
function addressesFor(user) {
  if (!hdSeed) return null;
  if (!user.walletIndex) {
    db.meta.nextWalletIndex = (db.meta.nextWalletIndex || 0) + 1;
    user.walletIndex = db.meta.nextWalletIndex;
    save();
  }
  if (!user.addresses || user.addresses.index !== user.walletIndex) {
    user.addresses = Object.assign({ index: user.walletIndex }, hd.addressesFor(hdSeed, user.walletIndex));
    save();
  }
  return user.addresses;
}

/* ------------------------------------------------------------------ reward windows */

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const shift = TZ_OFFSET * HOUR - 2 * HOUR;   // local clock, with 02:00 as the day boundary

const rewardDate = (ts) => new Date(ts + shift);
const fromUtcParts = (y, m, d) => Date.UTC(y, m, d) - shift;

function startOfRewardDay(ts) {
  const d = rewardDate(ts);
  return fromUtcParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function startOfRewardWeek(ts) {
  const monday = (rewardDate(ts).getUTCDay() + 6) % 7;
  return startOfRewardDay(ts) - monday * DAY;
}
function startOfRewardMonth(ts) {
  const d = rewardDate(ts);
  return fromUtcParts(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** The race runs Sunday 02:00 to Sunday 02:00. */
function startOfRaceWeek(ts) {
  const sunday = rewardDate(ts).getUTCDay();
  return startOfRewardDay(ts) - sunday * DAY;
}

const emptyWindow = (start) => ({ start: start, wagered: 0, net: 0, claimedAt: 0 });

function ensureRewards(user, now) {
  if (!user.rewards) {
    user.rewards = {
      rakeback: 0,
      daily: emptyWindow(startOfRewardDay(now)),
      weekly: emptyWindow(startOfRewardWeek(now)),
      monthly: Object.assign(emptyWindow(startOfRewardMonth(now)), { carry: { wagered: 0, net: 0, month: 0 }, carryClaimed: 0 }),
    };
  }
  const r = user.rewards;
  if (!r.race) r.race = { start: startOfRaceWeek(now), wagered: 0 };

  if (r.daily.start !== startOfRewardDay(now)) r.daily = emptyWindow(startOfRewardDay(now));
  if (r.weekly.start !== startOfRewardWeek(now)) r.weekly = emptyWindow(startOfRewardWeek(now));

  const monthStart = startOfRewardMonth(now);
  if (r.monthly.start !== monthStart) {
    // last month's total waits in `carry` so it can be collected on the 1st
    const carry = { wagered: r.monthly.wagered, net: r.monthly.net, month: r.monthly.start };
    r.monthly = Object.assign(emptyWindow(monthStart), { carry: carry, carryClaimed: r.monthly.carryClaimed || 0 });
  }
  return r;
}

function addWager(user, bet, payout, now) {
  const r = ensureRewards(user, now);
  const net = round2(bet - payout);
  r.rakeback = round2(r.rakeback + bet);
  ['daily', 'weekly', 'monthly'].forEach((key) => {
    r[key].wagered = round2(r[key].wagered + bet);
    r[key].net = round2(r[key].net + net);
  });

  // race entries only count inside the open race
  const raceStart = startOfRaceWeek(now);
  if (r.race.start !== raceStart) r.race = { start: raceStart, wagered: 0 };
  r.race.wagered = round2(r.race.wagered + bet);
}

/* ------------------------------------------------------------------ weekly race */

function raceEntries(start) {
  return db.users
    .filter((u) => !u.isAdmin && u.rewards && u.rewards.race && u.rewards.race.start === start && u.rewards.race.wagered > 0)
    .sort((a, b) => b.rewards.race.wagered - a.rewards.race.wagered);
}

function raceBoard(start, limit) {
  return raceEntries(start).slice(0, limit || 10).map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    user: maskEmail(u.email),
    wagered: round2(u.rewards.race.wagered),
    prize: RACE_PRIZES[i] || 0,
  }));
}

/**
 * Pays out the race the moment its week is over. Safe to call as often as
 * you like — it only does anything once the window has actually rolled.
 */
function settleRaceIfDue() {
  const current = startOfRaceWeek(now());
  if (!db.meta.raceStart) { db.meta.raceStart = current; save(); return; }
  if (db.meta.raceStart === current) return;

  const finished = db.meta.raceStart;
  const winners = raceBoard(finished, RACE_PRIZES.length);

  winners.forEach((entry) => {
    if (!entry.prize) return;
    const user = findUser(entry.userId);
    if (!user) return;
    user.balance = round2(user.balance + entry.prize);
    db.transactions.unshift({
      id: id('tx'),
      userId: user.id,
      type: 'race',
      coin: 'USD',
      address: '',
      amount: entry.prize,
      status: 'confirmed',
      note: 'Weekly race — rank #' + entry.rank + ' with ' + entry.wagered + ' wagered',
      ip: '',
      ts: now(),
      resolvedAt: now(),
    });
  });

  db.meta.lastRace = {
    start: finished,
    endedAt: current,
    pool: RACE_POOL,
    winners: winners.map((w) => ({ rank: w.rank, user: w.user, wagered: w.wagered, prize: w.prize })),
  };
  db.meta.raceStart = current;
  save();

  if (winners.length) console.log('Weekly race paid out to ' + winners.length + ' player(s)');
}

const bonusValue = (rate, wagered, net) => round2(wagered * rate.wager + Math.max(0, net) * rate.loss);

/** Everything the rewards popup needs: amounts, whether they can be taken, and when next. */
function rewardState(user, now) {
  const r = ensureRewards(user, now);
  const local = rewardDate(now);
  const nextDay = startOfRewardDay(now) + DAY;
  const nextWeek = startOfRewardWeek(now) + 7 * DAY;
  const nextMonth = fromUtcParts(local.getUTCFullYear(), local.getUTCMonth() + 1, 1);

  const rakeback = round2(r.rakeback * REWARD_RATES.rakeback.wager);
  const daily = bonusValue(REWARD_RATES.daily, r.daily.wagered, r.daily.net);
  const weekly = bonusValue(REWARD_RATES.weekly, r.weekly.wagered, r.weekly.net);
  const monthly = bonusValue(REWARD_RATES.monthly, r.monthly.carry.wagered, r.monthly.carry.net);

  const isSunday = local.getUTCDay() === 0;
  const isFirst = local.getUTCDate() === 1;

  // Only rakeback shows a figure. The timed bonuses stay sealed — the
  // amounts never leave the server, so nobody can read them off the wire.
  return {
    rakeback: {
      amount: rakeback,
      claimable: rakeback >= 0.01,
      wagered: r.rakeback,
      blurb: 'Earned on every bet',
      note: 'Builds up as you play and can be taken any time.',
    },
    daily: {
      hidden: true,
      claimable: daily >= 0.01 && r.daily.claimedAt < r.daily.start,
      blurb: 'Unlocks every day at 02:00',
      availableAt: r.daily.claimedAt >= r.daily.start ? nextDay : 0,
      note: 'Sealed until you open it.',
    },
    weekly: {
      hidden: true,
      claimable: weekly >= 0.01 && isSunday && r.weekly.claimedAt < r.weekly.start,
      blurb: 'Unlocks Sunday at 02:00',
      availableAt: isSunday && r.weekly.claimedAt < r.weekly.start ? 0 : nextWeek - DAY,
      note: 'Grows through the week. Sealed until you open it.',
    },
    monthly: {
      hidden: true,
      claimable: monthly >= 0.01 && isFirst && r.monthly.carry.month > 0 && r.monthly.carryClaimed !== r.monthly.carry.month,
      blurb: 'Unlocks on the 1st at 02:00',
      availableAt: isFirst ? 0 : nextMonth,
      note: 'Covers the whole month. Sealed until you open it.',
    },
  };
}

/* ------------------------------------------------------------------ sessions */

function sessionFrom(req) {
  const cookie = req.headers.cookie || '';
  const match = /(?:^|;\s*)dicey_session=([^;]+)/.exec(cookie);
  if (!match) return null;
  const record = db.sessions[match[1]];
  if (!record) return null;
  const user = findUser(record.userId);
  if (!user) return null;
  return { token: match[1], user: user };
}

function startSession(res, user, req) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = { userId: user.id, createdAt: now(), ip: clientIp(req), ua: req.headers['user-agent'] || '' };
  res.setHeader('Set-Cookie',
    'dicey_session=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + SESSION_YEARS * 365 * 86400);
  save();
}

/* ------------------------------------------------------------------ throttle */

const hits = new Map();
function tooManyAttempts(ip) {
  const bucket = hits.get(ip) || { count: 0, until: now() + 60000 };
  if (now() > bucket.until) { bucket.count = 0; bucket.until = now() + 60000; }
  bucket.count += 1;
  hits.set(ip, bucket);
  return bucket.count > 25;
}

/* ------------------------------------------------------------------ http io */

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 100000) { reject(new Error('Body too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (err) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const rel = clean === '/' || clean === '\\' ? 'index.html' : clean.replace(/^[/\\]+/, '');
  if (rel.startsWith('data') || rel.startsWith('.git') || rel === 'server.js') return sendJson(res, 403, { error: 'Forbidden' });

  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) return sendJson(res, 403, { error: 'Forbidden' });

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      // the browser must never serve a stale build after you edit a file
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}

/* ------------------------------------------------------------------ api */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function userAggregates(user) {
  const rounds = db.rounds.filter((r) => r.userId === user.id);
  const txs = db.transactions.filter((t) => t.userId === user.id);
  const sum = (list, fn) => round2(list.reduce((acc, item) => acc + fn(item), 0));
  return {
    bets: rounds.length,
    wagered: sum(rounds, (r) => r.bet),
    won: sum(rounds, (r) => r.payout),
    profit: round2(sum(rounds, (r) => r.payout) - sum(rounds, (r) => r.bet)),
    deposited: sum(txs.filter((t) => t.type === 'deposit' && t.status === 'confirmed'), (t) => t.amount),
    withdrawn: sum(txs.filter((t) => t.type === 'withdraw' && t.status === 'confirmed'), (t) => t.amount),
    pending: txs.filter((t) => t.status === 'pending').length,
    lastPlayedAt: rounds.length ? rounds[rounds.length - 1].ts : null,
  };
}

/**
 * Records an on-chain deposit. `user` may be null when we cannot tell who
 * sent it — those wait in the admin panel to be assigned by hand.
 */
function creditDeposit(user, deposit, status, note) {
  const eligible = !!(user && user.bonus && !user.bonus.used);
  const tx = {
    id: id('tx'),
    userId: user ? user.id : null,
    type: 'deposit',
    coin: deposit.coin,
    address: deposit.from,
    txHash: deposit.txHash,
    crypto: deposit.amount,
    amount: deposit.usd,
    status: status,
    onChain: true,
    bonus: eligible ? (user.bonus.label || '100% Sports Bonus') : null,
    note: note || '',
    ip: '',
    ts: now(),
  };

  db.transactions.unshift(tx);

  if (user && status === 'confirmed') {
    user.balance = round2(user.balance + deposit.usd);
    if (eligible) grantFreeBet(user, deposit.usd);
  }
  save();
  return tx;
}

/** Turns the promo-code sports bonus into a free bet matching the first deposit. */
function grantFreeBet(user, amount) {
  if (!user.bonus || user.bonus.used) return null;
  user.bonus.used = true;
  user.freeBet = {
    amount: round2(FREEBET_MAX ? Math.min(amount, FREEBET_MAX) : amount),
    minOdds: 1.5,
    maxOdds: 5,
    grantedAt: now(),
    used: false,
    seen: false,
  };
  return user.freeBet;
}

const ROUTES = {
  'GET /api/session': (ctx) => {
    if (!ctx.session) return sendJson(ctx.res, 200, { user: null });
    ctx.session.user.lastSeenAt = now();
    ctx.session.user.lastIp = clientIp(ctx.req);
    save();
    return sendJson(ctx.res, 200, { user: publicUser(ctx.session.user) });
  },

  'POST /api/auth/register': async (ctx) => {
    if (tooManyAttempts(clientIp(ctx.req))) return sendJson(ctx.res, 429, { error: 'Too many attempts, wait a minute' });
    const body = await ctx.body();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const referral = String(body.referral || '').trim().toUpperCase();

    if (!EMAIL_RE.test(email)) return sendJson(ctx.res, 400, { error: 'Enter a valid email address' });
    if (password.length < 8) return sendJson(ctx.res, 400, { error: 'Password must be at least 8 characters' });
    if (findByEmail(email)) return sendJson(ctx.res, 409, { error: 'That email is already registered' });

    let referredBy = null;
    let promo = null;
    if (referral) {
      if (PROMO_CODES.indexOf(referral) > -1) {
        promo = referral;
      } else {
        const owner = db.users.filter((u) => u.referralCode === referral)[0];
        if (!owner) return sendJson(ctx.res, 400, { error: 'That referral code does not exist' });
        referredBy = owner.referralCode;
      }
    }

    const creds = hashPassword(password);
    const user = {
      id: id('usr'),
      email: email,
      salt: creds.salt,
      hash: creds.hash,
      balance: 0,
      isAdmin: false,
      blocked: false,
      referralCode: referralCode(),
      referredBy: referredBy,
      promoCode: promo,
      bonus: promo ? { type: 'sports100', label: '100% Sports Bonus', used: false } : null,
      walletAddress: null,
      depositRef: 'DX-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      createdAt: now(),
      lastSeenAt: now(),
      signupIp: clientIp(ctx.req),
      lastIp: clientIp(ctx.req),
      stats: { wagered: 0, won: 0, bets: 0, wins: 0 },
    };
    db.users.push(user);
    addressesFor(user);
    refreshWatchList();
    startSession(ctx.res, user, ctx.req);
    return sendJson(ctx.res, 200, { user: publicUser(user) });
  },

  'POST /api/auth/login': async (ctx) => {
    if (tooManyAttempts(clientIp(ctx.req))) return sendJson(ctx.res, 429, { error: 'Too many attempts, wait a minute' });
    const body = await ctx.body();
    const user = findByEmail(body.email || '');
    if (!user || !checkPassword(String(body.password || ''), user)) {
      return sendJson(ctx.res, 401, { error: 'Wrong email or password' });
    }
    if (user.blocked) return sendJson(ctx.res, 403, { error: 'This account is blocked' });
    user.lastSeenAt = now();
    user.lastIp = clientIp(ctx.req);
    startSession(ctx.res, user, ctx.req);
    return sendJson(ctx.res, 200, { user: publicUser(user) });
  },

  'POST /api/auth/logout': (ctx) => {
    if (ctx.session) { delete db.sessions[ctx.session.token]; save(); }
    ctx.res.setHeader('Set-Cookie', 'dicey_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return sendJson(ctx.res, 200, { ok: true });
  },

  /* ---- play ---- */
  'POST /api/play/round': async (ctx) => {
    const user = ctx.requireUser();
    if (!user) return;
    const body = await ctx.body();
    const bet = round2(body.bet);
    const payout = round2(body.payout);
    if (!(bet > 0)) return sendJson(ctx.res, 400, { error: 'Invalid bet' });
    if (bet > user.balance + 1e-9) return sendJson(ctx.res, 400, { error: 'Insufficient balance', balance: round2(user.balance) });
    if (payout < 0 || payout > bet * 100000) return sendJson(ctx.res, 400, { error: 'Invalid payout' });

    user.balance = round2(user.balance - bet + payout);
    user.stats.wagered = round2(user.stats.wagered + bet);
    user.stats.won = round2(user.stats.won + payout);
    user.stats.bets += 1;
    if (payout > bet) user.stats.wins += 1;
    user.lastSeenAt = now();
    user.lastIp = clientIp(ctx.req);
    addWager(user, bet, payout, now());

    db.rounds.push({
      id: id('rnd'),
      userId: user.id,
      gameId: String(body.gameId || 'unknown').slice(0, 40),
      game: String(body.game || 'Unknown').slice(0, 40),
      bet: bet,
      payout: payout,
      multiplier: round2(body.multiplier),
      ts: now(),
    });
    if (db.rounds.length > MAX_ROUNDS) db.rounds.splice(0, db.rounds.length - MAX_ROUNDS);
    save();
    return sendJson(ctx.res, 200, {
      balance: user.balance,
      stats: user.stats,
      rewards: rewardState(user, now()),
    });
  },

  /* ---- config & feed ---- */
  'GET /api/config': async (ctx) => {
    const user = ctx.session ? ctx.session.user : null;
    const addresses = user ? addressesFor(user) : null;

    return sendJson(ctx.res, 200, {
      coins: COINS
        .map((coin) => Object.assign({}, coin, { address: addresses ? addresses[coin.sym] : '' }))
        .filter((coin) => coin.address),
      hdEnabled: !!hdSeed,
      minDeposit: MIN_DEPOSIT_USD,
      confirmations: chain.config.confirmations,
      chainOnline: chain.online,
      bonus: user && user.bonus && !user.bonus.used ? user.bonus : null,
      depositRef: user ? user.depositRef : null,
    });
  },

  /* ---- rewards ---- */
  'GET /api/rewards': (ctx) => {
    const user = ctx.requireUser();
    if (!user) return;
    const state = rewardState(user, now());
    save();
    return sendJson(ctx.res, 200, { rewards: state, balance: round2(user.balance) });
  },

  'POST /api/rewards/claim': async (ctx) => {
    const user = ctx.requireUser();
    if (!user) return;
    const body = await ctx.body();
    const type = String(body.type || '');
    const state = rewardState(user, now());
    const reward = state[type];
    if (!reward) return sendJson(ctx.res, 400, { error: 'Unknown reward' });
    if (!reward.claimable) return sendJson(ctx.res, 400, { error: 'That bonus is not available yet' });

    const r = user.rewards;
    if (type === 'rakeback') r.rakeback = 0;
    if (type === 'daily') { r.daily.claimedAt = now(); r.daily.wagered = 0; r.daily.net = 0; }
    if (type === 'weekly') { r.weekly.claimedAt = now(); r.weekly.wagered = 0; r.weekly.net = 0; }
    if (type === 'monthly') { r.monthly.carryClaimed = r.monthly.carry.month; r.monthly.carry = { wagered: 0, net: 0, month: r.monthly.carry.month }; }

    user.balance = round2(user.balance + reward.amount);
    db.transactions.unshift({
      id: id('tx'),
      userId: user.id,
      type: 'bonus',
      coin: 'USD',
      address: '',
      amount: reward.amount,
      status: 'confirmed',
      note: type.charAt(0).toUpperCase() + type.slice(1) + ' bonus',
      ip: clientIp(ctx.req),
      ts: now(),
      resolvedAt: now(),
    });
    save();

    return sendJson(ctx.res, 200, {
      claimed: reward.amount,
      balance: user.balance,
      rewards: rewardState(user, now()),
    });
  },

  'GET /api/race': (ctx) => {
    settleRaceIfDue();
    const start = db.meta.raceStart;
    const board = raceBoard(start, 10)
      .map((entry) => ({ rank: entry.rank, user: entry.user, wagered: entry.wagered, prize: entry.prize }));
    const user = ctx.session ? ctx.session.user : null;

    let me = null;
    if (user) {
      const all = raceEntries(start);
      const index = all.findIndex((u) => u.id === user.id);
      me = {
        rank: index > -1 ? index + 1 : null,
        wagered: user.rewards && user.rewards.race && user.rewards.race.start === start ? round2(user.rewards.race.wagered) : 0,
        prize: index > -1 ? (RACE_PRIZES[index] || 0) : 0,
        players: all.length,
      };
    }

    return sendJson(ctx.res, 200, {
      pool: RACE_POOL,
      prizes: RACE_PRIZES,
      startedAt: start,
      endsAt: start + 7 * DAY,
      players: raceEntries(start).length,
      board: board,
      me: me,
      last: db.meta.lastRace || null,
    });
  },

  'GET /api/feed': (ctx) => {
    const tab = ctx.query.get('tab') || 'live';
    const limit = Math.min(50, Math.max(5, parseInt(ctx.query.get('limit'), 10) || 10));

    if (tab === 'race') {
      settleRaceIfDue();
      const board = raceBoard(db.meta.raceStart, limit)
        .map((entry) => ({ rank: entry.rank, user: entry.user, wagered: entry.wagered, prize: entry.prize }));
      return sendJson(ctx.res, 200, { tab: tab, race: board, endsAt: db.meta.raceStart + 7 * DAY });
    }

    let rounds = db.rounds.slice();
    if (tab === 'mine') {
      const user = ctx.requireUser();
      if (!user) return;
      rounds = rounds.filter((r) => r.userId === user.id);
    }

    if (tab === 'high') rounds.sort((a, b) => b.bet - a.bet);
    else if (tab === 'lucky') rounds = rounds.filter((r) => r.payout > r.bet).sort((a, b) => b.multiplier - a.multiplier);
    else rounds.reverse();

    const emails = {};
    db.users.forEach((u) => { emails[u.id] = maskEmail(u.email); });

    return sendJson(ctx.res, 200, {
      tab: tab,
      rows: rounds.slice(0, limit).map((r) => ({
        user: tab === 'mine' ? 'You' : (emails[r.userId] || 'Hidden'),
        game: r.game, gameId: r.gameId,
        bet: r.bet, multiplier: r.multiplier, payout: r.payout, ts: r.ts,
      })),
    });
  },

  /* ---- sportsbook ---- */
  'GET /api/sports/catalog': (ctx) => sendJson(ctx.res, 200, {
    enabled: sports.enabled(),
    sports: sports.sports,
  }),

  /** Fixtures come back immediately; odds are asked for separately so the page paints fast. */
  'GET /api/sports/events': async (ctx) => {
    const sportId = parseInt(ctx.query.get('sport_id'), 10) || 1;
    const page = Math.max(1, Math.min(20, parseInt(ctx.query.get('page'), 10) || 1));
    const withOdds = ctx.query.get('odds') === '1';
    try {
      const list = await sports.upcoming(sportId, page);
      const events = list.events.map((e) => Object.assign({}, e));
      sports.attachLogos(events);
      // crests and odds are filled in behind the scenes so the list paints at once
      sports.resolveLogos(events);
      if (withOdds) await sports.withMainOdds({ events: events });
      else sports.prefetchOdds(events.slice(0, sports.config.oddsPerPage).map((e) => e.id));
      return sendJson(ctx.res, 200, Object.assign({}, list, { events: events }));
    } catch (err) {
      return sendJson(ctx.res, 502, { error: err.message || 'Feed unavailable' });
    }
  },

  /** Headline odds for the rows on screen — used for the first paint and the 30s refresh. */
  'GET /api/sports/odds': async (ctx) => {
    const ids = String(ctx.query.get('ids') || '').split(',').map((s) => s.replace(/[^0-9]/g, '')).filter(Boolean).slice(0, 30);
    if (!ids.length) return sendJson(ctx.res, 200, { odds: {} });
    try {
      const events = await sports.mainOdds(ids);
      const odds = {};
      events.forEach((e) => {
        odds[e.id] = { main: e.main, marketCount: e.marketCount || 0, homeLogo: e.homeLogo || '', awayLogo: e.awayLogo || '' };
      });
      return sendJson(ctx.res, 200, { odds: odds });
    } catch (err) {
      return sendJson(ctx.res, 502, { error: err.message || 'Odds unavailable' });
    }
  },

  /** Team crests, proxied so the browser only ever talks to us. */
  'GET /api/sports/logo': async (ctx) => {
    const image = await sports.logoImage(ctx.query.get('id'));
    if (!image) return sendJson(ctx.res, 404, { error: 'No crest' });
    ctx.res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': image.length,
      'Cache-Control': 'public, max-age=604800',
    });
    return ctx.res.end(image);
  },

  'GET /api/sports/search': async (ctx) => {
    const sportId = parseInt(ctx.query.get('sport_id'), 10) || 1;
    const query = String(ctx.query.get('q') || '').slice(0, 60);
    try {
      const events = await sports.search(sportId, query);
      sports.attachLogos(events);
      sports.resolveLogos(events, 12);
      await sports.mainOdds(events.slice(0, 20));
      return sendJson(ctx.res, 200, { events: events, total: events.length, page: 1 });
    } catch (err) {
      return sendJson(ctx.res, 502, { error: err.message || 'Search unavailable' });
    }
  },

  'GET /api/sports/event': async (ctx) => {
    const fi = String(ctx.query.get('FI') || '').replace(/[^0-9]/g, '');
    if (!fi) return sendJson(ctx.res, 400, { error: 'Missing event id' });
    const hint = {
      home: ctx.query.get('home') || 'Home',
      away: ctx.query.get('away') || 'Away',
      league: ctx.query.get('league') || '',
      time: parseInt(ctx.query.get('time'), 10) || 0,
    };
    try {
      return sendJson(ctx.res, 200, await sports.eventDetail(fi, hint));
    } catch (err) {
      return sendJson(ctx.res, 502, { error: err.message || 'Odds unavailable' });
    }
  },

  'GET /api/sports/bets': (ctx) => {
    const user = ctx.requireUser();
    if (!user) return;
    const status = ctx.query.get('status') || 'all';
    const mine = db.sportsBets
      .filter((b) => b.userId === user.id && (status === 'all' || b.status === status))
      .slice(0, 60);
    return sendJson(ctx.res, 200, { bets: mine });
  },

  'POST /api/sports/bet': async (ctx) => {
    const user = ctx.requireUser();
    if (!user) return;
    const body = await ctx.body();
    const picks = Array.isArray(body.picks) ? body.picks.slice(0, 12) : [];
    if (!picks.length) return sendJson(ctx.res, 400, { error: 'Your slip is empty' });

    const useFreeBet = !!body.freeBet;
    const freeBet = user.freeBet && !user.freeBet.used ? user.freeBet : null;
    let stake = round2(body.stake);

    if (useFreeBet) {
      if (!freeBet) return sendJson(ctx.res, 400, { error: 'No free bet available' });
      if (picks.length !== 1) return sendJson(ctx.res, 400, { error: 'The free bet has to be a single' });
      stake = round2(freeBet.amount);
    } else {
      if (!(stake > 0)) return sendJson(ctx.res, 400, { error: 'Enter a stake' });
      if (stake > user.balance + 1e-9) return sendJson(ctx.res, 400, { error: 'Not enough balance' });
    }

    // never trust the price the browser sent: read it back from the feed
    const verified = [];
    for (const pick of picks) {
      let live = null;
      try {
        live = await sports.verifySelection(String(pick.fi || '').replace(/[^0-9]/g, ''), pick.selectionId);
      } catch (err) {
        return sendJson(ctx.res, 502, { error: 'Could not check the odds, try again' });
      }
      if (!live) return sendJson(ctx.res, 409, { error: 'A pick is no longer available', selectionId: pick.selectionId });
      if (Math.abs(live.odds - parseFloat(pick.odds)) > 0.001) {
        return sendJson(ctx.res, 409, { error: 'Odds moved on ' + (pick.label || 'a pick'), selectionId: pick.selectionId, odds: live.odds });
      }
      verified.push({
        fi: String(pick.fi),
        selectionId: String(pick.selectionId),
        odds: live.odds,
        market: String(pick.market || live.market).slice(0, 60),
        label: String(pick.label || '').slice(0, 80),
        home: String(pick.home || '').slice(0, 60),
        away: String(pick.away || '').slice(0, 60),
        league: String(pick.league || '').slice(0, 80),
        sportId: parseInt(pick.sportId, 10) || 0,
        sport: String(pick.sport || '').slice(0, 30),
        time: parseInt(pick.time, 10) || 0,
      });
    }

    if (useFreeBet) {
      const odds = verified[0].odds;
      if (odds < freeBet.minOdds || odds > freeBet.maxOdds) {
        return sendJson(ctx.res, 400, {
          error: 'The free bet needs odds between ' + freeBet.minOdds.toFixed(2) + ' and ' + freeBet.maxOdds.toFixed(2),
        });
      }
    }

    const combined = round2(verified.reduce((total, p) => total * p.odds, 1));
    const potential = round2(stake * combined);

    if (!useFreeBet) {
      user.balance = round2(user.balance - stake);
    } else {
      user.freeBet.used = true;
    }

    // sports stakes count as wagering for VIP, rakeback and the race
    user.stats.wagered = round2(user.stats.wagered + stake);
    user.stats.bets += 1;
    addWager(user, stake, 0, now());
    user.lastSeenAt = now();
    user.lastIp = clientIp(ctx.req);

    const bet = {
      id: id('sb'),
      userId: user.id,
      ts: now(),
      type: verified.length > 1 ? 'combo' : 'single',
      stake: stake,
      freeBet: useFreeBet,
      odds: combined,
      potential: potential,
      status: 'pending',
      picks: verified,
    };
    db.sportsBets.unshift(bet);
    if (db.sportsBets.length > 5000) db.sportsBets.length = 5000;
    save();

    return sendJson(ctx.res, 200, { bet: bet, balance: round2(user.balance), freeBet: user.freeBet || null });
  },

  /* ---- wallet ---- */
  'POST /api/wallet/sender': async (ctx) => {
    const user = ctx.requireUser();
    if (!user) return;
    const body = await ctx.body();
    const address = String(body.address || '').trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address)) return sendJson(ctx.res, 400, { error: 'Enter a valid 0x… wallet address' });
    const taken = db.users.filter((u) => u.walletAddress === address && u.id !== user.id)[0];
    if (taken) return sendJson(ctx.res, 409, { error: 'Another account already uses that wallet' });
    user.walletAddress = address;
    save();
    return sendJson(ctx.res, 200, { walletAddress: address });
  },

  'POST /api/wallet/deposit': async (ctx) => {
    const user = ctx.requireUser();
    if (!user) return;
    const body = await ctx.body();
    const amount = round2(body.amount);
    if (!(amount > 0)) return sendJson(ctx.res, 400, { error: 'Enter an amount' });
    const tx = {
      id: id('tx'),
      userId: user.id,
      type: 'deposit',
      coin: String(body.coin || 'BTC').toUpperCase().slice(0, 8),
      address: String(body.address || '').slice(0, 120),
      amount: amount,
      status: 'pending',
      note: '',
      ip: clientIp(ctx.req),
      ts: now(),
    };
    db.transactions.unshift(tx);
    save();
    return sendJson(ctx.res, 200, { transaction: tx, balance: round2(user.balance) });
  },

  'POST /api/wallet/withdraw': async (ctx) => {
    const user = ctx.requireUser();
    if (!user) return;
    const body = await ctx.body();
    const amount = round2(body.amount);
    const address = String(body.address || '').trim();
    if (!address) return sendJson(ctx.res, 400, { error: 'Enter a wallet address' });
    if (!(amount >= 20)) return sendJson(ctx.res, 400, { error: 'Minimum withdrawal is $20' });
    if (amount > user.balance + 1e-9) return sendJson(ctx.res, 400, { error: 'Not enough balance' });

    user.balance = round2(user.balance - amount);
    const tx = {
      id: id('tx'),
      userId: user.id,
      type: 'withdraw',
      coin: String(body.coin || 'BTC').toUpperCase().slice(0, 8),
      address: address.slice(0, 120),
      amount: amount,
      status: 'pending',
      note: '',
      ip: clientIp(ctx.req),
      ts: now(),
    };
    db.transactions.unshift(tx);
    save();
    return sendJson(ctx.res, 200, { transaction: tx, balance: user.balance });
  },

  /** Cheap poll the client uses to notice a deposit landing. */
  'GET /api/wallet/news': (ctx) => {
    const user = ctx.requireUser();
    if (!user) return;
    const since = parseInt(ctx.query.get('since'), 10) || 0;
    const deposits = db.transactions
      .filter((t) => t.userId === user.id && t.type === 'deposit' && t.status === 'confirmed' && t.ts > since)
      .slice(0, 5)
      .map((t) => ({ id: t.id, coin: t.coin, amount: t.amount, crypto: t.crypto, ts: t.ts }));

    return sendJson(ctx.res, 200, {
      deposits: deposits,
      balance: round2(user.balance),
      freeBet: user.freeBet || null,
      now: now(),
    });
  },

  'POST /api/wallet/freebet-seen': (ctx) => {
    const user = ctx.requireUser();
    if (!user) return;
    if (user.freeBet) { user.freeBet.seen = true; save(); }
    return sendJson(ctx.res, 200, { ok: true });
  },

  'GET /api/wallet/transactions': (ctx) => {
    const user = ctx.requireUser();
    if (!user) return;
    return sendJson(ctx.res, 200, {
      transactions: db.transactions.filter((t) => t.userId === user.id).slice(0, 50),
    });
  },

  'GET /api/me/bets': (ctx) => {
    const user = ctx.requireUser();
    if (!user) return;
    const mine = db.rounds.filter((r) => r.userId === user.id).slice(-40).reverse();
    return sendJson(ctx.res, 200, { bets: mine, stats: user.stats });
  },

  /* ---- admin ---- */
  'GET /api/admin/overview': (ctx) => {
    const admin = ctx.requireAdmin();
    if (!admin) return;
    const users = db.users.map((u) => Object.assign(publicUser(u), {
      signupIp: u.signupIp,
      lastIp: u.lastIp,
      lastSeenAt: u.lastSeenAt,
      blocked: !!u.blocked,
      totals: userAggregates(u),
    }));
    const confirmed = (type) => round2(db.transactions
      .filter((t) => t.type === type && t.status === 'confirmed')
      .reduce((sum, t) => sum + t.amount, 0));
    return sendJson(ctx.res, 200, {
      users: users,
      pending: db.transactions.filter((t) => t.status === 'pending' || t.status === 'unclaimed')
        .map((t) => Object.assign({}, t, { email: (findUser(t.userId) || {}).email })),
      totals: {
        users: db.users.length,
        deposited: confirmed('deposit'),
        withdrawn: confirmed('withdraw'),
        balances: round2(db.users.reduce((sum, u) => sum + u.balance, 0)),
        wagered: round2(db.rounds.reduce((sum, r) => sum + r.bet, 0)),
        houseProfit: round2(db.rounds.reduce((sum, r) => sum + r.bet - r.payout, 0)),
      },
    });
  },

  'GET /api/admin/user': (ctx) => {
    const admin = ctx.requireAdmin();
    if (!admin) return;
    const user = findUser(ctx.query.get('id'));
    if (!user) return sendJson(ctx.res, 404, { error: 'No such user' });
    return sendJson(ctx.res, 200, {
      user: Object.assign(publicUser(user), {
        signupIp: user.signupIp,
        lastIp: user.lastIp,
        lastSeenAt: user.lastSeenAt,
        blocked: !!user.blocked,
        totals: userAggregates(user),
      }),
      bets: db.rounds.filter((r) => r.userId === user.id).slice(-60).reverse(),
      transactions: db.transactions.filter((t) => t.userId === user.id).slice(0, 60),
      referrals: db.users.filter((u) => u.referredBy === user.referralCode).map((u) => u.email),
    });
  },

  'POST /api/admin/transaction': async (ctx) => {
    const admin = ctx.requireAdmin();
    if (!admin) return;
    const body = await ctx.body();
    const tx = db.transactions.filter((t) => t.id === body.id)[0];
    if (!tx) return sendJson(ctx.res, 404, { error: 'No such transaction' });
    if (tx.status !== 'pending') return sendJson(ctx.res, 400, { error: 'Already resolved' });

    const status = body.status === 'confirmed' ? 'confirmed' : 'rejected';
    const user = findUser(tx.userId);

    if (user) {
      // deposits only credit once confirmed; withdrawals are held up front and refunded on reject
      if (tx.type === 'deposit' && status === 'confirmed') user.balance = round2(user.balance + tx.amount);
      if (tx.type === 'withdraw' && status === 'rejected') user.balance = round2(user.balance + tx.amount);
    }

    tx.status = status;
    tx.note = String(body.note || '').slice(0, 200);
    tx.resolvedAt = now();
    tx.resolvedBy = admin.email;
    save();
    return sendJson(ctx.res, 200, { transaction: tx });
  },

  'POST /api/admin/balance': async (ctx) => {
    const admin = ctx.requireAdmin();
    if (!admin) return;
    const body = await ctx.body();
    const user = findUser(body.id);
    if (!user) return sendJson(ctx.res, 404, { error: 'No such user' });
    const amount = round2(body.amount);
    if (!amount) return sendJson(ctx.res, 400, { error: 'Enter an amount' });
    if (user.balance + amount < 0) return sendJson(ctx.res, 400, { error: 'That would put the balance below zero' });

    user.balance = round2(user.balance + amount);
    db.transactions.unshift({
      id: id('tx'),
      userId: user.id,
      type: 'adjust',
      coin: 'USD',
      address: '',
      amount: amount,
      status: 'confirmed',
      note: String(body.note || 'Manual adjustment').slice(0, 200),
      ip: clientIp(ctx.req),
      ts: now(),
      resolvedAt: now(),
      resolvedBy: admin.email,
    });
    save();
    return sendJson(ctx.res, 200, { balance: user.balance });
  },

  /** Attach an unidentified on-chain deposit to a player and credit it. */
  'POST /api/admin/assign': async (ctx) => {
    const admin = ctx.requireAdmin();
    if (!admin) return;
    const body = await ctx.body();
    const tx = db.transactions.filter((t) => t.id === body.id)[0];
    if (!tx) return sendJson(ctx.res, 404, { error: 'No such transaction' });
    if (tx.status === 'confirmed') return sendJson(ctx.res, 400, { error: 'Already credited' });

    const user = findByEmail(body.email || '') || findUser(body.userId);
    if (!user) return sendJson(ctx.res, 404, { error: 'No player with that email' });

    const amount = round2(body.amount || tx.amount);
    if (!(amount > 0)) return sendJson(ctx.res, 400, { error: 'Set the USD amount for this deposit' });

    tx.userId = user.id;
    tx.amount = amount;
    tx.status = 'confirmed';
    tx.resolvedAt = now();
    tx.resolvedBy = admin.email;
    user.balance = round2(user.balance + amount);
    if (user.bonus && !user.bonus.used) { tx.bonus = user.bonus.label; grantFreeBet(user, amount); }
    if (!user.walletAddress && tx.address) user.walletAddress = tx.address;
    save();
    return sendJson(ctx.res, 200, { transaction: tx, balance: user.balance });
  },

  /** Sports bets settle by hand for now: won pays out, void refunds. */
  'POST /api/admin/sports/settle': async (ctx) => {
    const admin = ctx.requireAdmin();
    if (!admin) return;
    const body = await ctx.body();
    const bet = db.sportsBets.filter((b) => b.id === body.id)[0];
    if (!bet) return sendJson(ctx.res, 404, { error: 'No such bet' });
    if (bet.status !== 'pending') return sendJson(ctx.res, 400, { error: 'Already settled' });

    const result = ['won', 'lost', 'void'].indexOf(body.result) > -1 ? body.result : 'lost';
    const user = findUser(bet.userId);
    let paid = 0;

    if (user) {
      if (result === 'won') paid = bet.potential;
      if (result === 'void') paid = bet.freeBet ? 0 : bet.stake;
      if (paid) {
        user.balance = round2(user.balance + paid);
        user.stats.won = round2(user.stats.won + paid);
        if (result === 'won') user.stats.wins += 1;
        const rewards = ensureRewards(user, now());
        ['daily', 'weekly', 'monthly'].forEach((key) => { rewards[key].net = round2(rewards[key].net - paid); });
      }
      if (result === 'void' && bet.freeBet && user.freeBet) user.freeBet.used = false;
    }

    bet.status = result;
    bet.settledAt = now();
    bet.paid = paid;
    bet.settledBy = admin.email;

    if (paid && user) {
      db.transactions.unshift({
        id: id('tx'),
        userId: user.id,
        type: 'sports',
        coin: 'USD',
        address: '',
        amount: paid,
        status: 'confirmed',
        note: (result === 'won' ? 'Sports bet won at ' : 'Sports bet voided — ') + bet.odds + 'x',
        ip: '',
        ts: now(),
        resolvedAt: now(),
      });
    }
    save();
    return sendJson(ctx.res, 200, { bet: bet, balance: user ? round2(user.balance) : 0 });
  },

  'GET /api/admin/sports/bets': (ctx) => {
    const admin = ctx.requireAdmin();
    if (!admin) return;
    const status = ctx.query.get('status') || 'pending';
    const emails = {};
    db.users.forEach((u) => { emails[u.id] = u.email; });
    return sendJson(ctx.res, 200, {
      bets: db.sportsBets
        .filter((b) => status === 'all' || b.status === status)
        .slice(0, 80)
        .map((b) => Object.assign({ email: emails[b.userId] }, b)),
    });
  },

  'POST /api/admin/block': async (ctx) => {
    const admin = ctx.requireAdmin();
    if (!admin) return;
    const body = await ctx.body();
    const user = findUser(body.id);
    if (!user) return sendJson(ctx.res, 404, { error: 'No such user' });
    if (user.isAdmin) return sendJson(ctx.res, 400, { error: 'You cannot block an admin' });
    user.blocked = !!body.blocked;
    if (user.blocked) {
      Object.keys(db.sessions).forEach((token) => {
        if (db.sessions[token].userId === user.id) delete db.sessions[token];
      });
    }
    save();
    return sendJson(ctx.res, 200, { blocked: user.blocked });
  },
};

/* ------------------------------------------------------------------ server */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const key = req.method + ' ' + url.pathname;

  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' });
    return serveStatic(req, res, url.pathname);
  }

  const handler = ROUTES[key];
  if (!handler) return sendJson(res, 404, { error: 'Unknown endpoint' });

  const session = sessionFrom(req);
  const ctx = {
    req: req,
    res: res,
    query: url.searchParams,
    session: session,
    body: () => readBody(req),
    requireUser() {
      if (!session) { sendJson(res, 401, { error: 'Sign in first' }); return null; }
      if (session.user.blocked) { sendJson(res, 403, { error: 'This account is blocked' }); return null; }
      return session.user;
    },
    requireAdmin() {
      const user = ctx.requireUser();
      if (!user) return null;
      if (!user.isAdmin) { sendJson(res, 403, { error: 'Admins only' }); return null; }
      return user;
    },
  };

  Promise.resolve()
    .then(() => handler(ctx))
    .catch((err) => {
      console.error(key, err);
      if (!res.headersSent) sendJson(res, 400, { error: err.message || 'Request failed' });
    });
});

/* ------------------------------------------------------------------ admin bootstrap */

function bootstrapAdmin() {
  const argv = process.argv.slice(2);
  const flagIndex = argv.indexOf('--admin-password');
  const cliPassword = flagIndex > -1 ? argv[flagIndex + 1] : null;
  const email = (process.env.DICEY_ADMIN_EMAIL || 'infektorr234@gmail.com').trim().toLowerCase();
  const password = cliPassword || process.env.DICEY_ADMIN_PASSWORD || null;

  let admin = findByEmail(email);

  if (!admin) {
    const chosen = password || crypto.randomBytes(9).toString('base64url');
    const creds = hashPassword(chosen);
    admin = {
      id: id('usr'),
      email: email,
      salt: creds.salt,
      hash: creds.hash,
      balance: 0,
      isAdmin: true,
      blocked: false,
      referralCode: referralCode(),
      referredBy: null,
      createdAt: now(),
      lastSeenAt: now(),
      signupIp: 'console',
      lastIp: 'console',
      stats: { wagered: 0, won: 0, bets: 0, wins: 0 },
    };
    db.users.push(admin);
    save();

    if (password) {
      console.log('Admin account created for ' + email + ' with the password you supplied.');
    } else {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(path.join(DATA_DIR, 'admin-password.txt'), chosen + '\n');
      console.log('Admin account created for ' + email);
      console.log('Generated password: ' + chosen + '  (also saved to data/admin-password.txt)');
      console.log('Set your own with:  node server.js --admin-password "your password"');
    }
    return;
  }

  admin.isAdmin = true;
  if (password) {
    const creds = hashPassword(password);
    admin.salt = creds.salt;
    admin.hash = creds.hash;
    console.log('Admin password updated for ' + email);
  }
  save();
}

/* ------------------------------------------------------------------ deposit watcher */

/** Tells the watcher about every player's derived addresses. */
function refreshWatchList() {
  if (!hdSeed) return;
  chain.setWatchList(db.users.map((user) => {
    const addresses = addressesFor(user);
    return addresses ? Object.assign({ userId: user.id }, addresses) : null;
  }).filter(Boolean));
}

function startWatcher() {
  // `node server.js --resync-deposits` forgets what has been credited and
  // re-baselines every address, so an upgrade cannot re-credit old balances
  if (process.argv.indexOf('--resync-deposits') > -1) {
    db.meta.chainState = {};
    save();
    console.log('Deposit ledger cleared — balances will be re-baselined on the first sweep.');
  }

  if (!hdSeed) {
    console.log('No wallet seed found — put your BIP39 mnemonic in data/seed.txt to hand out deposit addresses.');
    return;
  }
  refreshWatchList();
  const counts = chain.watchCount();
  console.log('Watching ' + counts.eth + ' ETH, ' + counts.btc + ' BTC and ' + counts.sol + ' SOL deposit addresses');

  const state = {
    get: (key) => db.meta.chainState[key],
    set: (key, value) => { db.meta.chainState[key] = value; save(); },
  };

  chain.watch(
    {
      block: { get: () => db.meta.lastBlock, set: (block) => { db.meta.lastBlock = block; save(); } },
      state: state,
    },
    // chain.js only ever reports the difference between the chain and what we
    // have already credited, so every deposit reaching this point is new
    async (deposit) => {
      const owner = deposit.userId ? findUser(deposit.userId) : null;

      if (!owner) {
        creditDeposit(null, deposit, 'unclaimed');
        console.log('Deposit to an unknown address: ' + deposit.coin + ' ' + deposit.amount);
        return;
      }

      // anything worth the minimum lands on the balance without anyone approving it
      if (deposit.usd >= MIN_DEPOSIT_USD) {
        creditDeposit(owner, deposit, 'confirmed');
        console.log('Credited $' + deposit.usd + ' to ' + owner.email + ' (' + deposit.coin + ' ' + deposit.amount + ')');
        return;
      }

      creditDeposit(owner, deposit, 'pending',
        'Worth $' + deposit.usd + ' — under the $' + MIN_DEPOSIT_USD + ' minimum');
      console.log('Held deposit from ' + owner.email + ': ' + deposit.coin + ' ' + deposit.amount + ' ($' + deposit.usd + ')');
    }
  );
}

hdSeed = loadSeed();
bootstrapAdmin();
settleRaceIfDue();

// catches the Sunday 02:00 rollover even when nobody is browsing
const raceTimer = setInterval(settleRaceIfDue, 60000);
if (raceTimer.unref) raceTimer.unref();

server.listen(PORT, () => {
  console.log('Dicey running on http://localhost:' + PORT);
  console.log(db.users.length + ' account(s) in ' + path.relative(ROOT, DB_FILE));
  startWatcher();
});
