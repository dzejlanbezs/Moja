/* ============================================================
   Dicey — deposit watching

   Read-only on purpose. Players send to an address that is
   theirs alone, so nothing here ever holds a private key, signs
   a transaction or moves funds. All it does is notice incoming
   coins and report them so they can be credited:

     Ethereum   ETH, USDT / USDC as ERC-20
     Bitcoin    BTC
     Solana     SOL, USDT / USDC as SPL
     Tron       TRX, USDT / USDC as TRC-20
   ============================================================ */

'use strict';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const TOKENS = {
  USDT: { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6, stable: true },
  USDC: { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6, stable: true },
};

// SPL mints on Solana, both six decimals
const SPL_TOKENS = {
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
};

// TRC-20 contracts on Tron, both six decimals
const TRC20_TOKENS = {
  USDT: { contract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6 },
  USDC: { contract: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', decimals: 6 },
};

const config = {
  rpcUrl: process.env.DICEY_RPC_URL || 'https://ethereum-rpc.publicnode.com',
  solRpcUrl: process.env.DICEY_SOL_RPC_URL || 'https://api.mainnet-beta.solana.com',
  btcApiUrl: process.env.DICEY_BTC_API_URL || 'https://blockstream.info/api',
  tronApiUrl: process.env.DICEY_TRON_API_URL || 'https://api.trongrid.io',
  tronApiKey: process.env.DICEY_TRON_API_KEY || '',
  confirmations: parseInt(process.env.DICEY_CONFIRMATIONS, 10) || 3,
  pollMs: parseInt(process.env.DICEY_POLL_MS, 10) || 20000,
  maxBlocksPerPoll: 12,
  reconcileBatch: parseInt(process.env.DICEY_RECONCILE_BATCH, 10) || 6,
  solBatch: parseInt(process.env.DICEY_SOL_BATCH, 10) || 8,
  tronBatch: parseInt(process.env.DICEY_TRON_BATCH, 10) || 5,
  // TronGrid allows one account lookup per second without an API key
  tronGapMs: parseInt(process.env.DICEY_TRON_GAP_MS, 10) || 1200,
  watchNative: process.env.DICEY_WATCH_ETH !== '0',
  watchBtc: process.env.DICEY_WATCH_BTC !== '0',
  watchSol: process.env.DICEY_WATCH_SOL !== '0',
  watchTron: process.env.DICEY_WATCH_TRON !== '0',
  ethUsdOverride: parseFloat(process.env.DICEY_ETH_USD) || 0,
  priceUrl: 'https://api.coinbase.com/v2/prices/',
};

// { eth: Map(address -> userId), btc: Map(...), sol: Map(...), tron: Map(...) }
const watched = { eth: new Map(), btc: new Map(), sol: new Map(), tron: new Map() };

/** Replaces the set of addresses being watched. Called whenever a player is added. */
function setWatchList(entries) {
  watched.eth.clear();
  watched.btc.clear();
  watched.sol.clear();
  watched.tron.clear();
  entries.forEach((entry) => {
    if (entry.ETH) watched.eth.set(String(entry.ETH).toLowerCase(), entry.userId);
    if (entry.BTC) watched.btc.set(entry.BTC, entry.userId);
    if (entry.SOL) watched.sol.set(entry.SOL, entry.userId);
    if (entry.TRX) watched.tron.set(entry.TRX, entry.userId);
  });
}

const watchCount = () => ({
  eth: watched.eth.size, btc: watched.btc.size, sol: watched.sol.size, tron: watched.tron.size,
});

let rpcId = 0;
let online = false;
let lastError = '';

/* ------------------------------------------------------------------ rpc */

async function rpc(method, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: method, params: params || [] }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'RPC error');
    online = true;
    lastError = '';
    return data.result;
  } catch (err) {
    online = false;
    lastError = err.message;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const hexToInt = (hex) => parseInt(hex, 16);
const hexToBig = (hex) => BigInt(hex && hex !== '0x' ? hex : '0x0');
const addrFromTopic = (topic) => '0x' + String(topic).slice(-40).toLowerCase();

function scaled(raw, decimals) {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  return Number(whole) + Number(frac) / Number(divisor);
}

const tokenByAddress = (address) => {
  const key = Object.keys(TOKENS).filter((sym) => TOKENS[sym].address === String(address).toLowerCase())[0];
  return key ? Object.assign({ symbol: key }, TOKENS[key]) : null;
};

/* ------------------------------------------------------------------ price */

const priceCache = {};

async function spotPrice(symbol) {
  if (symbol === 'ETH' && config.ethUsdOverride) return config.ethUsdOverride;
  const cached = priceCache[symbol];
  if (cached && Date.now() - cached.at < 300000) return cached.value;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(config.priceUrl + symbol + '-USD/spot', { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    const value = parseFloat(data && data.data && data.data.amount);
    if (value > 0) priceCache[symbol] = { value: value, at: Date.now() };
  } catch (err) {
    /* keep whatever we had; the caller decides what to do without a price */
  }
  return priceCache[symbol] ? priceCache[symbol].value : 0;
}

const ethUsd = () => spotPrice('ETH');

/** USD value of a deposit, or 0 when we cannot price it. */
async function usdValue(coin, amount) {
  if (coin === 'USDT' || coin === 'USDC') return Math.round(amount * 100) / 100;
  const price = await spotPrice(coin);
  return price ? Math.round(amount * price * 100) / 100 : 0;
}

/* ------------------------------------------------------------------ scanning */

/**
 * Looks for signs of life on watched addresses inside a block range.
 * It reports *which* addresses moved, never how much — the amount is always
 * decided by checkEthAddress so a deposit can only ever be counted once.
 */
async function scanForActivity(fromBlock, toBlock) {
  const touched = new Map();
  if (!watched.eth.size) return touched;

  const note = (address, txHash, from, asset) => {
    const key = String(address).toLowerCase();
    const entry = touched.get(key) || {};
    entry[asset] = txHash;
    if (from) entry.from = from;
    touched.set(key, entry);
  };

  const targets = Array.from(watched.eth.keys()).map((addr) => '0x000000000000000000000000' + addr.slice(2));

  // topic filters get unwieldy with many addresses, so query in chunks
  for (let i = 0; i < targets.length; i += 100) {
    const logs = await rpc('eth_getLogs', [{
      fromBlock: '0x' + fromBlock.toString(16),
      toBlock: '0x' + toBlock.toString(16),
      address: Object.keys(TOKENS).map((sym) => TOKENS[sym].address),
      topics: [TRANSFER_TOPIC, null, targets.slice(i, i + 100)],
    }]);

    for (const log of logs || []) {
      const token = tokenByAddress(log.address);
      if (token) note(addrFromTopic(log.topics[2]), log.transactionHash, addrFromTopic(log.topics[1]), token.symbol);
    }
  }

  if (config.watchNative) {
    for (let n = fromBlock; n <= toBlock; n++) {
      const block = await rpc('eth_getBlockByNumber', ['0x' + n.toString(16), true]);
      if (!block || !block.transactions) continue;
      for (const tx of block.transactions) {
        const to = tx.to ? tx.to.toLowerCase() : '';
        if (!to || !watched.eth.has(to) || hexToBig(tx.value) === 0n) continue;
        note(to, tx.hash, String(tx.from).toLowerCase(), 'ETH');
      }
    }
  }

  return touched;
}

/* ---- crediting: one source of truth per address ---- */

const BALANCE_OF = '0x70a08231';
const ledgerKey = (address, asset) => 'bal:' + address + ':' + asset;

async function ethBalance(address, blockTag) {
  return scaled(hexToBig(await rpc('eth_getBalance', [address, blockTag])), 18);
}

async function tokenBalance(address, token, blockTag) {
  const data = BALANCE_OF + '000000000000000000000000' + address.slice(2);
  const result = await rpc('eth_call', [{ to: token.address, data: data }, blockTag]);
  return scaled(hexToBig(result), token.decimals);
}

/**
 * The only place an Ethereum deposit is ever turned into a credit.
 *
 * Every detection path — a transfer log, a block scan, the periodic sweep —
 * funnels through here, and the amount always comes from the difference
 * between the confirmed on-chain balance and what has already been credited.
 * That makes crediting idempotent: seeing the same deposit twice is a no-op.
 */
async function checkEthAddress(state, address, blockTag, hints) {
  const userId = watched.eth.get(address);
  const found = [];

  const assets = [{ symbol: 'ETH', read: () => ethBalance(address, blockTag) }];
  Object.keys(TOKENS).forEach((sym) => {
    assets.push({ symbol: sym, read: () => tokenBalance(address, TOKENS[sym], blockTag) });
  });

  for (const asset of assets) {
    try {
      const actual = await asset.read();
      const key = ledgerKey(address, asset.symbol);
      const credited = state.get(key);

      // the first look at an address is only a baseline, so restoring a
      // backup never re-credits balances that were already there
      if (credited === undefined) { state.set(key, actual); continue; }

      if (actual > credited + 1e-12) {
        const amount = actual - credited;
        state.set(key, actual);
        found.push({
          txHash: (hints && hints[asset.symbol]) || '',
          from: (hints && hints.from) || '',
          to: address,
          userId: userId,
          coin: asset.symbol,
          network: 'Ethereum · ' + (asset.symbol === 'ETH' ? 'mainnet' : 'ERC-20'),
          amount: amount,
          usd: await usdValue(asset.symbol, amount),
          blockNumber: 0,
        });
      } else if (actual < credited) {
        state.set(key, actual);   // funds were swept out
      }
    } catch (err) { /* try again on the next pass */ }
  }
  return found;
}

/**
 * Walks a slice of the watched addresses so nothing is missed after a
 * restart, a skipped block or a flaky node.
 */
async function sweepEth(state, cursor, blockTag) {
  const slice = nextSlice(watched.eth, cursor, config.reconcileBatch);
  const found = [];
  for (const [address] of slice) found.push(...await checkEthAddress(state, address, blockTag));
  return found;
}

/* ---- polled chains: bitcoin, solana, tron ---- */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Takes the next few watched addresses, remembering where it stopped, so a
 * long watch list is worked through over several polls instead of hammering
 * a public API with every address at once.
 */
function nextSlice(map, cursor, size) {
  const entries = Array.from(map.entries());
  if (!entries.length) return [];
  const take = Math.min(size, entries.length);
  const start = cursor.index % entries.length;
  const slice = [];
  for (let i = 0; i < take; i++) slice.push(entries[(start + i) % entries.length]);
  cursor.index = (start + take) % entries.length;
  return slice;
}

/**
 * Turns a polled balance into a credit, in the same idempotent way as the
 * Ethereum path: the amount is the rise since the last reading, the first
 * reading is only a baseline, and raw units are stored so nothing is lost to
 * rounding. `scale` is the raw units per coin (1e8 for satoshis and so on).
 */
async function fromBalance(state, key, raw, scale, info) {
  const seen = state.get(key);
  if (seen == null) { state.set(key, raw); return null; }        // first sight: baseline only
  if (raw <= seen) {
    if (raw < seen) state.set(key, raw);                         // funds were swept out
    return null;
  }
  const amount = (raw - seen) / scale;
  state.set(key, raw);
  return {
    txHash: '', from: '', to: info.address, userId: info.userId,
    coin: info.coin, network: info.network, amount: amount,
    usd: await usdValue(info.coin, amount),
    blockNumber: 0,
  };
}

/* ---- bitcoin: poll the address API for a rise in total received ---- */

async function btcDeposits(state) {
  const found = [];
  for (const [address, userId] of watched.btc) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(config.btcApiUrl + '/address/' + address, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const funded = (data.chain_stats && data.chain_stats.funded_txo_sum) || 0;
      const deposit = await fromBalance(state, 'btc:' + address, funded, 1e8, {
        address: address, userId: userId, coin: 'BTC', network: 'Bitcoin · native segwit',
      });
      if (deposit) found.push(deposit);
    } catch (err) { /* try again next poll */ }
  }
  return found;
}

/* ---- solana: SOL plus USDT / USDC held as SPL tokens ---- */

async function solRpc(method, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(config.solRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: method, params: params || [] }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Solana RPC error');
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Total of every finalized token account the player's wallet owns for one mint.
 * Senders create the associated token account themselves, so all the player
 * ever needs to hand out is their plain Solana address.
 */
async function splBalance(owner, mint) {
  const result = await solRpc('getTokenAccountsByOwner', [
    owner, { mint: mint }, { encoding: 'jsonParsed', commitment: 'finalized' },
  ]);
  let raw = 0;
  for (const account of (result && result.value) || []) {
    const info = account.account.data.parsed.info;
    raw += parseInt(info.tokenAmount.amount, 10) || 0;
  }
  return raw;
}

async function solDeposits(state, cursor) {
  const found = [];
  for (const [address, userId] of nextSlice(watched.sol, cursor, config.solBatch)) {
    try {
      const balance = await solRpc('getBalance', [address, { commitment: 'finalized' }]);
      const lamports = (balance && balance.value) || 0;
      const deposit = await fromBalance(state, 'sol:' + address, lamports, 1e9, {
        address: address, userId: userId, coin: 'SOL', network: 'Solana · mainnet',
      });
      if (deposit) found.push(deposit);
    } catch (err) { /* try again next poll */ }

    for (const symbol of Object.keys(SPL_TOKENS)) {
      try {
        const token = SPL_TOKENS[symbol];
        const raw = await splBalance(address, token.mint);
        const deposit = await fromBalance(state, 'spl:' + address + ':' + symbol, raw, 10 ** token.decimals, {
          address: address, userId: userId, coin: symbol, network: 'Solana · SPL',
        });
        if (deposit) found.push(deposit);
      } catch (err) { /* try again next poll */ }
    }
  }
  return found;
}

/* ---- tron: TRX plus USDT / USDC held as TRC-20 ---- */

/** One confirmed account snapshot from TronGrid: TRX balance and every TRC-20 balance. */
async function tronAccount(address) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const headers = config.tronApiKey ? { 'TRON-PRO-API-KEY': config.tronApiKey } : {};
    const res = await fetch(
      config.tronApiUrl + '/v1/accounts/' + address + '?only_confirmed=true',
      { headers: headers, signal: controller.signal }
    );
    if (!res.ok) throw new Error('TronGrid HTTP ' + res.status);
    const data = await res.json();
    if (data.Error) throw new Error(String(data.Error).slice(0, 120));

    // an address nobody has ever sent to does not exist on Tron yet
    const account = (data.data || [])[0] || {};
    const tokens = {};
    for (const entry of account.trc20 || []) {
      for (const contract of Object.keys(entry)) tokens[contract] = entry[contract];
    }
    return { trx: account.balance || 0, tokens: tokens };
  } finally {
    clearTimeout(timer);
  }
}

