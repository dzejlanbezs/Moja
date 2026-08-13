/* ============================================================
   Dicey — sportsbook feed (bet365 via b365api)

   Fetches upcoming fixtures and prematch odds, caches them so we
   stay inside the API's request budget, and flattens bet365's very
   nested market payload into something the browser can render.

   The token never reaches the browser: put it in data/b365-token.txt
   or the DICEY_B365_TOKEN environment variable.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, 'data', 'b365-token.txt');
const BASE = 'https://api.b365api.com';

const TEAMS_FILE = path.join(__dirname, 'data', 'teams.json');
const IMAGE_BASE = 'https://assets.b365api.com/images/team/s/';

const config = {
  upcomingTtl: parseInt(process.env.DICEY_SPORTS_LIST_TTL, 10) || 90000,
  oddsTtl: parseInt(process.env.DICEY_SPORTS_ODDS_TTL, 10) || 25000,
  oddsPerPage: parseInt(process.env.DICEY_SPORTS_ODDS_PER_PAGE, 10) || 20,
  oddsBatch: 10,            // the feed accepts ten FI values per request
  logoConcurrency: 6,
  maxSelections: 40,
  timeoutMs: 15000,
};

// sport_id list as published by the provider
const SPORTS = [
  { id: 1, name: 'Soccer', icon: 'soccer' },
  { id: 13, name: 'Tennis', icon: 'tennis' },
  { id: 18, name: 'Basketball', icon: 'basketball' },
  { id: 16, name: 'Baseball', icon: 'baseball' },
  { id: 91, name: 'Volleyball', icon: 'volleyball' },
  { id: 78, name: 'Handball', icon: 'handball' },
  { id: 17, name: 'Ice Hockey', icon: 'hockey' },
  { id: 12, name: 'American Football', icon: 'football' },
  { id: 151, name: 'E-sports', icon: 'esports' },
  { id: 162, name: 'MMA/UFC', icon: 'mma' },
  { id: 9, name: 'Boxing', icon: 'boxing' },
  { id: 14, name: 'Snooker', icon: 'snooker' },
  { id: 3, name: 'Cricket', icon: 'cricket' },
  { id: 15, name: 'Darts', icon: 'darts' },
  { id: 92, name: 'Table Tennis', icon: 'tabletennis' },
  { id: 94, name: 'Badminton', icon: 'badminton' },
  { id: 8, name: 'Rugby Union', icon: 'rugby' },
  { id: 19, name: 'Rugby League', icon: 'rugby' },
  { id: 36, name: 'Australian Rules', icon: 'aussie' },
  { id: 83, name: 'Futsal', icon: 'futsal' },
  { id: 2, name: 'Horse Racing', icon: 'horse' },
  { id: 4, name: 'Greyhounds', icon: 'greyhound' },
  { id: 66, name: 'Bowls', icon: 'bowls' },
  { id: 75, name: 'Gaelic Sports', icon: 'gaelic' },
  { id: 90, name: 'Floorball', icon: 'floorball' },
  { id: 95, name: 'Beach Volleyball', icon: 'volleyball' },
  { id: 110, name: 'Water Polo', icon: 'waterpolo' },
  { id: 107, name: 'Squash', icon: 'squash' },
];

const SPORT_BY_ID = {};
SPORTS.forEach((s) => { SPORT_BY_ID[s.id] = s; });

let token = process.env.DICEY_B365_TOKEN || '';
if (!token) {
  try { token = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch (err) { token = ''; }
}

const enabled = () => !!token;

/* ------------------------------------------------------------------ cache ---- */

const cache = new Map();
const inflight = new Map();

function cached(key, ttl, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value);
  if (inflight.has(key)) return inflight.get(key);

  const run = loader()
    .then((value) => {
      cache.set(key, { at: Date.now(), value: value });
      inflight.delete(key);
      return value;
    })
    .catch((err) => {
      inflight.delete(key);
      if (hit) return hit.value;      // serve something stale rather than nothing
      throw err;
    });

  inflight.set(key, run);
  return run;
}

