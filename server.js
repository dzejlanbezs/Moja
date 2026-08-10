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

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = parseInt(process.env.PORT, 10) || 3000;
const SESSION_DAYS = 30;
const MAX_ROUNDS = 20000;

/* ------------------------------------------------------------------ storage */

const EMPTY_DB = { users: [], sessions: {}, rounds: [], transactions: [] };

function loadDb() {
  try {
    return Object.assign({}, EMPTY_DB, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Could not read db.json, starting empty:', err.message);
    return JSON.parse(JSON.stringify(EMPTY_DB));
  }
}

const db = loadDb();
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
    createdAt: user.createdAt,
    stats: user.stats,
  };
}

/* ------------------------------------------------------------------ sessions */

function sessionFrom(req) {
  const cookie = req.headers.cookie || '';
  const match = /(?:^|;\s*)dicey_session=([^;]+)/.exec(cookie);
  if (!match) return null;
  const record = db.sessions[match[1]];
  if (!record) return null;
  if (now() - record.createdAt > SESSION_DAYS * 864e5) {
    delete db.sessions[match[1]];
    save();
    return null;
  }
  const user = findUser(record.userId);
  if (!user) return null;
  return { token: match[1], user: user };
}

function startSession(res, user, req) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = { userId: user.id, createdAt: now(), ip: clientIp(req), ua: req.headers['user-agent'] || '' };
  res.setHeader('Set-Cookie',
    'dicey_session=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + SESSION_DAYS * 86400);
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
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
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
    if (referral) {
      const owner = db.users.filter((u) => u.referralCode === referral)[0];
      if (!owner) return sendJson(ctx.res, 400, { error: 'That referral code does not exist' });
      referredBy = owner.referralCode;
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
      createdAt: now(),
      lastSeenAt: now(),
      signupIp: clientIp(ctx.req),
      lastIp: clientIp(ctx.req),
      stats: { wagered: 0, won: 0, bets: 0, wins: 0 },
    };
    db.users.push(user);
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
    return sendJson(ctx.res, 200, { balance: user.balance, stats: user.stats });
  },

  /* ---- wallet ---- */
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
      pending: db.transactions.filter((t) => t.status === 'pending')
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

bootstrapAdmin();

server.listen(PORT, () => {
  console.log('Dicey running on http://localhost:' + PORT);
  console.log(db.users.length + ' account(s) in ' + path.relative(ROOT, DB_FILE));
});