async function tronDeposits(state, cursor) {
  const found = [];
  const slice = nextSlice(watched.tron, cursor, config.tronBatch);

  for (let i = 0; i < slice.length; i++) {
    const [address, userId] = slice[i];
    if (i) await sleep(config.tronGapMs);      // stay inside TronGrid's rate limit
    let account;
    try {
      account = await tronAccount(address);
    } catch (err) {
      continue;                                 // try again next poll
    }

    const trx = await fromBalance(state, 'trx:' + address, account.trx, 1e6, {
      address: address, userId: userId, coin: 'TRX', network: 'Tron · mainnet',
    });
    if (trx) found.push(trx);

    for (const symbol of Object.keys(TRC20_TOKENS)) {
      const token = TRC20_TOKENS[symbol];
      // TRC-20 amounts arrive as decimal strings that overflow a 32-bit int
      const raw = Number(account.tokens[token.contract] || 0);
      if (!Number.isFinite(raw)) continue;
      const deposit = await fromBalance(state, 'trc:' + address + ':' + symbol, raw, 10 ** token.decimals, {
        address: address, userId: userId, coin: symbol, network: 'Tron · TRC-20',
      });
      if (deposit) found.push(deposit);
    }
  }
  return found;
}

/* ------------------------------------------------------------------ public api */