/** Runs a job over a list with a small concurrency cap. */
async function pool(size, items, job) {
  const queue = items.slice();
  const workers = [];
  for (let i = 0; i < Math.min(size, queue.length); i++) {
    workers.push((async () => {
      while (queue.length) {
        const item = queue.shift();
        try { await job(item); } catch (err) { /* one failure must not stop the rest */ }
      }
    })());
  }
  await Promise.all(workers);
}

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

async function apiGet(pathname, params) {
  if (!enabled()) throw new Error('Sportsbook is not configured');
  const url = new URL(BASE + pathname);
  Object.keys(params).forEach((k) => url.searchParams.set(k, params[k]));
  url.searchParams.set('token', token);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!data || data.success !== 1) throw new Error((data && (data.error || data.error_detail)) || 'Feed unavailable');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ labels ---- */

const TEAM_HEADERS = { 1: 'home', 2: 'away' };
const DRAW_HEADER = '3';   // three-way markets use header 3 for the draw
const SIDE_HEADERS = { Over: 1, Under: 1, Yes: 1, No: 1 };

const titleCase = (key) => String(key)
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase())
  .replace(/\b(\d)(st|nd|rd|th)\b/gi, (m) => m.toLowerCase());

/** "O 39.5" -> "Over 39.5", "U 2.5" -> "Under 2.5". */
function expandOverUnder(text) {
  const match = /^(O|U|Over|Under)\b[\s:]*(.*)$/i.exec(text);
  if (!match) return null;
  const side = match[1].toUpperCase().charAt(0) === 'O' ? 'Over' : 'Under';
  return (side + ' ' + (match[2] || '')).trim();
}

/** bet365 labels selections in a dozen shapes; this turns one into text. */
function selectionLabel(entry, event, marketName) {
  const name = entry.name == null ? '' : String(entry.name).trim();
  const header = entry.header == null ? '' : String(entry.header).trim();
  const handicap = entry.handicap == null ? '' : String(entry.handicap).trim();

  const team = (side) => (side === 'home' ? event.home : event.away);
  const parts = [];

  // a plain total is about the match, not one side, so the team name is noise
  const market = String(marketName || '').toLowerCase();
  const wholeMatchTotal = /total|over\/under|goal line/.test(market) && !/team|player|home|away/.test(market);
  if (wholeMatchTotal) {
    const spread = expandOverUnder(handicap) || expandOverUnder(name);
    if (spread) return spread;
  }

  if (header === DRAW_HEADER && !name.match(/\d/)) {
    return 'Draw';
  }

  if (TEAM_HEADERS[header] && !TEAM_HEADERS[name]) {
    // header picks the team, name/handicap says what about them
    parts.push(team(TEAM_HEADERS[header]));
    if (name && name !== 'Money Line' && name !== 'Line') parts.push(name);
    if (handicap) parts.push(expandOverUnder(handicap) || handicap);
  } else if (TEAM_HEADERS[name]) {
    parts.push(team(TEAM_HEADERS[name]));
    if (handicap) parts.push(expandOverUnder(handicap) || handicap);
  } else if (SIDE_HEADERS[header]) {
    parts.push(header);
    parts.push(name || handicap);
  } else if (name.toLowerCase() === 'draw' || name === 'X') {
    parts.push('Draw');
  } else {
    if (name) parts.push(name);
    else if (header) parts.push(header);
    if (handicap && handicap !== name) parts.push(handicap);
  }

  const label = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return label || 'Pick';
}

/**
 * Markets like "Game Lines" pack Spread / Money Line / Total together and
 * tell them apart with `header`. Split those into separate markets.
 */
