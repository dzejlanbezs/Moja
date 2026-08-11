/* ============================================================
   Dicey — Ethereum deposit watching

   Read-only on purpose. Players send straight to the house
   address, so nothing here ever holds a private key, signs a
   transaction or moves funds. All it does is notice incoming
   ETH / USDT / USDC and report them so they can be credited.
   ============================================================ */

'use strict';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const TOKENS = {
  USDT: { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6, stable: true },
  USDC: { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6, stable: true },
};

const config = {
  rpcUrl: process.env.DICEY_RPC_URL || 'https://ethereum-rpc.publicnode.com',
  solRpcUrl: process.env.DICEY_SOL_RPC_URL || 'https://api.mainnet-beta.solana.com',
  btcApiUrl: process.env.DICEY_BTC_API_URL || 'https://blockstream.info/api',
  confirmations: parseInt(process.env.DICEY_CONFIRMATIONS, 10) || 3,
  pollMs: parseInt(process.env.DICEY_POLL_MS, 10) || 20000,
  maxBlocksPerPoll: 12,
  reconcileBatch: parseInt(process.env.DICEY_RECONCILE_BATCH, 10) || 6,
  watchNative: process.env.DICEY_WATCH_ETH !== '0',
  watchBtc: process.env.DICEY_WATCH_BTC !== '0',
  watchSol: process.env.DICEY_WATCH_SOL !== '0',
  ethUsdOverride: parseFloat(process.env.DICEY_ETH_USD) || 0,
  priceUrl: 'https://api.coinbase.com/v2/prices/',
};

// { eth: Map(address -> userId), btc: Map(...), sol: Map(...) }
const watched = { eth: new Map(), btc: new Map(), sol: new Map() };

/** Replaces the set of addresses being watched. Called whenever a player is added. */
function setWatchList(entries) {
  watched.eth.clear();
  watched.btc.clear();
  watched.sol.clear();
  entries.forEach((entry) => {
    if (entry.ETH) watched.eth.set(String(entry.ETH).toLowerCase(), entry.userId);
    if (entry.BTC) watched.btc.set(entry.BTC, entry.userId);
    if (entry.SOL) watched.sol.set(entry.SOL, entry.userId);
  });
}

const watchCount = () => ({ eth: watched.eth.size, btc: watched.btc.size, sol: watched.sol.size });

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
  const addresses = Array.from(watched.eth.keys());
  if (!addresses.length) return [];

  const size = Math.min(config.reconcileBatch, addresses.length);
  const start = cursor.index % addresses.length;
  const slice = [];
  for (let i = 0; i < size; i++) slice.push(addresses[(start + i) % addresses.length]);
  cursor.index = (start + size) % addresses.length;

  const found = [];
  for (const address of slice) found.push(...await checkEthAddress(state, address, blockTag));
  return found;
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
      const key = 'btc:' + address;
      const seen = state.get(key);

      if (seen == null) { state.set(key, funded); continue; }   // first sight: take a baseline
      if (funded <= seen) continue;

      const amount = (funded - seen) / 1e8;
      state.set(key, funded);
      found.push({
        txHash: 'btc:' + address + ':' + funded,
        from: '', to: address, userId: userId,
        coin: 'BTC', amount: amount,
        usd: await usdValue('BTC', amount),
        blockNumber: 0,
      });
    } catch (err) { /* try again next poll */ }
  }
  return found;
}

/* ---- solana: poll balances for a rise ---- */

async function solDeposits(state) {
  const found = [];
  for (const [address, userId] of watched.sol) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(config.solRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!data.result) continue;
      const lamports = data.result.value || 0;
      const key = 'sol:' + address;
      const seen = state.get(key);

      if (seen == null) { state.set(key, lamports); continue; }
      if (lamports <= seen) { state.set(key, lamports); continue; }

      const amount = (lamports - seen) / 1e9;
      state.set(key, lamports);
      found.push({
        txHash: 'sol:' + address + ':' + lamports,
        from: '', to: address, userId: userId,
        coin: 'SOL', amount: amount,
        usd: await usdValue('SOL', amount),
        blockNumber: 0,
      });
    } catch (err) { /* try again next poll */ }
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
      if (config.watchSol && watched.sol.size) await report(await solDeposits(store.state));
    } catch (err) {
      console.error('chain watcher (sol):', err.message);
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
  setWatchList: setWatchList,
  watchCount: watchCount,
  watch: watch,
  status: status,
  spotPrice: spotPrice,
  ethUsd: ethUsd,
  get online() { return online; },
  get lastError() { return lastError; },
};