/**
 * Polls new blocks and hands every incoming deposit to onDeposit().
 * cursor.get() / cursor.set() let the caller persist the scan position.
 */
function watch(store, onDeposit) {
  let running = false;
  const reconcileCursor = { index: 0 };
  const solCursor = { index: 0 };
  const tronCursor = { index: 0 };

  async function report(list) {
    for (const deposit of list) {
      try { await onDeposit(deposit); } catch (err) { console.error('deposit handler:', err.message); }
    }
  }

  async function ethereum() {
    const latest = hexToInt(await rpc('eth_blockNumber', []));
    const safeTip = latest - config.confirmations;
    const blockTag = '0x' + Math.max(0, safeTip).toString(16);
    let from = store.block.get();

    if (!from) { store.block.set(safeTip); }            // first run: start from now
    else if (safeTip > from) {
      if (safeTip - from > config.maxBlocksPerPoll) {
        // public nodes refuse deep history; the sweep below catches the rest
        from = safeTip - config.maxBlocksPerPoll;
      }
      const touched = await scanForActivity(from + 1, safeTip);
      for (const [address, hints] of touched) {
        await report(await checkEthAddress(store.state, address, blockTag, hints));
      }
      store.block.set(safeTip);
    }

    // rolling sweep so a missed block or a restart cannot lose a deposit
    await report(await sweepEth(store.state, reconcileCursor, blockTag));
  }

  async function tick() {
    if (running) return;
    running = true;
    try {
      await ethereum();
    } catch (err) {
      console.error('chain watcher (eth):', err.message);
    }
    try {
      if (config.watchBtc && watched.btc.size) await report(await btcDeposits(store.state));
    } catch (err) {
      console.error('chain watcher (btc):', err.message);
    }
    try {
      if (config.watchSol && watched.sol.size) await report(await solDeposits(store.state, solCursor));
    } catch (err) {
      console.error('chain watcher (sol):', err.message);
    }
    try {
      if (config.watchTron && watched.tron.size) await report(await tronDeposits(store.state, tronCursor));
    } catch (err) {
      console.error('chain watcher (tron):', err.message);
    }
    running = false;
  }

  tick();
  const timer = setInterval(tick, config.pollMs);
  if (timer.unref) timer.unref();
  return { tick: tick };
}

async function status() {
  try {
    const block = hexToInt(await rpc('eth_blockNumber', []));
    return { online: true, block: block, watching: watchCount(), confirmations: config.confirmations, ethUsd: await ethUsd() };
  } catch (err) {
    return { online: false, error: err.message, watching: watchCount(), confirmations: config.confirmations };
  }
}

module.exports = {
  config: config,
  tokens: TOKENS,
  splTokens: SPL_TOKENS,
  trc20Tokens: TRC20_TOKENS,
  setWatchList: setWatchList,
  watchCount: watchCount,
  watch: watch,
  status: status,
  spotPrice: spotPrice,
  ethUsd: ethUsd,
  get online() { return online; },
  get lastError() { return lastError; },
};