function splitByHeader(market, event) {
  const headers = [];
  market.odds.forEach((o) => {
    const h = o.header == null ? '' : String(o.header).trim();
    if (h && headers.indexOf(h) === -1) headers.push(h);
  });

  const isSubMarket = headers.length > 1 && headers.every((h) => !TEAM_HEADERS[h] && !SIDE_HEADERS[h]);
  if (!isSubMarket) return [market];

  return headers.map((header) => ({
    key: market.key + '_' + header.toLowerCase().replace(/\s+/g, '_'),
    name: header,
    odds: market.odds.filter((o) => String(o.header).trim() === header),
  }));
}

function toSelections(market, event) {
  return market.odds
    .filter((o) => o && o.odds && parseFloat(o.odds) > 1)
    .slice(0, config.maxSelections)
    .map((o) => ({
      id: String(o.id),
      label: selectionLabel(o, event, market.name),
      odds: Math.round(parseFloat(o.odds) * 1000) / 1000,
      handicap: o.handicap || '',
    }));
}

/** Order the markets so the ones punters actually want are on top. */
const MARKET_RANK = [
  'full time result', 'to win match', 'money line', 'match winner', 'game lines',
  'spread', 'total', 'goals over/under', 'asian handicap', 'goal line', 'double chance',
  'draw no bet', 'both teams to score', 'half time result', 'correct score',
];
const rankOf = (name) => {
  const i = MARKET_RANK.indexOf(String(name).toLowerCase());
  return i === -1 ? MARKET_RANK.length : i;
};

/** Flattens one prematch result into a plain list of markets. */
function normaliseMarkets(result, event) {
  const markets = [];
  const seen = new Set();

  const push = (key, raw) => {
    const odds = raw.odds || [];
    if (!odds.length) return;
    const base = { key: key, name: raw.name || titleCase(key), odds: odds };
    splitByHeader(base, event).forEach((market) => {
      const selections = toSelections(market, event);
      if (!selections.length) return;

      // the same market turns up under several groups; keep the first, and
      // treat an identical set of selection ids as the same market too
      const byName = 'n:' + market.name.toLowerCase();
      const byIds = 'i:' + selections.map((s) => s.id).join(',');
      if (seen.has(byName) || seen.has(byIds)) return;
      seen.add(byName);
      seen.add(byIds);
      markets.push({ key: market.key, name: market.name, selections: selections });
    });
  };

  Object.keys(result).forEach((groupKey) => {
    if (['FI', 'event_id', 'sport_id'].indexOf(groupKey) > -1) return;
    const groups = Array.isArray(result[groupKey]) ? result[groupKey] : [result[groupKey]];

    groups.forEach((group) => {
      const sp = group && group.sp;
      if (!sp) return;
      Object.keys(sp).forEach((marketKey) => {
        const market = sp[marketKey];
        if (Array.isArray(market)) {
          // reduced shape: bare odds with no market name
          const labelled = market.map((o, i) => Object.assign({}, o, {
            name: o.name || (market.length === 3 ? ['1', 'Draw', '2'][i] : ['1', '2'][i] || String(i + 1)),
          }));
          push(marketKey === 'main' ? 'match_result' : marketKey, { name: marketKey === 'main' ? 'Match Result' : titleCase(marketKey), odds: labelled });
        } else if (market && typeof market === 'object') {
          push(marketKey, market);
        }
      });
    });
  });

  markets.sort((a, b) => rankOf(a.name) - rankOf(b.name));
  return markets;
}

/* ------------------------------------------------------------------ public ---- */

function normaliseEvent(raw) {
  return {
    id: String(raw.id),
    ourEventId: raw.our_event_id ? String(raw.our_event_id) : '',
    sportId: parseInt(raw.sport_id, 10),
    sport: (SPORT_BY_ID[parseInt(raw.sport_id, 10)] || {}).name || 'Sport',
    time: parseInt(raw.time, 10) * 1000,
    league: (raw.league && raw.league.name) || '',
    home: (raw.home && raw.home.name) || 'Home',
    away: (raw.away && raw.away.name) || 'Away',
  };
}

// simulated leagues run every few minutes and would bury the real fixtures
const VIRTUAL = /(^|\b)(e|v)(soccer|basketball|tennis|cricket|hockey|fighting)|\bmins play\b|\bsimulat/i;
const isVirtual = (event) => VIRTUAL.test(event.league);

function upcoming(sportId, page) {
  const key = 'up:' + sportId + ':' + (page || 1);
  return cached(key, config.upcomingTtl, async () => {
    const data = await apiGet('/v1/bet365/upcoming', { sport_id: sportId, page: page || 1 });
    const events = (data.results || [])
      .filter((e) => e.time_status === '0')
      .map(normaliseEvent)
      .map((e) => Object.assign(e, { virtual: isVirtual(e) }));

    events.sort((a, b) => (a.virtual ? 1 : 0) - (b.virtual ? 1 : 0) || a.time - b.time || a.league.localeCompare(b.league));
    rememberHints(events);

    return {
      total: (data.pager && data.pager.total) || events.length,
      page: (data.pager && data.pager.page) || 1,
      perPage: (data.pager && data.pager.per_page) || 50,
      events: events,
    };
  });
}

/* ---- odds: one request covers ten events, so cache them individually ---- */

const oddsCache = new Map();
const oddsInflight = new Map();

async function loadOddsChunk(ids) {
  const key = ids.join(',');
  if (oddsInflight.has(key)) return oddsInflight.get(key);

  const run = apiGet('/v4/bet365/prematch', { FI: key })
    .then((data) => {
      (data.results || []).forEach((result) => {
        if (result && result.FI) oddsCache.set(String(result.FI), { at: Date.now(), result: result });
      });
      // remember the blanks too, so a market-less event is not re-requested in a loop
      ids.forEach((fi) => { if (!oddsCache.has(fi)) oddsCache.set(fi, { at: Date.now(), result: null }); });
      oddsInflight.delete(key);
    })
    .catch((err) => {
      oddsInflight.delete(key);
      throw err;
    });

  oddsInflight.set(key, run);
  return run;
}

/** Fresh odds for a list of events, fetched ten at a time in parallel. */
async function loadOdds(fis) {
  const now = Date.now();
  const missing = fis.filter((fi) => {
    const hit = oddsCache.get(fi);
    return !hit || now - hit.at > config.oddsTtl;
  });

  if (missing.length) {
    await Promise.all(chunk(missing, config.oddsBatch).map((group) => loadOddsChunk(group).catch(() => {})));
  }

  const out = new Map();
  fis.forEach((fi) => {
    const hit = oddsCache.get(fi);
    if (hit && hit.result) out.set(fi, hit.result);
  });
  return out;
}

async function eventOdds(fi) {
  const found = await loadOdds([String(fi)]);
  const result = found.get(String(fi));
  if (!result) throw new Error('No odds published for that event');
  return result;
}

// event id -> team names, so odds requests never need to re-read a fixture list
const hints = new Map();

function rememberHints(events) {
  events.forEach((event) => {
    hints.set(String(event.id), {
      home: event.home, away: event.away, league: event.league,
      sportId: event.sportId, sport: event.sport, time: event.time,
    });
  });
  if (hints.size > 4000) {
    Array.from(hints.keys()).slice(0, 1500).forEach((key) => hints.delete(key));
  }
}

const hintFor = (id) => hints.get(String(id)) || null;

/* ---- team badges ---- */

let teamImages = {};
try { teamImages = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8')); } catch (err) { teamImages = {}; }
let teamsDirty = false;

function saveTeams() {
  if (!teamsDirty) return;
  teamsDirty = false;
  try {
    fs.mkdirSync(path.dirname(TEAMS_FILE), { recursive: true });
    fs.writeFileSync(TEAMS_FILE, JSON.stringify(teamImages));
  } catch (err) { /* the cache is a nicety, not a requirement */ }
}

const teamKey = (sportId, name) => sportId + '|' + String(name || '').trim().toLowerCase();

/** The feed serves a 43-byte placeholder when a club has no crest. */
async function usableImage(imageId) {
  if (!imageId) return '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(IMAGE_BASE + imageId + '.png', { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return '';
    const size = parseInt(res.headers.get('content-length') || '0', 10);
    return size >= 200 ? String(imageId) : '';
  } catch (err) {
    return '';
  }
}

// served through our own host so the browser never needs the upstream CDN.
// size 's' is the small crest used in lists, 'b' the larger one for match pages.
const logoFor = (sportId, name, size) => {
  const image = teamImages[teamKey(sportId, name)];
  if (!image) return '';
  return '/api/sports/logo?id=' + image + (size === 'b' ? '&size=b' : '');
};

/** The crest that belongs to a selection: the team it names, or the home side. */
function logoForPick(sportId, home, away, label) {
  const text = String(label || '').toLowerCase();
  const matches = (name) => name && text.indexOf(String(name).toLowerCase()) === 0;
  if (matches(away)) return logoFor(sportId, away);
  if (matches(home)) return logoFor(sportId, home);
  return logoFor(sportId, home);
}

/* ---- crest proxy ---- */

const logoBytes = new Map();

/** Fetches a crest once and keeps the bytes around to serve again. */
async function logoImage(imageId, size) {
  const id = String(imageId).replace(/[^0-9]/g, '');
  if (!id) return null;
  const variant = size === 'b' ? 'b' : 's';
  const cacheKey = variant + ':' + id;
  if (logoBytes.has(cacheKey)) return logoBytes.get(cacheKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(IMAGE_BASE.replace('/s/', '/' + variant + '/') + id + '.png', { signal: controller.signal });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 200) return null;
    if (logoBytes.size > 800) logoBytes.clear();
    logoBytes.set(cacheKey, buffer);
    return buffer;
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Attaches whatever crests are already known — never waits on the network. */
function attachLogos(events) {
  events.forEach((event) => {
    event.homeLogo = logoFor(event.sportId, event.home);
    event.awayLogo = logoFor(event.sportId, event.away);
  });
  return events;
}

/**
 * Looks up the crests we have not seen before, in the background. The
 * provider's event view carries both image ids, so one request covers a whole
 * fixture, and results are kept on disk keyed by team name — a recurring team
 * never costs a request again.
 */
function resolveLogos(events, limit) {
  const unknown = events.filter((event) =>
    event.ourEventId &&
    (!(teamKey(event.sportId, event.home) in teamImages) || !(teamKey(event.sportId, event.away) in teamImages))
  ).slice(0, limit || 24);
  if (!unknown.length) return;

  pool(config.logoConcurrency, unknown, async (event) => {
    const data = await apiGet('/v1/event/view', { event_id: event.ourEventId });
    const result = (data.results || [])[0];
    if (!result) return;

    for (const side of ['home', 'away']) {
      const team = result[side];
      if (!team) continue;
      const image = await usableImage(team.image_id);
      // store under both spellings: the provider's and bet365's
      teamImages[teamKey(event.sportId, team.name)] = image;
      teamImages[teamKey(event.sportId, event[side])] = image;
      teamsDirty = true;
    }
  }).then(saveTeams).catch(() => {});
}

/** Full market list for one event, ready to render. */
async function eventDetail(fi, hint) {
  const result = await eventOdds(fi);
  const known = hintFor(fi) || {};
  const pick = (field, fallback) => (hint && hint[field]) || known[field] || fallback;
  const event = {
    id: String(fi),
    sportId: parseInt(result.sport_id, 10),
    home: pick('home', 'Home'),
    away: pick('away', 'Away'),
    league: pick('league', ''),
    time: pick('time', 0),
  };
  return Object.assign({}, event, {
    sport: (SPORT_BY_ID[event.sportId] || {}).name || 'Sport',
    homeLogo: logoFor(event.sportId, event.home),
    awayLogo: logoFor(event.sportId, event.away),
    homeLogoBig: logoFor(event.sportId, event.home, 'b'),
    awayLogoBig: logoFor(event.sportId, event.away, 'b'),
    markets: normaliseMarkets(result, event),
  });
}

/** Headline market for a list of events (or bare ids), in batched requests. */
async function mainOdds(input) {
  const events = input.map((item) => {
    const event = typeof item === 'object' ? Object.assign({}, item) : { id: String(item) };
    if (!event.home || event.home === 'Home') Object.assign(event, hintFor(event.id) || {});
    return event;
  });

  const found = await loadOdds(events.map((e) => String(e.id)));
  events.forEach((event) => {
    const result = found.get(String(event.id));
    if (!result) { event.main = null; return; }
    const markets = normaliseMarkets(result, event);
    const main = markets[0];
    event.main = main ? { name: main.name, selections: main.selections.slice(0, 3) } : null;
    event.marketCount = markets.length;
    event.homeLogo = logoFor(event.sportId, event.home);
    event.awayLogo = logoFor(event.sportId, event.away);
  });
  return events;
}

/** Warms the odds cache without anyone waiting on it. */
function prefetchOdds(ids) {
  loadOdds(ids.map(String)).catch(() => {});
}

/** Adds the headline market to the first events on a page. */
async function withMainOdds(list, limit) {
  const take = Math.min(limit || config.oddsPerPage, list.events.length);
  await mainOdds(list.events.slice(0, take));
  return list;
}

/**
 * The next few real fixtures, preferring MLB, so the Trending strip stays full
 * even when nobody has pinned anything.
 */
async function featured(count, exclude) {
  const skip = exclude || [];
  const wanted = [{ sportId: 16, league: /^MLB$/i }, { sportId: 16, league: null }, { sportId: 1, league: null }];

  for (const source of wanted) {
    try {
      const list = await upcoming(source.sportId, 1);
      const picked = list.events.filter((event) =>
        !event.virtual && skip.indexOf(event.id) === -1 &&
        (!source.league || source.league.test(event.league)));
      if (picked.length) return picked.slice(0, count);
    } catch (err) { /* try the next source */ }
  }
  return [];
}

/** Filters the first few pages of a sport by team or league name. */
async function search(sportId, query, pages) {
  const needle = String(query || '').trim().toLowerCase();
  if (needle.length < 2) return [];

  const lists = await Promise.all(
    Array.from({ length: pages || 3 }, (_, i) => upcoming(sportId, i + 1).catch(() => ({ events: [] })))
  );

  const matches = [];
  const seen = new Set();
  lists.forEach((list) => {
    list.events.forEach((event) => {
      if (seen.has(event.id)) return;
      const haystack = (event.home + ' ' + event.away + ' ' + event.league).toLowerCase();
      if (haystack.indexOf(needle) === -1) return;
      seen.add(event.id);
      matches.push(event);
    });
  });
  return matches.slice(0, 40);
}

/** Confirms a selection still exists at the price the player clicked. */
async function verifySelection(fi, selectionId) {
  const result = await eventOdds(fi);
  const event = { home: 'Home', away: 'Away' };
  const markets = normaliseMarkets(result, event);
  for (const market of markets) {
    for (const selection of market.selections) {
      if (selection.id === String(selectionId)) return { odds: selection.odds, market: market.name };
    }
  }
  return null;
}

module.exports = {
  config: config,
  sports: SPORTS,
  enabled: enabled,
  upcoming: upcoming,
  eventDetail: eventDetail,
  withMainOdds: withMainOdds,
  mainOdds: mainOdds,
  prefetchOdds: prefetchOdds,
  attachLogos: attachLogos,
  resolveLogos: resolveLogos,
  logoImage: logoImage,
  logoFor: logoFor,
  logoForPick: logoForPick,
  search: search,
  featured: featured,
  verifySelection: verifySelection,
};
